import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { freshProfile, statsFor, xpProgress, levelOf, ProgressStore, SAVE_KEY, parseProfile } = await loadTS('../src/game/progression.ts');
const { rollLoot } = await loadTS('../src/game/items.ts');
const { CombatWorld } = await loadTS('../src/game/combat.ts');
const { BOSS_POSITION } = await loadTS('../src/game/maps.ts');
const placeAtBoss = world => { world.enemies.forEach(enemy => enemy.hp = 0); Object.assign(world.player, { x: BOSS_POSITION.x - 100, y: BOSS_POSITION.y }); };
const idle = { x: 0, y: 0, attack: false, dodge: false };
function advance(world, seconds, input = idle) {
    const events = [];
    for (let time = 0; time < seconds; time += 0.01) events.push(...world.step(0.01, input));
    return events;
}
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };

test('five levels have increasing stats, bounded XP and correct progress', () => {
    assert.equal(levelOf(0), 1); assert.equal(levelOf(80), 2); assert.equal(levelOf(660), 5);
    assert.deepEqual(statsFor(660), { level: 5, maxHp: 200, attack: 64 });
    assert.deepEqual(xpProgress(100), { current: 20, required: 130, percent: 20 / 130 * 100 });
    assert.equal(xpProgress(660).percent, 100);
});

test('save reload, defensive copy and explicit reset preserve only this game key', () => {
    const backend = storage(); backend.setItem('another-app', 'keep');
    const store = new ProgressStore(backend); const p = store.read();
    p.xp = 210; p.bag.gold = 120; p.bossClears = 1;
    store.commit(p); p.bag.gold = 0;
    const reloaded = new ProgressStore(backend);
    assert.equal(reloaded.read().bag.gold, 120); assert.equal(reloaded.read().xp, 210);
    reloaded.reset(); assert.equal(backend.getItem(SAVE_KEY), null);
    assert.equal(backend.getItem('another-app'), 'keep'); assert.equal(reloaded.read().xp, 0);
});

test('corrupt saves and unavailable/full storage do not crash gameplay', () => {
    for (const value of ['{broken', '{"version":2}', JSON.stringify({ ...freshProfile(), xp: -1 }), JSON.stringify({ ...freshProfile(), bag: { gold: 'bad' } })]) {
        const backend = storage(); backend.setItem(SAVE_KEY, value);
        const store = new ProgressStore(backend);
        assert.equal(store.read().xp, 0); assert.ok(store.message);
    }
    assert.throws(() => parseProfile(JSON.stringify({ ...freshProfile(), xp: 661 })));
    const failing = new ProgressStore({ getItem: () => null, setItem: () => { throw Error('Quota'); }, removeItem: () => { throw Error('Blocked'); } });
    const p = freshProfile(); p.bag.gold = 9; failing.commit(p);
    assert.equal(failing.read().bag.gold, 9); assert.ok(failing.message);
    assert.equal(failing.reset(), false); assert.equal(failing.read().bag.gold, 9);
    assert.ok(new ProgressStore(null).message);
});

test('normal mobs drop two bundles; every boss drops twelve with guaranteed rare and epic loot', () => {
    for (const random of [() => 0, () => 0.99999]) {
        const normal = rollLoot(false, random); const boss = rollLoot(true, random);
        assert.equal(normal.length, 2); assert.equal(boss.length, 12);
        assert.ok(boss.filter(d => d.item === 'gold').reduce((sum, d) => sum + d.amount, 0) >= 96);
        assert.equal(boss.filter(d => d.item === 'shard').length, 3);
        assert.equal(boss.find(d => d.item === 'core').amount, 1);
        assert.ok(normal.every(d => d.amount > 0));
    }
});

test('melee kills grant XP once, level up heals, loot requires pickup and cannot be collected twice', () => {
    const p = freshProfile(); p.xp = 70;
    const world = new CombatWorld('field', p, () => 0.5);
    world.enemies.slice(1).forEach(e => { e.hp = 0; e.respawn = 999; });
    const enemy = world.enemies[0]; world.player.x = enemy.x - 45; world.player.y = enemy.y;
    world.player.hp = 40;
    advance(world, 1.1, { ...idle, attack: true });
    assert.equal(enemy.hp, 0); assert.equal(world.profile.kills, 1);
    assert.equal(world.profile.xp, 88); assert.equal(world.player.hp, 125);
    assert.equal(world.drops.length, 2); assert.equal(world.profile.bag.gold, 0);
    advance(world, 0.7, { ...idle, collect: true });
    assert.equal(world.drops.length, 0); assert.equal(world.profile.bag.gold, 5);
    advance(world, 0.2, { ...idle, collect: true, attack: true });
    assert.equal(world.profile.bag.gold, 5); assert.equal(world.profile.kills, 1);
    world.player.x = 100; advance(world, 14);
    assert.equal(enemy.hp, enemy.maxHp);
});

test('range skill hits multiple mobs, respects cooldown and scales with level', () => {
    const p = freshProfile(); p.xp = 660;
    const world = new CombatWorld('field', p);
    world.enemies.forEach((e, i) => { e.x = world.player.x + 40 + i * 2; e.y = world.player.y; });
    world.step(0.01, { ...idle, skill: true });
    assert.equal(world.defeated, world.enemies.length); assert.equal(world.drops.length, world.enemies.length * 2);
    assert.equal(world.profile.xp, 660); assert.ok(world.skillCooldown > 4.9);
    world.step(0.01, { ...idle, skill: true });
    assert.equal(world.defeated, world.enemies.length);
});

test('ranged mobs launch visible projectiles; dodge blocks projectile damage', () => {
    const world = new CombatWorld('field');
    world.enemies.forEach(e => { e.hp = 0; e.respawn = 999; });
    const archer = world.enemies[1]; archer.hp = 64; archer.x = 850; archer.y = 450;
    archer.windup = 0.01; archer.target = { x: 700, y: 450 };
    world.player.x = 700; world.player.y = 450;
    world.step(0.01, idle); assert.equal(world.projectiles.length, 1);
    advance(world, 0.7); assert.equal(world.player.hp, 90);
    world.projectiles.push({ id: 1000, x: world.player.x, y: world.player.y, vx: 0, vy: 0, life: 2 });
    world.step(0.01, { ...idle, dodge: true }); assert.equal(world.player.hp, 90);
});

test('boss death showers loot once, allows collection before results and records first clear', () => {
    const world = new CombatWorld('boss', freshProfile(), () => 0.5);
    world.started = true; world.boss.hp = 32; placeAtBoss(world);
    world.step(0.01, { ...idle, attack: true });
    assert.equal(world.result.won, true); assert.equal(world.firstClear, true);
    assert.equal(world.drops.length, 12); assert.equal(world.profile.bossClears, 1);
    assert.equal(world.profile.bag.core, 0);
    advance(world, 0.3, { ...idle, x: 1, attack: true });
    assert.ok(world.player.x > BOSS_POSITION.x - 100); assert.equal(world.drops.length, 12);
    const result = world.leave();
    assert.equal(world.drops.length, 0); assert.equal(result.loot.core, 1);
    assert.equal(world.profile.bag.core, 1); assert.equal(world.profile.bossClears, 1);
    world.leave(); assert.equal(world.profile.bag.core, 1);
    const next = new CombatWorld('boss', world.profile); next.started = true; next.boss.hp = 32;
    placeAtBoss(next); next.step(0.01, { ...idle, attack: true });
    assert.equal(next.firstClear, false);
});

test('retreat does not grant a boss clear; field return collects pending drops', () => {
    const boss = new CombatWorld(); const r = boss.leave();
    assert.equal(r.won, false); assert.equal(r.retreated, true); assert.equal(boss.profile.bossClears, 0);
    const field = new CombatWorld('field');
    field.drops.push({ id: 1, item: 'gold', amount: 4, x: 1100, y: 600, age: 0 });
    const summary = field.leave(); assert.equal(summary.loot.gold, 4); assert.equal(summary.mode, 'field');
});
