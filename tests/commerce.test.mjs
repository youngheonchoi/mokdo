import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { MERCHANTS, trade, applyCheat, nearestMerchant } = await loadTS('../src/game/commerce.ts');
const { freshProfile, parseProfile, ProgressStore, characterSaveKey } = await loadTS('../src/game/progression.ts');
const { ITEMS } = await loadTS('../src/game/items.ts');

test('four merchants stock one item per equipment slot and the general merchant stocks HP potions', () => {
    assert.deepEqual(MERCHANTS.map(m => m.stock.length), [4, 2, 3, 1]);
    const slots = MERCHANTS.flatMap(m => m.stock).map(id => ITEMS[id].slot).filter(Boolean);
    assert.equal(new Set(slots).size, 9);
    for (const m of MERCHANTS) {
        assert.equal(nearestMerchant(m).id, m.id);
        assert.equal(nearestMerchant({x:m.x, y:m.y+100}), undefined);
    }
});

test('cheats add exactly one level or 10000 gold and respect existing caps without mutating the source', () => {
    const profile = freshProfile();
    assert.equal(applyCheat(profile, 'level').xp, 80);
    assert.equal(profile.xp, 0);
    assert.equal(applyCheat(profile, 'gold').bag.gold, 10000);
    profile.xp = 660; profile.bag.gold = 99999995;
    assert.equal(applyCheat(profile, 'level').xp, 660);
    assert.equal(applyCheat(profile, 'gold').bag.gold, 99999999);
});

test('all stocked equipment can be bought and sold to the correct merchant with exact gold accounting', () => {
    for (const merchant of MERCHANTS) for (const id of merchant.stock) {
        const original = applyCheat(freshProfile(), 'gold');
        const bought = trade(original, merchant.id, 'buy', id, 2);
        assert.ok(bought.profile);
        assert.equal(bought.profile.bag[id], 2);
        assert.equal(bought.profile.bag.gold, 10000-ITEMS[id].buyPrice*2);
        assert.equal(original.bag[id], 0);
        const sold = trade(bought.profile, merchant.id, 'sell', id, 1);
        assert.equal(sold.profile.bag[id], 1);
        assert.equal(sold.profile.bag.gold, bought.profile.bag.gold+ITEMS[id].sellPrice);
    }
});

test('general merchant buys misc and consumables; invalid, overdrawn or cross-category trades are rejected atomically', () => {
    const profile = freshProfile(); profile.bag.moss = 3;
    const sold = trade(profile, 'general', 'sell', 'moss', 2);
    assert.equal(sold.profile.bag.gold, 10); assert.equal(sold.profile.bag.moss, 1);
    const invalid = [
        ['general','buy','healthPotion',1], ['general','sell','moss',4],
        ['general','buy','starterHat',1], ['weapons','sell','moss',1],
        ['general','sell','gold',1], ['general','buy','healthPotion',-1],
        ['general','buy','healthPotion',1.5], ['general','buy','healthPotion',NaN],
        ['general','buy','__proto__',1], ['missing','buy','healthPotion',1]
    ];
    const before = JSON.stringify(profile);
    for (const args of invalid) { assert.equal(trade(profile,...args).profile, undefined); assert.equal(JSON.stringify(profile),before); }
    const capped = applyCheat(profile,'gold'); capped.bag.healthPotion = 99999999;
    assert.equal(trade(capped,'general','buy','healthPotion',1).profile,undefined);
    capped.bag.gold=99999999;
    assert.equal(trade(capped,'general','sell','moss',1).profile,undefined);
});

test('legacy saves gain zero equipment counts; purchases persist per character without resetting XP or loot', () => {
    const legacy = {version:1,xp:210,bag:{gold:10000,moss:4,shard:2,core:1},kills:5,bossClears:1};
    const profile = parseProfile(JSON.stringify(legacy));
    assert.equal(profile.bag.starterHat,0); assert.equal(profile.bag.healthPotion,0);
    const data=new Map(); const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
    const store=new ProgressStore(storage,characterSaveKey('one'));
    const bought=trade(profile,'equipment','buy','starterHat',1).profile;
    store.commit(bought);
    const restored=new ProgressStore(storage,characterSaveKey('one')).read();
    assert.equal(restored.bag.starterHat,1);assert.equal(restored.xp,210);assert.equal(restored.bag.core,1);
    assert.equal(new ProgressStore(storage,characterSaveKey('two')).read().bag.starterHat,0);
});
