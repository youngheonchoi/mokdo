package com.mokdo.backend.character;

import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "ITEM_LEVEL_TEST_URL", matches = ".+")
class ItemLevelPostgresTests {
    private JdbcTemplate jdbc;
    private ItemService items;
    private UUID member, character, owned, item;
    @BeforeEach void setup() {
        String url = System.getenv("ITEM_LEVEL_TEST_URL");
        if (!url.startsWith("jdbc:postgresql://127.0.0.1:") || !url.endsWith("/weapon_level_test")) {
            throw new IllegalArgumentException("A disposable local weapon_level_test DB is required");
        }
        jdbc = new JdbcTemplate(new DriverManagerDataSource(url, "weapon_test", "weapon_test_password"));
        items = new ItemService(jdbc);
        jdbc.update("UPDATE gm_character_level SET required_exp = 100 WHERE level = 1");
        jdbc.update("INSERT INTO gm_character_level (level, max_hp, attack, defense) VALUES (2, 110, 12, 3) ON CONFLICT DO NOTHING");
        member = UUID.randomUUID(); character = UUID.randomUUID(); owned = UUID.randomUUID(); item = UUID.randomUUID();
        UUID costume = jdbc.queryForObject("SELECT costume_id FROM gm_costume WHERE is_default", UUID.class);
        jdbc.update("INSERT INTO mb_member (member_id) VALUES (?)", member);
        jdbc.update("INSERT INTO mb_member_costume (member_costume_id, member_id, costume_id) VALUES (?, ?, ?)", UUID.randomUUID(), member, costume);
        jdbc.update("INSERT INTO gm_character (character_id, member_id, slot_no, nickname, equipped_costume_id) VALUES (?, ?, 1, ?, ?)", character, member, character.toString(), costume);
        jdbc.update("INSERT INTO gm_item (item_id, item_code, name, item_type, equip_slot_code, appearance_code, required_level) VALUES (?, ?, '테스트 무기', 'WEAPON', 'WEAPON', 'test-sword', 2)", item, item.toString());
        jdbc.update("INSERT INTO gm_character_item (character_item_id, character_id, item_id) VALUES (?, ?, ?)", owned, character, item);
    }
    @Test void rejectsBelowRequirementAndAcceptsExactLevel() {
        var error = assertThrows(ResponseStatusException.class, () -> items.equipWeapon(member, character, owned));
        assertEquals(400, error.getStatusCode().value());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_equipment WHERE character_id = ?", Integer.class, character));
        jdbc.update("UPDATE gm_character SET level = 2 WHERE character_id = ?", character);
        items.equipWeapon(member, character, owned);
        assertTrue(items.inventory(member, character).getFirst().equipped());
        assertEquals(2, items.inventory(member, character).getFirst().requiredLevel());
    }
    @Test void raisingRequirementHidesIneligibleEquippedWeaponAndStillAllowsUnequip() {
        jdbc.update("UPDATE gm_character SET level = 2 WHERE character_id = ?", character);
        items.equipWeapon(member, character, owned);
        jdbc.update("UPDATE gm_item SET required_level = 3 WHERE item_id = ?", item);
        assertFalse(items.inventory(member, character).getFirst().equipped());
        assertNull(new CharacterService(jdbc, items).list(member).getFirst().weapon());
        assertThrows(ResponseStatusException.class, () -> items.equipWeapon(member, character, owned));
        items.equipWeapon(member, character, null);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_equipment WHERE character_id = ?", Integer.class, character));
    }

    private UUID hat() {
        UUID hat = UUID.randomUUID(), hatOwned = UUID.randomUUID();
        jdbc.update("INSERT INTO gm_item (item_id, item_code, name, item_type, equip_slot_code, appearance_code, required_level, attack, defense, hp) VALUES (?, ?, '모자', 'HAT', 'HAT', 'test-hat', 2, 3, 5, 20)", hat, hat.toString());
        jdbc.update("INSERT INTO gm_character_item (character_item_id, character_id, item_id) VALUES (?, ?, ?)", hatOwned, character, hat);
        return hatOwned;
    }

    @Test void hatsEnforceLevelAndSlotAndBothEquipmentStatsAreAddedOnce() {
        UUID hatOwned = hat();
        assertThrows(ResponseStatusException.class, () -> items.equipHat(member, character, hatOwned));
        jdbc.update("UPDATE gm_character SET level = 2 WHERE character_id = ?", character);
        assertThrows(ResponseStatusException.class, () -> items.equipHat(member, character, owned));
        assertThrows(ResponseStatusException.class, () -> items.equipWeapon(member, character, hatOwned));
        jdbc.update("UPDATE gm_item SET attack = 7, defense = 2, hp = 10 WHERE item_id = ?", item);
        items.equipWeapon(member, character, owned); items.equipHat(member, character, hatOwned);
        var characters = new CharacterService(jdbc, items);
        var stats = characters.list(member).getFirst();
        assertEquals(140, stats.maxHp()); assertEquals(22, stats.attack()); assertEquals(10, stats.defense());
        assertEquals(2, items.inventory(member, character).stream().filter(ItemService.InventoryItemResponse::equipped).count());
        assertEquals(20, items.inventory(member, character).stream().filter(i -> i.itemType().equals("HAT")).findFirst().orElseThrow().hp());
        items.equipHat(member, character, null);
        stats = characters.list(member).getFirst();
        assertEquals(120, stats.maxHp()); assertEquals(19, stats.attack()); assertEquals(5, stats.defense());
        jdbc.update("UPDATE gm_item SET status = 'INACTIVE' WHERE item_id = ?", item);
        stats = characters.list(member).getFirst();
        assertEquals(110, stats.maxHp()); assertEquals(12, stats.attack()); assertEquals(3, stats.defense());
        assertNull(stats.weapon());
    }

    @Test void totalStatsDoNotOverflowIntegerRange() {
        UUID hatOwned = hat();
        jdbc.update("UPDATE gm_character SET level = 2 WHERE character_id = ?", character);
        jdbc.update("UPDATE gm_item SET attack = 2147483647 WHERE item_id IN (?, (SELECT item_id FROM gm_character_item WHERE character_item_id = ?))", item, hatOwned);
        items.equipWeapon(member, character, owned); items.equipHat(member, character, hatOwned);
        assertEquals(4294967306L, new CharacterService(jdbc, items).list(member).getFirst().attack());
    }
}
