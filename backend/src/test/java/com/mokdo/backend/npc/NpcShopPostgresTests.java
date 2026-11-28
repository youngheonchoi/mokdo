package com.mokdo.backend.npc;

import java.util.UUID;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "SHOP_TEST_POSTGRES_URL", matches = ".+")
class NpcShopPostgresTests {
    private static JdbcTemplate jdbc;
    private static TransactionTemplate transactions;
    private static NpcShopService shops;
    private UUID member, character, npc, item, offer;

    @BeforeAll static void migrate() {
        String url = System.getenv("SHOP_TEST_POSTGRES_URL");
        if (!url.startsWith("jdbc:postgresql://127.0.0.1:") || !url.endsWith("/shop_test")) {
            throw new IllegalArgumentException("A disposable local shop_test DB is required");
        }
        Flyway.configure().dataSource(url, "shop_test", "shop_test_password").load().migrate();
        var source = new DriverManagerDataSource(url, "shop_test", "shop_test_password");
        jdbc = new JdbcTemplate(source);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(source));
        shops = new NpcShopService(jdbc);
    }
    @BeforeEach void setup() {
        member = UUID.randomUUID(); character = UUID.randomUUID(); npc = UUID.randomUUID(); item = UUID.randomUUID(); offer = UUID.randomUUID();
        UUID costume = jdbc.queryForObject("SELECT costume_id FROM gm_costume WHERE is_default", UUID.class);
        jdbc.update("INSERT INTO mb_member (member_id) VALUES (?)", member);
        jdbc.update("INSERT INTO mb_member_costume (member_costume_id, member_id, costume_id) VALUES (?, ?, ?)", UUID.randomUUID(), member, costume);
        jdbc.update("INSERT INTO gm_character (character_id, member_id, slot_no, nickname, equipped_costume_id, currency) VALUES (?, ?, 1, ?, ?, 100)", character, member, character.toString(), costume);
        jdbc.update("INSERT INTO gm_npc (npc_id, npc_code, name, dialogue, status) VALUES (?, ?, '상인', '어서오세요', 'ACT')", npc, npc.toString());
        jdbc.update("INSERT INTO gm_item (item_id, item_code, name, item_type, heal_hp) VALUES (?, ?, '회복약', 'CONSUMABLE', 50)", item, item.toString());
        jdbc.update("INSERT INTO gm_npc_shop_item (npc_shop_item_id, npc_id, item_id, price) VALUES (?, ?, ?, 30)", offer, npc, item);
    }
    private NpcShopService.Purchase buy(int quantity, String price) {
        return transactions.execute(status -> shops.purchase(member, character, npc, offer, quantity, price));
    }
    private long balance() { return jdbc.queryForObject("SELECT currency FROM gm_character WHERE character_id = ?", Long.class, character); }
    private long quantity() { return jdbc.queryForObject("SELECT COALESCE(SUM(quantity), 0) FROM gm_character_item WHERE character_id = ?", Long.class, character); }

    @Test void loadsActiveNpcsAndOffersThenBuysAndStacksConsumables() {
        assertTrue(shops.npcs().stream().anyMatch(value -> value.npcId().equals(npc)));
        var shop = shops.shop(npc);
        assertEquals("어서오세요", shop.npc().dialogue()); assertEquals("30", shop.items().getFirst().price());
        assertEquals(50, shop.items().getFirst().healHp());
        assertEquals("40", buy(2, "30").currency());
        assertEquals(2, quantity()); assertEquals(40, balance());
        buy(1, "30"); assertEquals(3, quantity()); assertEquals(10, balance());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_item WHERE character_id = ?", Integer.class, character));
    }
    @Test void rejectsInsufficientCurrencyChangedPriceAndInvalidQuantity() {
        assertThrows(ResponseStatusException.class, () -> buy(4, "30"));
        var changed = assertThrows(ResponseStatusException.class, () -> buy(1, "1"));
        assertEquals(409, changed.getStatusCode().value());
        for (int count : new int[]{0, -1, 100}) assertThrows(ResponseStatusException.class, () -> buy(count, "30"));
        assertThrows(ResponseStatusException.class, () -> buy(1, null));
        assertThrows(ResponseStatusException.class, () -> buy(1, "-1"));
        assertEquals(100, balance()); assertEquals(0, quantity());
    }
    @Test void checksCharacterOwnershipNpcOfferOwnershipAndAllThreeStatuses() {
        var unowned = assertThrows(ResponseStatusException.class, () -> transactions.execute(status -> shops.purchase(UUID.randomUUID(), character, npc, offer, 1, "30")));
        assertEquals(404, unowned.getStatusCode().value());
        assertThrows(ResponseStatusException.class, () -> transactions.execute(status -> shops.purchase(member, character, npc, UUID.randomUUID(), 1, "30")));
        UUID other = UUID.randomUUID();
        jdbc.update("INSERT INTO gm_npc (npc_id, npc_code, name, status) VALUES (?, ?, '다른 상인', 'ACT')", other, other.toString());
        assertThrows(ResponseStatusException.class, () -> transactions.execute(status -> shops.purchase(member, character, other, offer, 1, "30")));
        jdbc.update("UPDATE gm_npc SET status = 'DRAFT' WHERE npc_id = ?", npc);
        assertThrows(ResponseStatusException.class, () -> buy(1, "30"));
        assertThrows(ResponseStatusException.class, () -> shops.shop(npc));
        assertTrue(shops.npcs().stream().noneMatch(value -> value.npcId().equals(npc)));
        jdbc.update("UPDATE gm_npc SET status = 'ACT' WHERE npc_id = ?", npc);
        jdbc.update("UPDATE gm_npc_shop_item SET sale_status = 'INACTIVE' WHERE npc_shop_item_id = ?", offer);
        assertTrue(shops.shop(npc).items().isEmpty()); assertThrows(ResponseStatusException.class, () -> buy(1, "30"));
        jdbc.update("UPDATE gm_npc_shop_item SET sale_status = 'ACT' WHERE npc_shop_item_id = ?", offer);
        jdbc.update("UPDATE gm_item SET status = 'INACTIVE' WHERE item_id = ?", item);
        assertTrue(shops.shop(npc).items().isEmpty()); assertThrows(ResponseStatusException.class, () -> buy(1, "30"));
        assertEquals(100, balance()); assertEquals(0, quantity());
    }
    @Test void grantsEquipmentAsSeparateInstancesAndHandlesFreeOffersAndFullStacks() {
        jdbc.update("UPDATE gm_item SET item_type = 'HAT', equip_slot_code = 'HAT', appearance_code = 'hat', heal_hp = 0 WHERE item_id = ?", item);
        buy(3, "30");
        assertEquals(3, jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_item WHERE character_id = ? AND quantity = 1", Integer.class, character));
        jdbc.update("DELETE FROM gm_character_item WHERE character_id = ?", character);
        jdbc.update("UPDATE gm_item SET item_type = 'CONSUMABLE', equip_slot_code = NULL WHERE item_id = ?", item);
        jdbc.update("UPDATE gm_npc_shop_item SET price = 0 WHERE npc_shop_item_id = ?", offer);
        jdbc.update("INSERT INTO gm_character_item (character_item_id, character_id, item_id, quantity) VALUES (?, ?, ?, 2147483647)", UUID.randomUUID(), character, item);
        buy(2, "0"); assertEquals(2147483649L, quantity()); assertEquals(10, balance());
    }
    @Test void protectsBigintPricesAndRollsBackCurrencyWithItemGrant() {
        jdbc.update("UPDATE gm_npc_shop_item SET price = ? WHERE npc_shop_item_id = ?", Long.MAX_VALUE, offer);
        assertEquals(Long.toString(Long.MAX_VALUE), shops.shop(npc).items().getFirst().price());
        assertThrows(ResponseStatusException.class, () -> buy(2, Long.toString(Long.MAX_VALUE)));
        assertEquals(100, balance()); assertEquals(0, quantity());
        jdbc.update("UPDATE gm_npc_shop_item SET price = 30 WHERE npc_shop_item_id = ?", offer);
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(status -> {
            shops.purchase(member, character, npc, offer, 2, "30"); throw new IllegalStateException("rollback");
        }));
        assertEquals(100, balance()); assertEquals(0, quantity());
    }
    @Test void serializesConcurrentPurchasesWithoutOverspending() throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> action = () -> {
                start.await();
                try { buy(2, "30"); return true; } catch (ResponseStatusException expected) { return false; }
            };
            var first = executor.submit(action); var second = executor.submit(action); start.countDown();
            assertNotEquals(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
        }
        assertEquals(40, balance()); assertEquals(2, quantity());
    }
}
