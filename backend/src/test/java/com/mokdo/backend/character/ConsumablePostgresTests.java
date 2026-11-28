package com.mokdo.backend.character;

import java.util.UUID;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "HEALING_TEST_POSTGRES_URL", matches = ".+")
class ConsumablePostgresTests {
    private static JdbcTemplate jdbc;
    private static TransactionTemplate transactions;
    private static ItemService items;
    private UUID member, character, potion, owned;

    @BeforeAll static void migrate() {
        String url = System.getenv("HEALING_TEST_POSTGRES_URL");
        if (!url.startsWith("jdbc:postgresql://127.0.0.1:") || !url.endsWith("/healing_test")) {
            throw new IllegalArgumentException("A disposable local healing_test DB is required");
        }
        Flyway.configure().dataSource(url, "healing_test", "healing_test_password").load().migrate();
        var source = new DriverManagerDataSource(url, "healing_test", "healing_test_password");
        jdbc = new JdbcTemplate(source);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(source));
        items = new ItemService(jdbc);
    }

    @BeforeEach void setup() {
        member = UUID.randomUUID(); character = UUID.randomUUID(); potion = UUID.randomUUID(); owned = UUID.randomUUID();
        UUID costume = jdbc.queryForObject("SELECT costume_id FROM gm_costume WHERE is_default", UUID.class);
        jdbc.update("INSERT INTO mb_member (member_id) VALUES (?)", member);
        jdbc.update("INSERT INTO mb_member_costume (member_costume_id, member_id, costume_id) VALUES (?, ?, ?)", UUID.randomUUID(), member, costume);
        jdbc.update("INSERT INTO gm_character (character_id, member_id, slot_no, nickname, equipped_costume_id, current_hp) VALUES (?, ?, 1, ?, ?, 20)", character, member, character.toString(), costume);
        jdbc.update("INSERT INTO gm_item (item_id, item_code, name, item_type, heal_hp) VALUES (?, ?, '회복약', 'CONSUMABLE', 50)", potion, potion.toString());
        jdbc.update("INSERT INTO gm_character_item (character_item_id, character_id, item_id, quantity) VALUES (?, ?, ?, 2)", owned, character, potion);
    }

    private ItemService.ConsumeResponse use() {
        return transactions.execute(status -> items.consume(member, character, owned));
    }
    private long hp() {
        return jdbc.queryForObject("SELECT current_hp FROM gm_character WHERE character_id = ?", Long.class, character);
    }
    private int quantity() {
        return jdbc.queryForObject("SELECT COALESCE(SUM(quantity), 0) FROM gm_character_item WHERE character_item_id = ?", Integer.class, owned);
    }

    @Test void healsClampsToMaxHpAndDeletesLastOwnedItem() {
        assertEquals(50, items.inventory(member, character).getFirst().healHp());
        assertEquals(50, use().healedHp());
        assertEquals(70, hp()); assertEquals(1, quantity());
        assertEquals(30, use().healedHp());
        assertEquals(100, hp()); assertEquals(0, quantity());
        assertThrows(ResponseStatusException.class, this::use);
    }

    @Test void rejectsFullNullDeadUnownedInactiveAndNonHealingItemsWithoutConsumption() {
        for (Long value : new Long[]{100L, null, 0L, 150L}) {
            jdbc.update("UPDATE gm_character SET current_hp = ? WHERE character_id = ?", value, character);
            assertThrows(ResponseStatusException.class, this::use);
            assertEquals(2, quantity());
        }
        jdbc.update("UPDATE gm_character SET current_hp = 20 WHERE character_id = ?", character);
        var error = assertThrows(ResponseStatusException.class,
                () -> transactions.execute(status -> items.consume(UUID.randomUUID(), character, owned)));
        assertEquals(404, error.getStatusCode().value());
        assertThrows(ResponseStatusException.class,
                () -> transactions.execute(status -> items.consume(member, character, UUID.randomUUID())));
        jdbc.update("UPDATE gm_item SET status = 'INACTIVE' WHERE item_id = ?", potion);
        assertThrows(ResponseStatusException.class, this::use);
        jdbc.update("UPDATE gm_item SET status = 'ACT', heal_hp = 0 WHERE item_id = ?", potion);
        assertThrows(ResponseStatusException.class, this::use);
        jdbc.update("UPDATE gm_item SET item_type = 'MATERIAL' WHERE item_id = ?", potion);
        assertThrows(ResponseStatusException.class, this::use);
        assertEquals(20, hp()); assertEquals(2, quantity());
    }

    @Test void usesEligibleEquipmentForMaximumHp() {
        UUID hat = UUID.randomUUID(), hatOwned = UUID.randomUUID();
        jdbc.update("INSERT INTO gm_item (item_id, item_code, name, item_type, equip_slot_code, appearance_code, hp) VALUES (?, ?, '모자', 'HAT', 'HAT', 'hat', 40)", hat, hat.toString());
        jdbc.update("INSERT INTO gm_character_item (character_item_id, character_id, item_id) VALUES (?, ?, ?)", hatOwned, character, hat);
        transactions.executeWithoutResult(status -> items.equipHat(member, character, hatOwned));
        jdbc.update("UPDATE gm_character SET current_hp = 120 WHERE character_id = ?", character);
        var result = use();
        assertEquals(140, result.maxHp()); assertEquals(20, result.healedHp()); assertEquals(140, hp());
        jdbc.update("UPDATE gm_item SET required_level = 2 WHERE item_id = ?", hat);
        assertThrows(ResponseStatusException.class, this::use);
        assertEquals(1, quantity());
    }

    @Test void rollsBackBothHealthAndInventoryAndEnforcesSchemaConstraints() {
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(status -> {
            items.consume(member, character, owned);
            throw new IllegalStateException("rollback");
        }));
        assertEquals(20, hp()); assertEquals(2, quantity());
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE gm_item SET heal_hp = -1 WHERE item_id = ?", potion));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE gm_item SET item_type = 'MATERIAL' WHERE item_id = ?", potion));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE gm_item SET heal_hp = NULL WHERE item_id = ?", potion));
    }

    @Test void discardsStackOnlyForOwnerAndConfirmedQuantity() {
        assertThrows(ResponseStatusException.class, () -> transactions.executeWithoutResult(status -> items.discard(UUID.randomUUID(), character, owned, 2)));
        assertThrows(ResponseStatusException.class, () -> transactions.executeWithoutResult(status -> items.discard(member, character, UUID.randomUUID(), 2)));
        for (int count : new int[]{-1, 0, 1, 3}) {
            var error = assertThrows(ResponseStatusException.class, () -> transactions.executeWithoutResult(status -> items.discard(member, character, owned, count)));
            assertEquals(409, error.getStatusCode().value());
            assertEquals(2, quantity());
        }
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(status -> {
            items.discard(member, character, owned, 2);
            throw new IllegalStateException("rollback");
        }));
        assertEquals(2, quantity());
        transactions.executeWithoutResult(status -> items.discard(member, character, owned, 2));
        assertEquals(0, quantity());
        assertEquals(20, hp());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM gm_item WHERE item_id = ?", Integer.class, potion));
    }

    @Test void deletesEquipmentReferenceBeforeOwnedItem() {
        var weapon = transactions.execute(status -> items.grantDefaultWeapon(character));
        transactions.executeWithoutResult(status -> items.discard(member, character, weapon.characterItemId(), 1));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_equipment WHERE character_id = ?", Integer.class, character));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_item WHERE character_item_id = ?", Integer.class, weapon.characterItemId()));
        assertEquals(2, quantity());
    }

    @Test void concurrentRequestsCannotConsumeLastPotionTwice() throws Exception {
        jdbc.update("UPDATE gm_character_item SET quantity = 1 WHERE character_item_id = ?", owned);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> task = () -> {
                start.await();
                try { use(); return true; }
                catch (ResponseStatusException expected) { return false; }
            };
            var first = executor.submit(task); var second = executor.submit(task);
            start.countDown();
            assertNotEquals(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
        }
        assertEquals(70, hp()); assertEquals(0, quantity());
    }
}
