package com.mokdo.backend.battle;

import com.mokdo.backend.character.CharacterService;
import com.mokdo.backend.character.CharacterService.CharacterResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;
import static com.mokdo.backend.battle.BattleRules.*;

@Service
public class BattleService {
    private final JdbcTemplate jdbc;
    private final CharacterService characters;
    private final Clock clock;
    private final TransactionTemplate transactions;
    private final Object[] locks = new Object[64];
    final ConcurrentMap<UUID, Battle> sessions = new ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public BattleService(JdbcTemplate jdbc, CharacterService characters, PlatformTransactionManager manager) {
        this(jdbc, characters, Clock.systemUTC(), manager);
    }
    BattleService(JdbcTemplate jdbc, CharacterService characters, Clock clock, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.characters = characters;
        this.clock = clock;
        this.transactions = new TransactionTemplate(manager);
        this.transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        Arrays.setAll(locks, index -> new Object());
    }

    // Publish the copied in-memory battle only after the DB transaction commits.
    // The character lock prevents concurrent requests from paying the same kill.
    private State execute(UUID characterId, Supplier<Outcome> work) {
        synchronized (locks[Math.floorMod(characterId.hashCode(), locks.length)]) {
            Outcome outcome = Objects.requireNonNull(transactions.execute(status -> work.get()));
            sessions.put(characterId, outcome.battle());
            return outcome.state();
        }
    }

    public State enter(UUID member, UUID characterId) {
        return execute(characterId, () -> {
            CharacterResponse character = lockCharacter(member, characterId);
            Monster monster = monster();
            Instant now = clock.instant();
            sessions.entrySet().removeIf(entry -> entry.getValue().lastTick.isBefore(now.minusSeconds(1800)));
            Battle previous = sessions.get(characterId);
            Battle battle = previous == null || !previous.monster.equals(monster.monsterId())
                    ? new Battle(monster, now) : previous.copy();
            battle.session = UUID.randomUUID();
            battle.seq = 0;
            battle.lastAttackId = 0;
            battle.lastTick = now;
            jdbc.update("UPDATE gm_character SET current_hp=? WHERE character_id=?", character.currentHp(), characterId);
            return new Outcome(state(member, characterId, battle, monster, List.of()), battle);
        });
    }

    public State tick(UUID member, UUID characterId, Command command) {
        if (command == null || command.sessionId() == null || command.seq() < 1
                || Math.abs((long) command.moveX()) > 1 || Math.abs((long) command.moveY()) > 1
                || (command.travelX() == null) != (command.travelY() == null)
                || (command.travelX() != null && (!Double.isFinite(command.travelX()) || !Double.isFinite(command.travelY())
                    || Math.abs(command.travelX()) > 10000 || Math.abs(command.travelY()) > 10000))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "전투 입력을 확인해 주세요.");
        }
        if (command.strikes() != null) {
            if (command.strikes().size() > 8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "공격 입력이 너무 많아요.");
            long previousId = 0;
            for (Strike strike : command.strikes()) {
                if (strike == null || strike.id() <= previousId || strike.generation() < 1
                        || !("east".equals(strike.facing()) || "west".equals(strike.facing()))
                        || !floorPosition(strike.x(), strike.y()) || !floorPosition(strike.targetX(), strike.targetY())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "공격 입력을 확인해 주세요.");
                }
                previousId = strike.id();
            }
        }
        return execute(characterId, () -> tickLocked(member, characterId, command));
    }

    private Outcome tickLocked(UUID member, UUID characterId, Command command) {
        CharacterResponse character = lockCharacter(member, characterId);
        Battle previous = sessions.get(characterId);
        if (previous == null || !command.sessionId().equals(previous.session)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "전투가 초기화됐거나 다른 화면에서 입장했어요. 캐릭터 선택으로 돌아가 다시 입장해 주세요.");
        }
        Battle battle = previous.copy();
        Monster monster = monster();
        if (!monster.monsterId().equals(battle.monster)) throw new ResponseStatusException(HttpStatus.CONFLICT, "몬스터 설정이 바뀌었어요. 다시 입장해 주세요.");
        List<Effect> effects = new ArrayList<>();
        if (command.seq() <= battle.seq) return new Outcome(state(member, characterId, battle, monster, effects), battle);
        Instant now = clock.instant();
        double dt = clamp(Duration.between(battle.lastTick, now).toMillis(), 0, 1000) / 1000;
        battle.seq = command.seq();
        battle.lastTick = now;
        battle.attackCredit = Math.min(4, battle.attackCredit + dt / .4);
        long hp = Math.min(character.currentHp(), character.maxHp());
        if (hp == 0) {
            if (battle.reviveAt == null) battle.reviveAt = now.plusSeconds(5);
            if (!now.isBefore(battle.reviveAt)) {
                hp = character.maxHp(); battle.reviveAt = null;
                battle.x = 400; battle.y = 560;
                battle.monsterX = 800; battle.monsterY = 560; battle.returning = false;
                // A living monster recovers when the player revives. A killed one
                // retains its respawn timer, so revival cannot generate extra rewards.
                if (battle.monsterHp > 0) { battle.monsterHp = monster.maxHp(); battle.generation++; }
                battle.monsterAttackAt = now.plusSeconds(1);
                effect(effects, "REVIVE", hp, "", battle.x, battle.y);
            }
        } else if (!command.paused()) {
            if (command.moveX() != 0) battle.facing = command.moveX() > 0 ? "east" : "west";
            double distance = Math.hypot(command.moveX(), command.moveY());
            if (command.travelX() == null) {
                // Compatibility with clients using direction-only input.
                if (distance > 0) {
                    battle.x = clamp(battle.x + command.moveX() / distance * 210 * dt, 72, 3528);
                    battle.y = clamp(battle.y + command.moveY() / distance * 126 * dt, 430, 690);
                }
            } else {
                // Accept accumulated client input, bounded by server elapsed time.
                // A small saved allowance absorbs request jitter without permitting
                // movement speed to grow with the number of requests.
                battle.movementCredit = Math.min(1.25, battle.movementCredit + dt);
                double seconds = Math.hypot(command.travelX(), command.travelY() / .6) / 210;
                double ratio = seconds > 0 ? Math.min(1, battle.movementCredit / seconds) : 1;
                battle.x = clamp(battle.x + command.travelX() * ratio, 72, 3528);
                battle.y = clamp(battle.y + command.travelY() * ratio, 430, 690);
                battle.movementCredit = Math.min(.25, Math.max(0, battle.movementCredit - seconds * ratio));
            }
            if (command.jump() && !now.isBefore(battle.jumpUntil)) battle.jumpUntil = now.plusMillis(480);
            battle.monsterHp = Math.min(battle.monsterHp, monster.maxHp());
            if (battle.monsterHp == 0 && battle.respawnAt != null && !now.isBefore(battle.respawnAt)) {
                battle.monsterHp = monster.maxHp(); battle.monsterX = 800; battle.monsterY = 560; battle.returning = false;
                battle.generation++;
                battle.respawnAt = null; battle.monsterAttackAt = now.plusSeconds(1);
                effect(effects, "SPAWN", 0, "", battle.monsterX, battle.monsterY);
            }
            if (command.strikes() != null) {
                for (Strike strike : command.strikes()) {
                    if (strike.id() <= battle.lastAttackId) continue;
                    battle.lastAttackId = strike.id();
                    if (battle.attackCredit < .999 || battle.monsterHp == 0 || strike.generation() != battle.generation) continue;
                    battle.attackCredit = Math.max(0, battle.attackCredit - 1);
                    battle.attackAt = now.plusMillis(400);
                    // Validate the displayed contact snapshot against recent server
                    // positions. Damage and rewards always use server-owned stats.
                    boolean recent = Math.abs(strike.x() - battle.x) <= 336 && Math.abs(strike.y() - battle.y) <= 202
                            && Math.abs(strike.targetX() - battle.monsterX) <= 185 && Math.abs(strike.targetY() - battle.monsterY) <= 112;
                    if (recent && inRange(strike.x(), strike.y(), strike.targetX(), strike.targetY(), strike.facing())) {
                        if (hit(characterId, character, monster, battle, effects, now, strike.id())) hp = owned(member, characterId).maxHp();
                    }
                }
            } else if (command.attack() && !now.isBefore(battle.attackAt)) {
                battle.attackAt = now.plusMillis(400);
                battle.attackCredit = Math.max(0, battle.attackCredit - 1);
                if (battle.monsterHp > 0 && inRange(battle.x, battle.y, battle.monsterX, battle.monsterY, battle.facing)) {
                    if (hit(characterId, character, monster, battle, effects, now, null)) hp = owned(member, characterId).maxHp();
                }
            }
            if (battle.monsterHp > 0) {
                MonsterMotion motion = moveMonster(battle.monsterX, battle.monsterY, battle.returning, battle.x, battle.y, dt);
                battle.monsterX = clamp(motion.x(), 72, 3528);
                battle.monsterY = clamp(motion.y(), 430, 690);
                battle.returning = motion.returning();
                long jumpLeft = Duration.between(now, battle.jumpUntil).toMillis();
                boolean airborne = jumpLeft > 80 && jumpLeft < 430;
                if (!battle.returning && Math.abs(battle.x - battle.monsterX) <= 55 && Math.abs(battle.y - battle.monsterY) <= 32
                        && !now.isBefore(battle.monsterAttackAt) && !airborne) {
                    long damage = Math.min(hp, damage(monster.attack(), character.defense()));
                    hp -= damage; battle.monsterAttackAt = now.plusMillis(1200);
                    effect(effects, "PLAYER_HIT", damage, "", battle.x, battle.y);
                    if (hp == 0) {
                        battle.reviveAt = now.plusSeconds(5);
                        effect(effects, "PLAYER_DIED", 0, "", battle.x, battle.y);
                    }
                }
            }
        }
        jdbc.update("UPDATE gm_character SET current_hp=?,mod_dtm=CURRENT_TIMESTAMP WHERE character_id=?", hp, characterId);
        return new Outcome(state(member, characterId, battle, monster, effects), battle);
    }

    private static boolean floorPosition(double x, double y) {
        return Double.isFinite(x) && Double.isFinite(y) && x >= 72 && x <= 3528 && y >= 430 && y <= 690;
    }

    private boolean hit(UUID characterId, CharacterResponse character, Monster monster, Battle battle,
                        List<Effect> effects, Instant now, Long attackId) {
        long amount = Math.min(battle.monsterHp, damage(character.attack(), monster.defense()));
        battle.monsterHp -= amount;
        effects.add(new Effect("MONSTER_HIT", amount, "", battle.monsterX, battle.monsterY, attackId));
        if (battle.monsterHp > 0) return false;
        battle.respawnAt = now.plusSeconds(5);
        effect(effects, "MONSTER_DIED", 0, "", battle.monsterX, battle.monsterY);
        return reward(characterId, character, monster, battle, effects);
    }

    private boolean reward(UUID characterId, CharacterResponse character, Monster monster, Battle battle, List<Effect> effects) {
        var levels = jdbc.query("SELECT level,required_exp FROM gm_character_level ORDER BY level FOR SHARE",
                (rs, row) -> new Level(rs.getInt("level"), rs.getObject("required_exp") == null ? 0 : rs.getLong("required_exp")));
        Growth growth = grow(character.level(), character.exp(), monster.rewardExp(), levels);
        long currency = addCapped(character.currency(), monster.rewardCurrency());
        jdbc.update("UPDATE gm_character SET level=?,exp=?,currency=? WHERE character_id=?", growth.level(), growth.exp(), currency, characterId);
        effect(effects, "EXP", monster.rewardExp(), "", battle.monsterX, battle.monsterY);
        effect(effects, "CURRENCY", currency - character.currency(), "", battle.monsterX, battle.monsterY);
        var drops = jdbc.query("""
                SELECT i.item_id,i.name,i.item_type,d.drop_rate,d.min_quantity,d.max_quantity
                FROM gm_monster_drop d JOIN gm_item i ON i.item_id=d.item_id
                WHERE d.monster_id=? AND i.status='ACT' ORDER BY d.monster_drop_id FOR SHARE OF i,d
                """, (rs, row) -> new Drop(rs.getObject("item_id", UUID.class), rs.getString("name"), rs.getString("item_type"),
                rs.getBigDecimal("drop_rate").movePointRight(4).intValueExact(), rs.getInt("min_quantity"), rs.getInt("max_quantity")), monster.monsterId());
        long equipmentCount = 0;
        for (Drop drop : drops) {
            if (ThreadLocalRandom.current().nextInt(1_000_000) >= drop.chance()) continue;
            int quantity = (int) ThreadLocalRandom.current().nextLong(drop.min(), (long) drop.max() + 1);
            if (List.of("WEAPON", "HAT").contains(drop.type())) {
                equipmentCount += quantity;
                if (equipmentCount > 1000) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "한 번에 지급하는 장비 드롭은 1000개 이하로 설정해 주세요.");
                jdbc.update("INSERT INTO gm_character_item (character_item_id,character_id,item_id,quantity) SELECT gen_random_uuid(),?,?,1 FROM generate_series(1,?)",
                        characterId, drop.id(), quantity);
            } else {
                var stacks = jdbc.query("SELECT character_item_id FROM gm_character_item WHERE character_id=? AND item_id=? AND quantity<=? ORDER BY reg_dtm LIMIT 1",
                        (rs, row) -> rs.getObject(1, UUID.class), characterId, drop.id(), Integer.MAX_VALUE - quantity);
                if (stacks.isEmpty()) jdbc.update("INSERT INTO gm_character_item (character_item_id,character_id,item_id,quantity) VALUES (?,?,?,?)", UUID.randomUUID(), characterId, drop.id(), quantity);
                else jdbc.update("UPDATE gm_character_item SET quantity=quantity+?,mod_dtm=CURRENT_TIMESTAMP WHERE character_item_id=?", quantity, stacks.getFirst());
            }
            effect(effects, "ITEM", quantity, drop.name(), battle.monsterX, battle.monsterY);
        }
        if (growth.level() > character.level()) effect(effects, "LEVEL_UP", growth.level(), "", battle.x, battle.y);
        return growth.level() > character.level();
    }

    private CharacterResponse lockCharacter(UUID member, UUID characterId) {
        var rows = jdbc.query("SELECT character_id FROM gm_character WHERE character_id=? AND member_id=? FOR UPDATE",
                (rs, row) -> rs.getObject(1, UUID.class), characterId, member);
        if (rows.isEmpty()) {
            if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM gm_character WHERE character_id=?)", Boolean.class, characterId))) {
                sessions.remove(characterId);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "캐릭터를 찾을 수 없어요.");
        }
        return owned(member, characterId);
    }
    private CharacterResponse owned(UUID member, UUID characterId) {
        return characters.list(member).stream().filter(c -> c.characterId().equals(characterId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "캐릭터를 찾을 수 없어요."));
    }
    private Monster monster() {
        return jdbc.query("SELECT monster_id,monster_code,name,level,max_hp,attack,defense,reward_exp,reward_currency FROM gm_monster WHERE monster_code='tmffkdla' AND status='ACT' FOR SHARE",
                (rs, row) -> new Monster(rs.getObject("monster_id", UUID.class), rs.getString("monster_code"), rs.getString("name"), rs.getInt("level"),
                rs.getLong("max_hp"), rs.getLong("attack"), rs.getLong("defense"), rs.getLong("reward_exp"), rs.getLong("reward_currency")))
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "관리자에서 tmffkdla 몬스터를 사용 중으로 설정해 주세요."));
    }
    private static void effect(List<Effect> effects, String kind, long amount, String label, double x, double y) {
        effects.add(new Effect(kind, amount, label, x, y, null));
    }
    private State state(UUID member, UUID id, Battle b, Monster monster, List<Effect> effects) {
        return new State(b.session,b.seq,clock.millis(),owned(member,id),new Player(b.x,b.y,b.facing,millis(b.reviveAt)),
                new Enemy(monster,b.monsterHp,b.monsterX,b.monsterY,millis(b.respawnAt),b.generation,b.returning),b.lastAttackId,List.copyOf(effects));
    }
    private static Long millis(Instant value) { return value == null ? null : value.toEpochMilli(); }
    static final class Battle implements Cloneable {
        UUID session,monster;
        long seq,monsterHp,lastAttackId,generation=1;
        double x=400,y=560,monsterX=800,monsterY=560,movementCredit=.25,attackCredit=1;
        String facing="east";
        boolean returning;
        Instant respawnAt,reviveAt,attackAt,monsterAttackAt,jumpUntil,lastTick;
        Battle(Monster definition, Instant now) {
            monster=definition.monsterId(); monsterHp=definition.maxHp();
            attackAt=monsterAttackAt=jumpUntil=lastTick=now;
        }
        // All fields are primitives or immutable values; copying isolates rollback.
        Battle copy() {
            try { return (Battle) super.clone(); }
            catch (CloneNotSupportedException exception) { throw new AssertionError(exception); }
        }
    }
    private record Outcome(State state, Battle battle) { }
    public record Command(UUID sessionId,long seq,int moveX,int moveY,boolean attack,boolean jump,boolean paused,Double travelX,Double travelY,List<Strike> strikes) {
        public Command(UUID sessionId,long seq,int moveX,int moveY,boolean attack,boolean jump,boolean paused,Double travelX,Double travelY) {
            this(sessionId,seq,moveX,moveY,attack,jump,paused,travelX,travelY,null);
        }
        public Command(UUID sessionId,long seq,int moveX,int moveY,boolean attack,boolean jump,boolean paused) {
            this(sessionId,seq,moveX,moveY,attack,jump,paused,null,null,null);
        }
    }
    public record Strike(long id,long generation,double x,double y,double targetX,double targetY,String facing) { }
    public record Monster(UUID monsterId,String monsterCode,String name,int level,long maxHp,long attack,long defense,long rewardExp,long rewardCurrency) { }
    public record Enemy(Monster definition,long hp,double x,double y,Long respawnAt,long generation,boolean returning) { }
    public record Player(double x,double y,String facing,Long reviveAt) { }
    public record Effect(String kind,long amount,String label,double x,double y,Long attackId) { }
    public record State(UUID sessionId,long seq,long serverTime,CharacterResponse character,Player player,Enemy monster,long lastAttackId,List<Effect> effects) { }
    private record Drop(UUID id,String name,String type,int chance,int min,int max) { }
}
