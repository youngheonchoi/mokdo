import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { keyboardPolicy } = await loadTS('../src/game/keyboardGuard.ts');
const key=(code,modifiers={})=>({code,ctrlKey:false,altKey:false,metaKey:false,...modifiers});

test('game keeps configured controls including Ctrl + quickslots but blocks unrelated browser shortcuts',()=>{
    for(const code of ['ArrowUp','Space','ControlLeft','Escape','KeyI','KeyQ','KeyS']) {
        assert.equal(keyboardPolicy(key(code),'game'),'game');
        assert.equal(keyboardPolicy(key(code,{ctrlKey:true}),'game'),'game');
    }
    for(const event of [key('KeyP',{ctrlKey:true}),key('KeyR',{metaKey:true}),key('ArrowLeft',{altKey:true}),key('F5'),key('Tab'),key('KeyJ')]) assert.equal(keyboardPolicy(event,'game'),'block');
});

test('dialogs retain navigation and inventory actions without leaking browser shortcuts',()=>{
    for(const code of ['Tab','Enter','Space','ArrowLeft','Delete']) assert.equal(keyboardPolicy(key(code),'dialog'),'ui');
    for(const code of ['KeyI','Escape']) assert.equal(keyboardPolicy(key(code),'dialog'),'game');
    assert.equal(keyboardPolicy(key('KeyP',{ctrlKey:true}),'dialog'),'block');
    assert.equal(keyboardPolicy(key('KeyQ'),'dialog'),'block');
});

test('quantity inputs retain editing shortcuts but suppress browser commands',()=>{
    for(const code of ['Digit2','Backspace','ArrowUp','Tab']) assert.equal(keyboardPolicy(key(code),'input'),'ui');
    for(const modifier of ['ctrlKey','metaKey']) {
        for(const code of ['KeyA','KeyC','KeyV','KeyZ']) assert.equal(keyboardPolicy(key(code,{[modifier]:true}),'input'),'ui');
        for(const code of ['KeyR','KeyP','KeyL']) assert.equal(keyboardPolicy(key(code,{[modifier]:true}),'input'),'block');
    }
    assert.equal(keyboardPolicy(key('F5'),'input'),'block');
});
