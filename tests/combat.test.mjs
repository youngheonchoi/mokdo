import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';

const { CombatWorld, OBSTACLES, distance, isInWarning } = await loadTS('../src/game/combat.ts');
const { BOSS_POSITION, FIELD_MAP } = await loadTS('../src/game/maps.ts');
const placeAtBoss = world => { world.enemies.forEach(enemy => enemy.hp = 0); Object.assign(world.player, { x: BOSS_POSITION.x - 100, y: BOSS_POSITION.y }); };
const idle = { x: 0, y: 0, attack: false };
const advance = (world, seconds, input = idle) => {
    const events = [];
    for (let elapsed = 0; elapsed < seconds - 0.00001; elapsed += 0.01) events.push(...world.step(0.01, input));
    return events;
};
const warning = (kind, x = 900, y = 390) => ({ kind, x, y, angle: 0, remaining: 0.005, duration: 1 });

test('diagonal movement has the same speed as straight movement', () => {
    const straight = new CombatWorld();
    const diagonal = new CombatWorld();
    const origin = { ...straight.player };
    advance(straight, 0.3, { ...idle, x: 1 });
    advance(diagonal, 0.3, { ...idle, x: 1, y: 1 });
    assert.ok(Math.abs(distance(origin, straight.player) - distance(origin, diagonal.player)) < 0.001);
});

test('trees, rocks and map borders block walking', () => {
    for (const obstacle of OBSTACLES) {
        const world = new CombatWorld('field');
        world.player.x = obstacle.x - obstacle.radius - 45;
        world.player.y = obstacle.y;
        advance(world, 0.5, { ...idle, x: 1 });
        assert.ok(distance(world.player, obstacle) >= obstacle.radius + 14);
    }
    const world = new CombatWorld('field');
    advance(world, 5, { ...idle, x: -1 });
    assert.equal(world.player.x, FIELD_MAP.bounds.x);
    advance(world, 5, { ...idle, y: 1 });
    assert.equal(world.player.y, FIELD_MAP.bounds.y + FIELD_MAP.bounds.height);
});

test('boss waits for entry; attacks have range and cooldown', () => {
    const world = new CombatWorld();
    advance(world, 5, { ...idle, attack: true });
    assert.equal(world.started, false);
    assert.equal(world.boss.hp, world.boss.maxHp);
    placeAtBoss(world);
    world.player.attackCooldown = 0;
    world.step(0.01, { ...idle, attack: true });
    const hp = world.boss.hp;
    advance(world, 0.1, { ...idle, attack: true });
    assert.equal(world.boss.hp, hp);
    advance(world, 0.6, { ...idle, attack: true });
    assert.ok(world.boss.hp < hp);
});

test('circle and directional line use the telegraphed hit geometry', () => {
    assert.equal(isInWarning({ x: 990, y: 390 }, warning('circle')), true);
    assert.equal(isInWarning({ x: 1100, y: 390 }, warning('circle')), false);
    assert.equal(isInWarning({ x: 1000, y: 390 }, warning('line')), true);
    assert.equal(isInWarning({ x: 800, y: 390 }, warning('line')), false);
    assert.equal(isInWarning({ x: 1000, y: 480 }, warning('line')), false);
    assert.equal(isInWarning({ x: 900, y: 490 }, { ...warning('line'), angle: Math.PI / 2 }), true);
});

test('regular hit deals damage once and removed dash input grants no movement or immunity', () => {
    const normal = new CombatWorld(); normal.started = true;
    normal.warning = warning('circle', normal.player.x, normal.player.y);
    normal.step(0.01, idle);
    assert.equal(normal.player.hp, 80);
    advance(normal, 0.5);
    assert.equal(normal.player.hp, 80);
    const removedDash = new CombatWorld(); removedDash.started = true;
    const origin = { x: removedDash.player.x, y: removedDash.player.y };
    removedDash.warning = warning('circle', origin.x, origin.y);
    const events = removedDash.step(0.01, { ...idle, dodge: true });
    assert.equal(removedDash.player.hp, 80);
    assert.equal(removedDash.player.x, origin.x);
    assert.equal(removedDash.player.y, origin.y);
    assert.ok(events.every(event => event.kind !== 'dodge'));
});

test('half health starts phase two with a reachable safe-zone mechanic', () => {
    const world = new CombatWorld();
    placeAtBoss(world);
    world.started = true; world.boss.hp = world.boss.maxHp / 2;
    advance(world, 0.7);
    assert.equal(world.phase, 2);
    assert.equal(world.warning.kind, 'safe');
    assert.equal(world.warning.duration, 3.4);
    assert.ok(distance(world.player, world.warning) < 3.4 * 215);
});

test('safe zone protects the entire player; damage immunity cannot bypass it', () => {
    const inside = new CombatWorld(); inside.started = true;
    inside.warning = warning('safe', inside.player.x, inside.player.y);
    inside.step(0.01, idle);
    assert.equal(inside.player.hp, 100);
    const outside = new CombatWorld(); outside.started = true;
    outside.warning = warning('safe', 900, 390);
    outside.player.invulnerable = 1;
    outside.step(0.01, idle);
    assert.equal(outside.player.hp, 64);
});

test('victory freezes combat time, defeat stops simulation and a fresh run resets state', () => {
    const win = new CombatWorld(); win.started = true; win.boss.hp = 32;
    placeAtBoss(win);
    win.step(0.01, { ...idle, attack: true });
    assert.equal(win.result.won, true);
    assert.equal(win.result.hits, 1);
    const elapsed = win.elapsed;
    advance(win, 1);
    assert.equal(win.elapsed, elapsed);
    const lose = new CombatWorld(); lose.started = true; lose.player.hp = 20;
    lose.warning = warning('circle', lose.player.x, lose.player.y);
    lose.step(0.01, idle);
    assert.equal(lose.result.won, false);
    assert.equal(lose.player.hp, 0);
    const fresh = new CombatWorld();
    assert.equal(fresh.player.hp, 100);
    assert.equal(fresh.boss.hp, 1920);
    assert.equal(fresh.warning, null);
    assert.equal(fresh.result, null);
    assert.equal(fresh.phase, 1);
});
