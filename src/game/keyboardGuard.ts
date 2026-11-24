import type { Scene } from 'phaser';
import { QUICKSLOT_KEYS } from './quickslots';

const GAME_CODES = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft', 'ControlRight',
    'Space', 'Escape', 'KeyI', ...QUICKSLOT_KEYS.map(key => `Key${key}`)
]);
const DIALOG_CODES = new Set(['Tab', 'Enter', 'NumpadEnter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Delete', 'Backspace']);
const EDIT_CODES = new Set(['KeyA', 'KeyC', 'KeyV', 'KeyX', 'KeyZ', 'KeyY', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Backspace', 'Delete']);
type Context = 'game' | 'dialog' | 'input';
type KeyEvent = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'metaKey'>;

export function keyboardPolicy(event: KeyEvent, context: Context): 'game' | 'ui' | 'block' {
    if (context === 'input') {
        if ((event.ctrlKey || event.metaKey) && !event.altKey && EDIT_CODES.has(event.code)) return 'ui';
        if (event.ctrlKey || event.metaKey || event.altKey || /^F\d+$/.test(event.code)) return 'block';
        return 'ui';
    }
    if (event.altKey || event.metaKey) return 'block';
    if (context === 'dialog') {
        if (event.ctrlKey) return 'block';
        if (event.code === 'KeyI' || event.code === 'Escape') return 'game';
        return DIALOG_CODES.has(event.code) ? 'ui' : 'block';
    }
    // Ctrl is the attack key, so Ctrl + a configured quickslot still belongs to the game.
    return GAME_CODES.has(event.code) ? 'game' : 'block';
}

/** Suppress only events delivered to this focused game; OS-reserved shortcuts remain outside its control. */
export function installKeyboardGuard(scene: Scene, root: HTMLElement): () => void {
    const contextFor = (event: KeyboardEvent): Context | null => {
        if (!scene.sys.isActive() || !root.isConnected || document.hidden || !document.hasFocus()) return null;
        const focus = document.activeElement;
        if (focus && focus !== document.body && focus !== scene.game.canvas && !root.contains(focus)) return null;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return 'input';
        return root.querySelector('dialog[open]') ? 'dialog' : 'game';
    };
    const capture = (event: KeyboardEvent) => {
        const context = contextFor(event);
        if (!context || context === 'game' && event.type === 'keyup' && GAME_CODES.has(event.code)) return;
        if (keyboardPolicy(event, context) === 'block') {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    const bubble = (event: KeyboardEvent) => {
        const context = contextFor(event);
        if (context && keyboardPolicy(event, context) !== 'ui') event.preventDefault();
    };
    // Phaser ignores defaultPrevented events. Allow game keys through its listener
    // before cancelling their browser default, and reject unrelated keys earlier.
    window.addEventListener('keydown', capture, true);
    window.addEventListener('keyup', capture, true);
    window.addEventListener('keydown', bubble);
    window.addEventListener('keyup', bubble);
    return () => {
        window.removeEventListener('keydown', capture, true);
        window.removeEventListener('keyup', capture, true);
        window.removeEventListener('keydown', bubble);
        window.removeEventListener('keyup', bubble);
    };
}
