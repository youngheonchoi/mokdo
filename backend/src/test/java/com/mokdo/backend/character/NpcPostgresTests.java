package com.mokdo.backend.character;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="NPC_TEST_POSTGRES_URL",matches=".+")
class NpcPostgresTests {
    private static JdbcTemplate jdbc;

    @BeforeAll static void migrate() {
        String url=System.getenv("NPC_TEST_POSTGRES_URL");
        if (!url.startsWith("jdbc:postgresql://127.0.0.1:") || !url.endsWith("/npc_test")) {
            throw new IllegalArgumentException("A disposable local npc_test DB is required");
        }
        Flyway.configure().dataSource(url,"npc_test","npc_test_password").load().migrate();
        jdbc=new JdbcTemplate(new DriverManagerDataSource(url,"npc_test","npc_test_password"));
    }

    @Test void validatesNpcAndShopPriceUniquenessAndReferences() {
        UUID npc=UUID.randomUUID(),other=UUID.randomUUID(),entry=UUID.randomUUID();
        UUID item=jdbc.queryForObject("SELECT item_id FROM gm_item WHERE item_code='wooden-club'",UUID.class);
        jdbc.update("INSERT INTO gm_npc (npc_id,npc_code,name,dialogue) VALUES (?,?,?,?)",npc,npc.toString(),"잡화상","어서오세요");
        jdbc.update("INSERT INTO gm_npc (npc_id,npc_code,name) VALUES (?,?,?)",other,other.toString(),"다른 상인");
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_npc SET npc_code='../bad' WHERE npc_id=?",npc));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_npc SET status='UNKNOWN' WHERE npc_id=?",npc));
        jdbc.update("INSERT INTO gm_npc_shop_item (npc_shop_item_id,npc_id,item_id,price) VALUES (?,?,?,?)",entry,npc,item,Long.MAX_VALUE);
        assertEquals(Long.MAX_VALUE,jdbc.queryForObject("SELECT price FROM gm_npc_shop_item WHERE npc_shop_item_id=?",Long.class,entry));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("INSERT INTO gm_npc_shop_item (npc_shop_item_id,npc_id,item_id,price) VALUES (?,?,?,1)",UUID.randomUUID(),npc,item));
        jdbc.update("INSERT INTO gm_npc_shop_item (npc_shop_item_id,npc_id,item_id,price) VALUES (?,?,?,500)",UUID.randomUUID(),other,item);
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_npc_shop_item SET price=-1 WHERE npc_shop_item_id=?",entry));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_npc_shop_item SET sort_order=-1 WHERE npc_shop_item_id=?",entry));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_npc_shop_item SET sale_status='UNKNOWN' WHERE npc_shop_item_id=?",entry));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_npc_shop_item SET item_id=? WHERE npc_shop_item_id=?",UUID.randomUUID(),entry));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("DELETE FROM gm_npc WHERE npc_id=?",npc));
        jdbc.update("UPDATE gm_npc_shop_item SET price=0,sale_status='INACTIVE' WHERE npc_shop_item_id=?",entry);
        jdbc.update("DELETE FROM gm_npc_shop_item WHERE npc_id IN (?,?)",npc,other);
        jdbc.update("DELETE FROM gm_npc WHERE npc_id IN (?,?)",npc,other);
    }
}
