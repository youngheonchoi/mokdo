package com.mokdo.backend.character;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="MONSTER_TEST_POSTGRES_URL",matches=".+")
class MonsterPostgresTests {
    private static JdbcTemplate jdbc;
    @BeforeAll static void migrate() {
        String url=System.getenv("MONSTER_TEST_POSTGRES_URL");
        if (!url.startsWith("jdbc:postgresql://127.0.0.1:") || !url.endsWith("/monster_test")) {
            throw new IllegalArgumentException("A disposable local monster_test DB is required");
        }
        Flyway.configure().dataSource(url,"monster_test","monster_test_password").load().migrate();
        jdbc=new JdbcTemplate(new DriverManagerDataSource(url,"monster_test","monster_test_password"));
    }
    @Test void validatesDefinitionsRewardsAndDropConstraints() {
        UUID monster=UUID.randomUUID(),drop=UUID.randomUUID();
        UUID item=jdbc.queryForObject("SELECT item_id FROM gm_item WHERE item_code='wooden-club'",UUID.class);
        jdbc.update("INSERT INTO gm_monster (monster_id,monster_code,name,reward_exp) VALUES (?,?,?,?)",monster,monster.toString(),"테스트",Long.MAX_VALUE);
        assertEquals(Long.MAX_VALUE,jdbc.queryForObject("SELECT reward_exp FROM gm_monster WHERE monster_id=?",Long.class,monster));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_monster SET max_hp=0 WHERE monster_id=?",monster));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_monster SET reward_currency=-1 WHERE monster_id=?",monster));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_monster SET status='UNKNOWN' WHERE monster_id=?",monster));
        jdbc.update("INSERT INTO gm_monster_drop (monster_drop_id,monster_id,item_id,drop_rate,min_quantity,max_quantity) VALUES (?,?,?,100,1,3)",drop,monster,item);
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("INSERT INTO gm_monster_drop (monster_drop_id,monster_id,item_id,drop_rate) VALUES (?,?,?,50)",UUID.randomUUID(),monster,item));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_monster_drop SET drop_rate=100.0001 WHERE monster_drop_id=?",drop));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_monster_drop SET min_quantity=4 WHERE monster_drop_id=?",drop));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("UPDATE gm_monster_drop SET item_id=? WHERE monster_drop_id=?",UUID.randomUUID(),drop));
        assertThrows(DataIntegrityViolationException.class,()->jdbc.update("DELETE FROM gm_monster WHERE monster_id=?",monster));
        jdbc.update("UPDATE gm_monster_drop SET drop_rate=0.0001 WHERE monster_drop_id=?",drop);
        assertEquals("0.0001",jdbc.queryForObject("SELECT drop_rate FROM gm_monster_drop WHERE monster_drop_id=?",java.math.BigDecimal.class,drop).toPlainString());
        jdbc.update("DELETE FROM gm_monster_drop WHERE monster_id=?",monster);
        jdbc.update("DELETE FROM gm_monster WHERE monster_id=?",monster);
    }
}
