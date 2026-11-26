package com.mokdo.backend.character;

import java.text.Normalizer;
import java.util.List;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CharacterService {
    private final JdbcTemplate jdbc;

    public CharacterService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CharacterResponse> list(UUID memberId) {
        return jdbc.query("""
                SELECT character_id, slot_no, nickname FROM gm_character
                WHERE member_id = ? ORDER BY slot_no
                """, (rs, row) -> new CharacterResponse(rs.getObject("character_id", UUID.class),
                rs.getInt("slot_no"), rs.getString("nickname")), memberId);
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
        try {
            jdbc.update("""
                    INSERT INTO gm_character (character_id, member_id, slot_no, nickname)
                    VALUES (?, ?, ?, ?)
                    """, characterId, memberId, slotNo, normalized);
        } catch (DuplicateKeyException exception) {
            // The unique index also protects against another member claiming this name concurrently.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "닉네임 또는 슬롯이 이미 사용 중이에요. 다시 확인해 주세요.");
        }
        return new CharacterResponse(characterId, slotNo, normalized);
    }

    @Transactional
    public void delete(UUID memberId, UUID characterId, String nickname) {
        if (nickname == null || nickname.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임을 그대로 입력해 주세요.");
        }
        int deleted = jdbc.update("""
                DELETE FROM gm_character
                WHERE character_id = ? AND member_id = ? AND nickname = ?
                """, characterId, memberId, nickname);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "캐릭터를 삭제하지 못했어요. 닉네임과 캐릭터 목록을 확인해 주세요.");
        }
    }

    static String validateNickname(String nickname) {
        String normalized = nickname == null ? "" : Normalizer.normalize(nickname, Normalizer.Form.NFC);
        if (!normalized.matches("[가-힣a-zA-Z0-9]{2,12}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "닉네임은 한글, 영문, 숫자로 2~12자 입력해 주세요. 공백과 특수문자는 사용할 수 없어요.");
        }
        return normalized;
    }

    public record CharacterResponse(UUID characterId, int slotNo, String nickname) { }
}
