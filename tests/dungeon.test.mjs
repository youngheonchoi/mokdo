import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { CombatWorld } = await loadTS('../src/game/combat.ts');
const { TOWN_MAP, FIELD_MAP, DUNGEON_MAP, DUNGEON_GATE_X, BOSS_ARENA, BOSS_POSITION, SPIKE_TRAPS, onWalkableFloor, spikeState } = await loadTS('../src/game/maps.ts');
const { walkExplorer } = await loadTS('../src/game/navigation.ts');
const idle = { x: 0, y: 0, attack: false };
function advance(world, seconds, input = idle) { for (let i = 0; i < seconds * 100; i++) world.step(0.01, input); }
const unlock = world => world.enemies.forEach(enemy => { enemy.hp = 0; enemy.respawn = 0; });

test('town and field extend past the viewport and preserve movement outside the first screen', () => {
    assert.ok(TOWN_MAP.width > 1280 && TOWN_MAP.height > 800);
    const point = { x: 1800, y: 950 };
    for (let i = 0; i < 50; i++) walkExplorer(point, { x: 1, y: 0 }, 0.01, TOWN_MAP.obstacles);
    assert.ok(point.x > 1900);
    const field = new CombatWorld('field'); field.player.x = 2800; field.player.y = 1500;
    advance(field, 1, { ...idle, x: 1 });
    assert.ok(field.player.x > 3000);
    advance(field, 3, { ...idle, y: 1 });
    assert.equal(field.player.y, FIELD_MAP.bounds.y + FIELD_MAP.bounds.height);
});

test('dungeon floor connects rooms but does not allow walking through exterior walls', () => {
    assert.equal(onWalkableFloor({ x: 1500, y: 700 }, DUNGEON_MAP), true);
    assert.equal(onWalkableFloor({ x: 1500, y: 400 }, DUNGEON_MAP), false);
    const world = new CombatWorld();
    advance(world, 4, { ...idle, y: -1 });
    assert.ok(world.player.y >= 314 && world.player.y < 320);
});

test('all entrance mobs must be defeated to open the passage and they never respawn', () => {
    const world = new CombatWorld(); world.player.x = 1150; world.player.y = 760;
    advance(world, 0.8, { ...idle, x: 1 });
    assert.ok(world.player.x <= DUNGEON_GATE_X - 18);
    assert.equal(world.started, false);
    unlock(world); advance(world, 1, { ...idle, x: 1 });
    assert.ok(world.player.x > DUNGEON_GATE_X);
    assert.equal(world.dungeonStage, 'spikes');
    advance(world, 20);
    assert.ok(world.enemies.every(enemy => enemy.hp === 0));
});

test('spikes show idle and warning before becoming active; safe lanes avoid damage', () => {
    assert.equal(spikeState(0.5, 0), 'idle');
    assert.equal(spikeState(1.8, 0), 'warning');
    assert.equal(spikeState(2.8, 0), 'active');
    const trap = SPIKE_TRAPS[0];
    const world = new CombatWorld(); unlock(world);
    world.player.x = trap.x + 50; world.player.y = trap.y + 60;
    world.elapsed = 1.8; world.step(0.01, idle); assert.equal(world.player.hp, 100);
    world.elapsed = 2.8; world.step(0.01, idle); assert.equal(world.player.hp, 82);
    const safe = new CombatWorld(); unlock(safe); safe.player.x = trap.x + 50; safe.player.y = 830;
    safe.elapsed = 2.8; safe.step(0.01, idle); assert.equal(safe.player.hp, 100);

});

test('boss remains dormant through the corridor and the battle stays inside its arena', () => {
    const world = new CombatWorld(); unlock(world);
    world.player.x = 2300; world.player.y = 700;
    world.step(0.01, idle); assert.equal(world.started, false);
    world.player.x = 2800; world.player.y = BOSS_POSITION.y;
    world.step(0.01, idle); assert.equal(world.started, true);
    assert.equal(world.dungeonStage, 'boss');
    advance(world, 2, { ...idle, x: -1 });
    assert.ok(world.player.x >= BOSS_ARENA.x + 14);
});
