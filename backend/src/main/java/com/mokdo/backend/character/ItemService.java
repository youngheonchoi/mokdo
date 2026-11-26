package com.mokdo.backend.character;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ItemService {
    private final JdbcTemplate jdbc;

    public ItemService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<InventoryItemResponse> inventory(UUID memberId, UUID characterId) {
        return jdbc.query("""
                SELECT ci.character_item_id, ci.item_id, i.item_code, i.name, i.item_type,
                       ci.quantity, i.appearance_code, (e.character_item_id IS NOT NULL) AS equipped
                FROM gm_character_item ci
                JOIN gm_character g ON g.character_id = ci.character_id
                JOIN gm_item i ON i.item_id = ci.item_id
                LEFT JOIN gm_character_equipment e ON e.character_item_id = ci.character_item_id
                WHERE g.member_id = ? AND g.character_id = ? ORDER BY ci.reg_dtm, ci.character_item_id
                """, (rs, row) -> new InventoryItemResponse(rs.getObject("character_item_id", UUID.class),
                rs.getObject("item_id", UUID.class), rs.getString("item_code"), rs.getString("name"),
                rs.getString("item_type"), rs.getInt("quantity"), rs.getString("appearance_code"),
                rs.getBoolean("equipped")), memberId, characterId);
    }

    @Transactional
    public WeaponResponse grantDefaultWeapon(UUID characterId) {
        var definitions = jdbc.query("""
                SELECT item_id, item_code, name, appearance_code FROM gm_item
                WHERE item_code = ? AND item_type = 'WEAPON' AND equip_slot_code = 'WEAPON' AND status = 'ACT'
                """, (rs, row) -> new WeaponResponse(null, rs.getObject("item_id", UUID.class),
                rs.getString("item_code"), rs.getString("name"), rs.getString("appearance_code")), "wooden-club");
        if (definitions.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "기본 무기 설정을 확인해 주세요.");
        }
        var item = definitions.getFirst();
        UUID characterItemId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO gm_character_item (character_item_id, character_id, item_id, quantity)
                VALUES (?, ?, ?, 1)
                """, characterItemId, characterId, item.itemId());
        saveWeapon(characterId, characterItemId);
        return new WeaponResponse(characterItemId, item.itemId(), item.itemCode(), item.name(), item.appearanceCode());
    }

    @Transactional
    public void equipWeapon(UUID memberId, UUID characterId, UUID characterItemId) {
        // Serialize equipment changes and character deletion on the same character.
        var owned = jdbc.query("""
                SELECT character_id FROM gm_character WHERE character_id = ? AND member_id = ? FOR UPDATE
                """, (rs, row) -> rs.getObject("character_id", UUID.class), characterId, memberId);
        if (owned.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "캐릭터를 찾을 수 없어요.");
        }
        if (characterItemId == null) {
            jdbc.update("DELETE FROM gm_character_equipment WHERE character_id = ? AND slot_code = 'WEAPON'", characterId);
            return;
        }
        var weapons = jdbc.query("""
                SELECT ci.character_item_id FROM gm_character_item ci JOIN gm_item i ON i.item_id = ci.item_id
                WHERE ci.character_item_id = ? AND ci.character_id = ? AND ci.quantity = 1
                  AND i.item_type = 'WEAPON' AND i.equip_slot_code = 'WEAPON' AND i.status = 'ACT'
                """, (rs, row) -> rs.getObject("character_item_id", UUID.class), characterItemId, characterId);
        if (weapons.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 캐릭터가 보유한 장착 가능한 무기를 선택해 주세요.");
        }
        saveWeapon(characterId, characterItemId);
    }

    private void saveWeapon(UUID characterId, UUID characterItemId) {
        jdbc.update("""
                INSERT INTO gm_character_equipment (character_equipment_id, character_id, slot_code, character_item_id)
                VALUES (?, ?, 'WEAPON', ?)
                ON CONFLICT (character_id, slot_code)
                DO UPDATE SET character_item_id = EXCLUDED.character_item_id, mod_dtm = CURRENT_TIMESTAMP
                """, UUID.randomUUID(), characterId, characterItemId);
    }

    public record WeaponResponse(UUID characterItemId, UUID itemId, String itemCode, String name, String appearanceCode) { }
    public record InventoryItemResponse(UUID characterItemId, UUID itemId, String itemCode, String name,
            String itemType, int quantity, String appearanceCode, boolean equipped) { }
}
