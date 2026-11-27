package com.mokdo.backend.character;

import java.text.Normalizer;
import java.util.List;
import java.util.UUID;
import com.mokdo.backend.character.ItemService.WeaponResponse;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CharacterService {
    private final JdbcTemplate jdbc;
    private final ItemService items;

    public CharacterService(JdbcTemplate jdbc, ItemService items) {
        this.jdbc = jdbc;
        this.items = items;
    }

    public List<CharacterResponse> list(UUID memberId) {
        return jdbc.query("""
                SELECT g.character_id, slot_no, nickname, equipped_costume_id, c.appearance_code,
                       e.character_item_id AS weapon_character_item_id, i.item_id AS weapon_item_id,
                       i.item_code AS weapon_item_code, i.name AS weapon_name, i.appearance_code AS weapon_appearance_code
                FROM gm_character g JOIN gm_costume c ON c.costume_id = equipped_costume_id
                LEFT JOIN gm_character_equipment e ON e.character_id = g.character_id AND e.slot_code = 'WEAPON'
                LEFT JOIN gm_character_item ci ON ci.character_item_id = e.character_item_id
                LEFT JOIN gm_item i ON i.item_id = ci.item_id
                WHERE member_id = ? ORDER BY slot_no
                """, (rs, row) -> new CharacterResponse(rs.getObject("character_id", UUID.class),
                rs.getInt("slot_no"), rs.getString("nickname"),
                rs.getObject("equipped_costume_id", UUID.class), rs.getString("appearance_code"),
                rs.getObject("weapon_character_item_id", UUID.class) == null ? null : new WeaponResponse(
                        rs.getObject("weapon_character_item_id", UUID.class), rs.getObject("weapon_item_id", UUID.class),
                        rs.getString("weapon_item_code"), rs.getString("weapon_name"), rs.getString("weapon_appearance_code"))), memberId);
    }

    public List<CostumeResponse> ownedCostumes(UUID memberId) {
        return jdbc.query("""
                SELECT c.costume_id, c.name, c.appearance_code
                FROM mb_member_costume mc JOIN gm_costume c ON c.costume_id = mc.costume_id
                WHERE mc.member_id = ? ORDER BY mc.reg_dtm, c.costume_id
                """, (rs, row) -> new CostumeResponse(rs.getObject("costume_id", UUID.class),
                rs.getString("name"), rs.getString("appearance_code")), memberId);
    }

    @Transactional
    public void equipCostume(UUID memberId, UUID characterId, UUID costumeId) {
        if (costumeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "장착할 코스튬을 선택해 주세요.");
        }
        int updated = jdbc.update("""
                UPDATE gm_character SET equipped_costume_id = ?, mod_dtm = CURRENT_TIMESTAMP
                WHERE character_id = ? AND member_id = ?
                  AND EXISTS (SELECT 1 FROM mb_member_costume WHERE member_id = ? AND costume_id = ?)
                """, costumeId, characterId, memberId, memberId, costumeId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "코스튬을 변경하지 못했어요. 본인 캐릭터와 보유한 코스튬인지 확인해 주세요.");
        }
    }

    public boolean available(String nickname) {
        String normalized = validateNickname(nickname);
        return !Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM gm_character WHERE LOWER(nickname) = LOWER(?))",
                Boolean.class, normalized));
    }

    @Transactional
    public CharacterResponse create(UUID memberId, int slotNo, String nickname) {
        String normalized = validateNickname(nickname);
        if (slotNo < 1 || slotNo > 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "캐릭터 슬롯은 1~3번만 사용할 수 있어요.");
        }
        // Serialize requests from the same member, including requests to different slots.
        var statuses = jdbc.query("SELECT status FROM mb_member WHERE member_id = ? FOR UPDATE",
                (rs, row) -> rs.getString("status"), memberId);
        if (statuses.isEmpty() || !"ACT".equals(statuses.getFirst())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "캐릭터를 생성할 수 없는 계정이에요.");
        }
        var characters = list(memberId);
        if (characters.size() >= 3 || characters.stream().anyMatch(character -> character.slotNo() == slotNo)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 슬롯이에요. 선택 화면에서 확인해 주세요.");
        }
        if (!available(normalized)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 닉네임이에요.");
        }
        UUID characterId = UUID.randomUUID();
        var defaults = jdbc.query("SELECT costume_id, name, appearance_code FROM gm_costume WHERE is_default = TRUE FOR SHARE",
                (rs, row) -> new CostumeResponse(rs.getObject("costume_id", UUID.class), rs.getString("name"), rs.getString("appearance_code")));
        if (defaults.size() != 1) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "기본 코스튬 설정을 확인해 주세요.");
        var defaultCostume = defaults.getFirst();
        UUID defaultCostumeId = defaultCostume.costumeId();
        jdbc.update("""
                INSERT INTO mb_member_costume (member_costume_id, member_id, costume_id)
                VALUES (?, ?, ?) ON CONFLICT (member_id, costume_id) DO NOTHING
                """, UUID.randomUUID(), memberId, defaultCostumeId);
        try {
            jdbc.update("""
                    INSERT INTO gm_character (character_id, member_id, slot_no, nickname, equipped_costume_id)
                    VALUES (?, ?, ?, ?, ?)
                    """, characterId, memberId, slotNo, normalized, defaultCostumeId);
        } catch (DuplicateKeyException exception) {
            // The unique index also protects against another member claiming this name concurrently.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "닉네임 또는 슬롯이 이미 사용 중이에요. 다시 확인해 주세요.");
        }
        WeaponResponse weapon = items.grantDefaultWeapon(characterId);
        return new CharacterResponse(characterId, slotNo, normalized, defaultCostumeId, defaultCostume.appearanceCode(), weapon);
    }

    @Transactional
    public void delete(UUID memberId, UUID characterId, String nickname) {
        if (nickname == null || nickname.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임을 그대로 입력해 주세요.");
        }
        var owned = jdbc.query("""
                SELECT character_id FROM gm_character
                WHERE character_id = ? AND member_id = ? AND nickname = ? FOR UPDATE
                """, (rs, row) -> rs.getObject("character_id", UUID.class), characterId, memberId, nickname);
        if (owned.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "캐릭터를 삭제하지 못했어요. 닉네임과 캐릭터 목록을 확인해 주세요.");
        }
        jdbc.update("DELETE FROM gm_character_equipment WHERE character_id = ?", characterId);
        jdbc.update("DELETE FROM gm_character_item WHERE character_id = ?", characterId);
        jdbc.update("DELETE FROM gm_character WHERE character_id = ? AND member_id = ? AND nickname = ?",
                characterId, memberId, nickname);
    }

    static String validateNickname(String nickname) {
        String normalized = nickname == null ? "" : Normalizer.normalize(nickname, Normalizer.Form.NFC);
        if (!normalized.matches("[가-힣a-zA-Z0-9]{2,12}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "닉네임은 한글, 영문, 숫자로 2~12자 입력해 주세요. 공백과 특수문자는 사용할 수 없어요.");
        }
        return normalized;
    }

    public record CharacterResponse(UUID characterId, int slotNo, String nickname,
            UUID equippedCostumeId, String appearanceCode, WeaponResponse weapon) { }
    public record CostumeResponse(UUID costumeId, String name, String appearanceCode) { }
}
