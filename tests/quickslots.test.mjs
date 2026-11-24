import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { QuickslotStore } = await loadTS('../src/game/quickslots.ts');
const { freshProfile, parseProfile, ProgressStore, characterSaveKey } = await loadTS('../src/game/progression.ts');
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };

test('registers only owned consumables, preserves quantities and validates slot bounds', () => {
    const bag = freshProfile().bag; bag.healthPotion = 3; bag.moss = 8;
    const store = new QuickslotStore(null);
    assert.equal(store.assign(0, 'healthPotion', bag), true);
    assert.equal(bag.healthPotion, 3);
    const copy = store.read(); copy[0] = null;
    assert.equal(store.read()[0], 'healthPotion');
    for (const [slot, id] of [[-1, 'healthPotion'], [10, 'healthPotion'], [0.5, 'healthPotion'], [1, 'moss'], [1, 'missing'], [1, '__proto__']]) assert.equal(store.assign(slot, id, bag), false);
    assert.equal(store.assign(1, 'healthPotion', { ...bag, healthPotion: 0 }), false);
    store.clear(0); assert.equal(store.read()[0], null); assert.equal(bag.healthPotion, 3);
});

test('bindings reload per character and combat saves cannot overwrite them', () => {
    const backend = storage();
    const key = characterSaveKey('one');
    const profile = new ProgressStore(backend, key);
    const staleCombat = profile.read();
    staleCombat.bag.healthPotion = 3;
    const bindings = new QuickslotStore(backend, `${key}.quickslots`);
    bindings.assign(2, 'healthPotion', staleCombat.bag);
    staleCombat.xp = 80; profile.commit(staleCombat);
    assert.equal(new QuickslotStore(backend, `${key}.quickslots`).read()[2], 'healthPotion');
    assert.ok(new QuickslotStore(backend, `${characterSaveKey('two')}.quickslots`).read().every(value => value === null));
});

test('legacy saves default the new consumable count without resetting progress', () => {
    const profile = freshProfile(); profile.xp = 210; profile.bag.gold = 250;
    delete profile.bag.healthPotion;
    const restored = parseProfile(JSON.stringify(profile));
    assert.equal(restored.xp, 210); assert.equal(restored.bag.gold, 250); assert.equal(restored.bag.healthPotion, 0);
    assert.throws(() => parseProfile(JSON.stringify({ ...restored, bag: { ...restored.bag, healthPotion: -1 } })));
});

test('corrupt bindings are ignored and storage failures keep the current session usable', () => {
    for (const raw of ['{bad', '[]', JSON.stringify(Array(12).fill('moss'))]) {
        const backend = storage(); backend.setItem('bindings', raw);
        const store = new QuickslotStore(backend, 'bindings');
        assert.ok(store.read().every(value => value === null)); assert.ok(store.message);
    }
    const store = new QuickslotStore({ getItem: () => null, setItem: () => { throw Error('quota'); } }, 'key');
    const bag = { ...freshProfile().bag, healthPotion: 2 };
    assert.equal(store.assign(0, 'healthPotion', bag), true);
    assert.equal(store.read()[0], 'healthPotion'); assert.ok(store.message);
});


test('ten-slot layout preserves legacy twelve-slot bindings and relocates overflow into free slots', () => {
    const backend = storage();
    const legacy = Array(12).fill(null); legacy[1] = 'healthPotion'; legacy[11] = 'healthPotion';
    backend.setItem('bindings', JSON.stringify(legacy));
    const store = new QuickslotStore(backend, 'bindings');
    assert.equal(store.read().length, 10);
    assert.equal(store.read()[1], 'healthPotion');
    assert.equal(store.read()[0], 'healthPotion');
    store.assign(9, 'healthPotion', { ...freshProfile().bag, healthPotion: 1 });
    assert.equal(JSON.parse(backend.getItem('bindings')).length, 10);
    assert.equal(new QuickslotStore(backend, 'bindings').read()[9], 'healthPotion');
});
