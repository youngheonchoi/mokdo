import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { equipItem, unequipItem } = await loadTS('../src/game/equipment.ts');
const { ITEMS, itemDetails, equipmentSlotFor } = await loadTS('../src/game/items.ts');
const { freshProfile, cloneProfile, parseProfile, ProgressStore, characterSaveKey } = await loadTS('../src/game/progression.ts');
const { trade } = await loadTS('../src/game/commerce.ts');

test('every equipment type equips only to its own slot and returns to the bag without duplication', () => {
    for (const [id,item] of Object.entries(ITEMS).filter(([,item])=>item.category==='equipment')) {
        const profile=freshProfile(); profile.bag[id]=2;
        const worn=equipItem(profile,item.slot,id).profile;
        assert.equal(worn.equipment[item.slot],id); assert.equal(worn.bag[id],1);
        assert.equal(profile.bag[id],2); assert.equal(profile.equipment[item.slot],null);
        assert.equal(equipItem(worn,item.slot,id).profile,undefined);
        const removed=unequipItem(worn,item.slot).profile;
        assert.equal(removed.bag[id],2); assert.equal(removed.equipment[item.slot],null);
        const wrong=item.slot==='head'?'weapon':'head';
        assert.equal(equipItem(profile,wrong,id).profile,undefined);
    }
});

test('invalid item, unowned gear and consumables cannot be equipped; bag limits block unequip atomically', () => {
    const profile=freshProfile(); profile.bag.healthPotion=3;
    for(const id of ['starterHat','healthPotion','moss','missing','__proto__']) assert.equal(equipItem(profile,'head',id).profile,undefined);
    assert.equal(equipmentSlotFor('__proto__'),null);
    profile.bag.starterHat=1;
    const worn=equipItem(profile,'head','starterHat').profile;
    worn.bag.starterHat=99999999;
    assert.equal(unequipItem(worn,'head').profile,undefined);
    assert.equal(worn.equipment.head,'starterHat');
});

test('worn gear cannot be sold, spare copies can be sold and save clones keep equipment independent', () => {
    const profile=freshProfile(); profile.bag.starterHat=1;
    const worn=equipItem(profile,'head','starterHat').profile;
    assert.equal(trade(worn,'equipment','sell','starterHat',1).profile,undefined);
    worn.bag.starterHat=1;
    const sold=trade(worn,'equipment','sell','starterHat',1).profile;
    assert.equal(sold.equipment.head,'starterHat'); assert.equal(sold.bag.starterHat,0);
    const copy=cloneProfile(sold); copy.equipment.head=null;
    assert.equal(sold.equipment.head,'starterHat');
});

test('equipment survives character save reloads while old saves default to empty equipment', () => {
    const legacy={version:1,xp:80,bag:{gold:900,moss:3,shard:0,core:0},kills:1,bossClears:0};
    const restored=parseProfile(JSON.stringify(legacy));
    assert.ok(Object.values(restored.equipment).every(id=>id===null));
    restored.bag.starterHat=1;
    const worn=equipItem(restored,'head','starterHat').profile;
    const data=new Map();const backend={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
    new ProgressStore(backend,characterSaveKey('one')).commit(worn);
    const reloaded=new ProgressStore(backend,characterSaveKey('one')).read();
    assert.equal(reloaded.equipment.head,'starterHat'); assert.equal(reloaded.bag.starterHat,0);assert.equal(reloaded.bag.gold,900);
    assert.equal(new ProgressStore(backend,characterSaveKey('two')).read().equipment.head,null);
    assert.throws(()=>parseProfile(JSON.stringify({...worn,equipment:{head:'starterSword'}})));
});

test('tooltip fields match each category, equipment excludes effects and descriptions', () => {
    assert.deepEqual(itemDetails('healthPotion').fields.map(field=>field.label),['설명','효과']);
    assert.deepEqual(itemDetails('moss').fields.map(field=>field.label),['설명']);
    for(const [id,item] of Object.entries(ITEMS)) {
        const detail=itemDetails(id);
        assert.equal(detail.name,item.name);
        assert.ok(detail.fields.every(field=>typeof field.value==='string'&&field.value.length>0));
        if(item.category==='equipment') assert.deepEqual(detail.fields.map(field=>field.label),['장비구분']);
    }
    assert.equal(itemDetails('starterArmor').fields[0].value,'갑옷 (전신)');
});
