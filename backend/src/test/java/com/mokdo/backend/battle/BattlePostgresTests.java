package com.mokdo.backend.battle;

import com.mokdo.backend.character.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="BATTLE_TEST_POSTGRES_URL",matches=".+")
class BattlePostgresTests {
    static JdbcTemplate jdbc;
    static TransactionTemplate tx;
    static DataSourceTransactionManager manager;
    BattleService battles;
    CharacterService characters;
    MutableClock clock;
    UUID member,character,monster;
    BattleService.State entered;
    long seq;
    static class MutableClock extends Clock {
        Instant now=Instant.parse("2026-11-27T00:00:00Z");
        public ZoneId getZone(){return ZoneOffset.UTC;}
        public Clock withZone(ZoneId zone){return this;}
        public Instant instant(){return now;}
        void advance(long millis){now=now.plusMillis(millis);}
    }
    @BeforeAll static void migrate() {
        String url=System.getenv("BATTLE_TEST_POSTGRES_URL");
        if(!url.startsWith("jdbc:postgresql://127.0.0.1:")||!url.endsWith("/battle_test"))throw new IllegalArgumentException("Disposable local battle_test DB required");
        var source=new DriverManagerDataSource(url,"battle_test","battle_test_password");
        Flyway.configure().dataSource(source).load().migrate();
        jdbc=new JdbcTemplate(source);
        manager=new DataSourceTransactionManager(source);
        tx=new TransactionTemplate(manager);
    }
    @BeforeEach void setup() {
        // The URL guard above restricts this reset to a dedicated disposable DB.
        for(String table:List.of("gm_character_equipment","gm_character_item","gm_character","mb_member_costume","mb_member","gm_monster_drop","gm_monster"))jdbc.update("DELETE FROM "+table);
        jdbc.update("UPDATE gm_character_level SET required_exp=100");
        jdbc.update("DELETE FROM gm_character_level WHERE level>1");
        jdbc.update("UPDATE gm_character_level SET max_hp=100,attack=10,defense=2,required_exp=100 WHERE level=1");
        jdbc.update("INSERT INTO gm_character_level(level,max_hp,attack,defense,required_exp) VALUES(2,130,15,3,200),(3,160,20,4,NULL)");
        member=UUID.randomUUID();monster=UUID.randomUUID();clock=new MutableClock();
        jdbc.update("INSERT INTO mb_member(member_id) VALUES(?)",member);
        characters=new CharacterService(jdbc,new ItemService(jdbc));
        character=tx.execute(status->characters.create(member,1,"테스트모험가")).characterId();
        jdbc.update("INSERT INTO gm_monster(monster_id,monster_code,name,max_hp,attack,defense,reward_exp,reward_currency,status) VALUES(?,'tmffkdla','슬라임',10,5,0,350,25,'ACT')",monster);
        battles=new BattleService(jdbc,characters,clock,manager);
        entered=tx.execute(status->battles.enter(member,character));seq=0;
        battles.sessions.get(character).x=720;
    }
    BattleService.Command command(boolean attack) {return new BattleService.Command(entered.sessionId(),++seq,0,0,attack,false,false);}
    BattleService.State tick(boolean attack) {var command=command(attack);return tx.execute(status->battles.tick(member,character,command));}
    UUID drop(String type,int chance,int quantity) {
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO gm_item(item_id,item_code,name,item_type,equip_slot_code,appearance_code) VALUES(?,?,?, ?,?,?)",id,id.toString(),"획득아이템",type,List.of("WEAPON","HAT").contains(type)?type:null,List.of("WEAPON","HAT").contains(type)?"test-item":null);
        jdbc.update("INSERT INTO gm_monster_drop(monster_drop_id,monster_id,item_id,drop_rate,min_quantity,max_quantity) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),monster,id,chance,quantity,quantity);
        return id;
    }
    @Test void killPaysDropsAndMultipleLevelsOnceEvenWithConcurrentDuplicateAndReconnect() throws Exception {
        UUID material=drop("MATERIAL",100,2),weapon=drop("WEAPON",100,2),never=drop("MATERIAL",0,1);
        var command=command(true);
        try(var executor=Executors.newFixedThreadPool(2)) {
            Callable<BattleService.State> attack=()->tx.execute(status->battles.tick(member,character,command));
            var results=executor.invokeAll(List.of(attack,attack));
            int rewardResponses=0;
            for(var result:results) {
                var state=result.get();
                assertEquals(0,state.monster().hp());
                rewardResponses += state.effects().stream().anyMatch(effect -> effect.kind().equals("EXP")) ? 1 : 0;
            }
            assertEquals(1,rewardResponses);
        }
        var c=characters.list(member).getFirst();
        assertEquals(3,c.level());assertEquals(50,c.exp());assertEquals(25,c.currency());assertEquals(160,c.currentHp());
        assertEquals(2,jdbc.queryForObject("SELECT quantity FROM gm_character_item WHERE character_id=? AND item_id=?",Integer.class,character,material));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_item WHERE character_id=? AND item_id=? AND quantity=1",Integer.class,character,weapon));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_item WHERE item_id=?",Integer.class,never));
        assertTrue(tick(true).effects().isEmpty());assertEquals(25,characters.list(member).getFirst().currency());
        var reentered=tx.execute(status->battles.enter(member,character));assertEquals(0,reentered.monster().hp());
        entered=reentered;seq=0;clock.advance(5100);assertEquals(10,tick(false).monster().hp());
        assertThrows(ResponseStatusException.class,()->tx.execute(status->battles.tick(member,character,command)));
        tick(true);
        assertEquals(50,characters.list(member).getFirst().currency());
        assertEquals(4,jdbc.queryForObject("SELECT quantity FROM gm_character_item WHERE character_id=? AND item_id=?",Integer.class,character,material));
        assertEquals(4,jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_item WHERE character_id=? AND item_id=? AND quantity=1",Integer.class,character,weapon));
    }
    @Test void invalidDropRollsBackKillExperienceCurrencyAndItemsTogether() {
        drop("WEAPON",100,1001);
        assertThrows(ResponseStatusException.class,()->tick(true));
        assertEquals(10,battles.sessions.get(character).monsterHp);
        assertEquals(0,battles.sessions.get(character).seq);
        var c=characters.list(member).getFirst();assertEquals(0,c.exp());assertEquals(0,c.currency());assertEquals(1,c.level());
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM gm_character_item WHERE character_id=?",Integer.class,character));
    }
    @Test void playerDeathPersistsAcrossReentryAndRevivesWithoutRewardLoss() {
        jdbc.update("UPDATE gm_monster SET attack=1000 WHERE monster_id=?",monster);
        battles.sessions.get(character).x=780;
        var dead=tick(false);assertEquals(0,dead.character().currentHp());assertNotNull(dead.player().reviveAt());
        entered=tx.execute(status->battles.enter(member,character));seq=0;assertEquals(0,entered.character().currentHp());
        clock.advance(5001);var alive=tick(false);assertEquals(100,alive.character().currentHp());assertEquals(400,alive.player().x());assertEquals(0,alive.character().currency());
    }
    @Test void serverRejectsUnownedOrMalformedCommandsAndEnforcesCooldownRangeAndPause() {
        assertThrows(ResponseStatusException.class,()->tx.execute(status->battles.enter(UUID.randomUUID(),character)));
        assertEquals(entered.sessionId(),battles.sessions.get(character).session);
        assertThrows(ResponseStatusException.class,()->tx.execute(status->battles.tick(member,character,new BattleService.Command(entered.sessionId(),1,Integer.MIN_VALUE,0,true,false,false))));
        jdbc.update("UPDATE gm_monster SET max_hp=100 WHERE monster_id=?",monster);
        battles.sessions.get(character).monsterHp=100;
        assertEquals(90,tick(true).monster().hp());assertEquals(90,tick(true).monster().hp());
        clock.advance(400);assertEquals(80,tick(true).monster().hp());
        var paused=new BattleService.Command(entered.sessionId(),++seq,1,0,true,false,true);
        clock.advance(1000);var stopped=tx.execute(status->battles.tick(member,character,paused));assertEquals(720,stopped.player().x());assertEquals(80,stopped.monster().hp());
        battles.sessions.get(character).y=430;clock.advance(400);assertEquals(80,tick(true).monster().hp());
    }
    @Test void jumpAvoidsContactDamageOnlyDuringAirbornePhase() {
        battles.sessions.get(character).x=780;
        battles.sessions.get(character).monsterAttackAt=clock.instant().plusMillis(100);
        var jump=new BattleService.Command(entered.sessionId(),++seq,0,0,false,true,false);
        tx.execute(status->battles.tick(member,character,jump));
        clock.advance(100);assertEquals(100,tick(false).character().currentHp());
        clock.advance(500);assertEquals(97,tick(false).character().currentHp());
    }
    @Test void serverRestartResetsBattleButKeepsProgressAndDeletionNeedsNoBattleTables() {
        tick(true);
        var other=new BattleService(jdbc,characters,clock,manager);
        var restarted=other.enter(member,character);
        assertEquals(25,restarted.character().currency());
        assertEquals(3,restarted.character().level());
        assertEquals(50,restarted.character().exp());
        assertEquals(160,restarted.character().currentHp());
        assertEquals(10,restarted.monster().hp());
        assertEquals(400,restarted.player().x());
        assertTrue(restarted.effects().isEmpty());
        tx.executeWithoutResult(status->characters.delete(member,character,"테스트모험가"));
        assertThrows(ResponseStatusException.class,()->other.enter(member,character));
        assertFalse(other.sessions.containsKey(character));
    }
    @Test void delayedAccumulatedMovementKeepsDistanceAndRequestSpamCannotIncreaseSpeed() {
        clock.advance(600);
        var delayed=new BattleService.Command(entered.sessionId(),++seq,1,0,false,false,false,126.0,0.0);
        var result=battles.tick(member,character,delayed);
        assertEquals(846,result.player().x(),.001);
        double before=result.player().x();
        for(int index=0;index<10;index++) {
            result=battles.tick(member,character,new BattleService.Command(entered.sessionId(),++seq,1,0,false,false,false,10000.0,0.0));
        }
        assertTrue(result.player().x()-before<=52.501);
        var invalid=new BattleService.Command(entered.sessionId(),++seq,1,0,false,false,false,Double.NaN,0.0);
        assertThrows(ResponseStatusException.class,()->battles.tick(member,character,invalid));
    }
    @Test void bufferedContactStrikesAreProcessedOnceAndOldMonsterLifeCannotBeHit() {
        jdbc.update("UPDATE gm_monster SET max_hp=100 WHERE monster_id=?",monster);
        battles.sessions.get(character).monsterHp=100;
        clock.advance(800);
        var strikes=List.of(new BattleService.Strike(1,1,720,560,800,560,"east"),
                new BattleService.Strike(2,1,720,560,800,560,"east"));
        var command=new BattleService.Command(entered.sessionId(),++seq,0,0,false,false,false,0.0,0.0,strikes);
        var result=battles.tick(member,character,command);
        assertEquals(80,result.monster().hp());assertEquals(2,result.lastAttackId());
        assertEquals(2,result.effects().stream().filter(effect->effect.kind().equals("MONSTER_HIT")).count());
        assertEquals(1,result.effects().stream().filter(effect->effect.kind().equals("MONSTER_HIT")).findFirst().orElseThrow().attackId());
        var repeated=battles.tick(member,character,new BattleService.Command(entered.sessionId(),++seq,0,0,false,false,false,0.0,0.0,strikes));
        assertEquals(80,repeated.monster().hp());assertTrue(repeated.effects().isEmpty());
        battles.sessions.get(character).generation++;
        clock.advance(400);
        var stale=new BattleService.Strike(3,1,720,560,800,560,"east");
        result=battles.tick(member,character,new BattleService.Command(entered.sessionId(),++seq,0,0,false,false,false,0.0,0.0,List.of(stale)));
        assertEquals(80,result.monster().hp());assertEquals(3,result.lastAttackId());
    }
    @Test void contactSnapshotMustBeInRangeAndBufferedAttacksAreRateLimited() {
        jdbc.update("UPDATE gm_monster SET max_hp=100 WHERE monster_id=?",monster);
        battles.sessions.get(character).monsterHp=100;
        var miss=new BattleService.Strike(1,1,720,430,800,560,"east");
        var result=battles.tick(member,character,new BattleService.Command(entered.sessionId(),++seq,0,0,false,false,false,0.0,0.0,List.of(miss)));
        assertEquals(100,result.monster().hp());
        clock.advance(400);
        var hit=new BattleService.Strike(2,1,720,560,800,560,"east");
        var spam=new BattleService.Strike(3,1,720,560,800,560,"east");
        result=battles.tick(member,character,new BattleService.Command(entered.sessionId(),++seq,0,0,false,false,false,0.0,0.0,List.of(hit,spam)));
        assertEquals(90,result.monster().hp());assertEquals(3,result.lastAttackId());
        var bad=new BattleService.Strike(4,1,Double.NaN,560,800,560,"east");
        assertThrows(ResponseStatusException.class,()->battles.tick(member,character,new BattleService.Command(entered.sessionId(),++seq,0,0,false,false,false,0.0,0.0,List.of(bad))));
    }
    @Test void migrationRemovesBothTransientTablesAndKeepsCharacterColumns() {
        assertNull(jdbc.queryForObject("SELECT to_regclass('gm_character_battle')",String.class));
        assertNull(jdbc.queryForObject("SELECT to_regclass('gm_character_battle_event')",String.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_name='gm_character' AND column_name IN ('current_hp','currency')",Integer.class));
    }
}
