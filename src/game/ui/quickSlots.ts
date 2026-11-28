import type { InventoryItem } from '../types';

export const quickSlotKeys = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'] as const;
// Bind definitions, not owned-stack UUIDs. Future actions can add another kind.
export type QuickSlotBinding = { kind: 'item'; itemId: string };

export function mountQuickSlots(shell: HTMLElement, characterId: string,
    use: (binding: QuickSlotBinding) => void) {
    const storageKey = `mokdo.quickslots.v1.${characterId}`;
    let bindings: (QuickSlotBinding | null)[] = Array(8).fill(null);
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
        if (Array.isArray(saved)) bindings = bindings.map((_, index) => {
            const value = saved[index];
            return value?.kind === 'item' && typeof value.itemId === 'string' && value.itemId.length <= 64
                ? { kind: 'item', itemId: value.itemId } : null;
        });
    } catch { /* Slots also work when browser storage is unavailable. */ }
    const abort = new AbortController();
    const panel = document.createElement('section');
    panel.className = 'quickslots';
    panel.setAttribute('aria-label', '퀵슬롯');
    const grid = document.createElement('div');
    grid.className = 'quickslot-grid';
    const status = document.createElement('p');
    status.className = 'quickslot-status';
    status.setAttribute('role', 'status');
    const hint = document.createElement('p');
    hint.className = 'quickslot-hint';
    hint.textContent = '가방의 소비 아이템을 끌어 등록 · 우클릭으로 해제';
    const buttons = quickSlotKeys.map((_, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quickslot';
        button.dataset.quickslot = String(index);
        button.onclick = () => activate(index);
        button.oncontextmenu = event => { event.preventDefault(); clear(index); };
        button.onkeydown = event => {
            if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault(); clear(index);
            }
        };
        grid.append(button);
        return button;
    });
    panel.append(grid, hint, status);
    shell.append(panel);
    let items: InventoryItem[] = [];
    let unavailable = true;
    let blocked = false;
    const persist = () => {
        try { localStorage.setItem(storageKey, JSON.stringify(bindings)); } catch { /* Session-only fallback. */ }
    };
    const matching = (binding: QuickSlotBinding) => items.filter(item => item.itemId === binding.itemId && item.itemType === 'CONSUMABLE');
    function render() {
        buttons.forEach((button, index) => {
            const binding = bindings[index];
            const owned = binding ? matching(binding) : [];
            const item = owned[0];
            const quantity = owned.reduce((sum, value) => sum + value.quantity, 0);
            button.replaceChildren();
            const key = document.createElement('kbd');
            key.textContent = quickSlotKeys[index];
            button.append(key);
            if (binding) {
                const image = document.createElement('img');
                image.src = `/api/items/${encodeURIComponent(binding.itemId)}/image`;
                image.alt = ''; image.draggable = false;
                image.onerror = () => { image.hidden = true; };
                const count = document.createElement('span');
                count.className = 'quickslot-quantity'; count.textContent = String(quantity);
                button.append(image, count);
            }
            button.classList.toggle('depleted', !!binding && quantity === 0);
            button.classList.toggle('occupied', !!binding);
            button.setAttribute('aria-disabled', String(unavailable || blocked || !item || item.healHp <= 0));
            button.setAttribute('aria-label', `${quickSlotKeys[index]}: ${binding ? `${item?.name ?? '소비 아이템'}, 수량 ${quantity}` : '빈 퀵슬롯'}`);
            button.title = binding ? `${item?.name ?? '소비 아이템'} · ${quantity}개${item ? ` · HP ${item.healHp} 회복` : ''}\n우클릭 또는 Delete로 등록 해제` : '소비 아이템을 끌어 놓으세요';
        });
    }
    function activate(index: number) {
        const binding = bindings[index];
        if (unavailable || blocked || !binding) return;
        const item = matching(binding).find(item => item.quantity > 0);
        if (!item) { announce('등록한 아이템을 모두 사용했어요.'); return; }
        if (item.healHp <= 0) { announce('이 아이템에는 아직 사용할 수 있는 효과가 없어요.'); return; }
        use(binding);
    }
    function clear(index: number) {
        if (unavailable || blocked) return;
        bindings[index] = null; persist(); render(); announce(`${quickSlotKeys[index]} 퀵슬롯 등록을 해제했어요.`);
    }
    function announce(message: string, error = false) {
        status.textContent = message;
        status.classList.toggle('error', error);
    }
    window.addEventListener('keydown', event => {
        const target = event.target;
        if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || document.hidden
            || (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return;
        const index = quickSlotKeys.findIndex(key => event.code === `Key${key}` || (!event.code && event.key.toUpperCase() === key));
        if (index < 0 || unavailable || blocked) return;
        event.preventDefault(); activate(index);
    }, { signal: abort.signal });
    render();
    return {
        assign(index: number, item: InventoryItem) {
            if (!Number.isInteger(index) || index < 0 || index >= 8 || unavailable || blocked) return;
            if (item.itemType !== 'CONSUMABLE') { announce('지금은 소비 아이템만 등록할 수 있어요.', true); return; }
            bindings[index] = { kind: 'item', itemId: item.itemId };
            persist(); render(); announce(`${quickSlotKeys[index]}에 ${item.name}을 등록했어요.`);
        },
        update(next: InventoryItem[], disabled: boolean) { items = next; unavailable = disabled; render(); },
        setBlocked(value: boolean) { blocked = value; render(); },
        announce,
        dispose() { abort.abort(); panel.remove(); }
    };
}
