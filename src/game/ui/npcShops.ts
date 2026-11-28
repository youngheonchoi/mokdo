import { request } from '../../api/request';
import type { GameCharacter } from '../types';

type Npc = { npcId: string; npcCode: string; name: string; dialogue: string };
type ShopItem = { npcShopItemId: string; itemId: string; name: string; itemType: string; description: string;
    healHp: number; requiredLevel: number; attack: number; defense: number; hp: number; price: string };
type Shop = { npc: Npc; items: ShopItem[] };
const money = (value: string | bigint) => BigInt(value).toLocaleString();
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const node = document.createElement(tag); node.className = className;
    if (text) node.textContent = text;
    return node;
}

export function mountNpcShops(shell: HTMLElement, initial: GameCharacter,
    refreshInventory: () => Promise<void>, blockInput: (blocked: boolean) => void) {
    const abort = new AbortController();
    let character = initial;
    let disposed = false;
    let busy = false;
    let loading = false;
    let activeId: string | undefined;
    let lastFocus: HTMLElement | undefined;
    const actors: { button: HTMLButtonElement; x: number; y: number }[] = [];
    const layer = el('div', 'npc-layer');
    const notice = el('div', 'npc-notice');
    const reloadNpcs = el('button', 'game-tool', '상인 다시 불러오기');
    reloadNpcs.onclick = () => void loadNpcs();
    reloadNpcs.hidden = true;
    const noticeText = el('p', ''); noticeText.setAttribute('role', 'status');
    notice.append(noticeText, reloadNpcs);
    const backdrop = el('div', 'shop-backdrop'); backdrop.hidden = true;
    const panel = el('section', 'npc-shop item-window');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'npc-shop-title'); panel.tabIndex = -1;
    const header = el('div', 'item-window-header');
    const title = el('h2', '', '상점'); title.id = 'npc-shop-title';
    const close = el('button', 'item-close', '×'); close.type = 'button'; close.setAttribute('aria-label', '상점 닫기');
    const body = el('div', 'item-window-body');
    const dialogue = el('p', 'shop-dialogue');
    const balance = el('p', 'shop-balance');
    const status = el('p', 'item-status'); status.setAttribute('role', 'status');
    const list = el('div', 'shop-list');
    const retry = el('button', 'item-action', '상점 다시 불러오기'); retry.hidden = true;
    retry.onclick = () => { if (activeId) void loadShop(activeId); };
    body.append(dialogue, balance, status, retry, list); header.append(title, close); panel.append(header, body);
    backdrop.append(panel); shell.append(layer, notice, backdrop);
    const controls: { input: HTMLInputElement; button: HTMLButtonElement; total: HTMLElement; item: ShopItem }[] = [];
    function setStatus(message: string, error = false) { status.textContent = message; status.classList.toggle('error', error); }
    function sync() {
        balance.textContent = `보유 재화 ${(character.currency ?? 0).toLocaleString()}`;
        close.disabled = busy; retry.disabled = busy || loading;
        panel.setAttribute('aria-busy', String(busy || loading));
        for (const control of controls) {
            const quantity = control.input.valueAsNumber;
            const valid = Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;
            control.button.disabled = busy || loading || !valid;
            control.input.disabled = busy || loading;
            control.total.textContent = valid ? `합계 ${money(BigInt(control.item.price) * BigInt(quantity))} 재화` : '수량은 1~99개로 입력해 주세요.';
        }
    }
    function closeShop() {
        if (busy || backdrop.hidden) return;
        activeId = undefined; backdrop.hidden = true;
        blockInput(false); lastFocus?.focus({ preventScroll: true });
    }
    close.onclick = closeShop;
    backdrop.onclick = event => { if (event.target === backdrop) closeShop(); };
    // Also handle focus falling back to the page after a failed offer is reloaded.
    window.addEventListener('keydown', event => {
        if (backdrop.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeShop(); }
        if (event.key === 'Tab') {
            event.preventDefault(); event.stopPropagation();
            const focusable = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled):not([hidden]), input:not(:disabled)')];
            const index = focusable.indexOf(document.activeElement as HTMLElement);
            focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus();
        }
    }, { capture: true, signal: abort.signal });
    async function loadNpcs() {
        reloadNpcs.hidden = true;
        noticeText.textContent = '';
        try {
            const npcs = await request<Npc[]>('/api/npcs', { signal: abort.signal });
            if (disposed) return;
            layer.replaceChildren(); actors.length = 0;
            npcs.forEach((npc, index) => {
                const actor = el('button', 'npc-actor'); actor.type = 'button'; actor.hidden = true;
                actor.setAttribute('aria-label', `${npc.name} 상점 열기`);
                const label = el('span', 'npc-name', npc.name);
                const action = el('span', 'npc-action', '상점');
                const image = el('img', 'npc-image'); image.alt = ''; image.draggable = false;
                const placeholder = el('span', 'npc-placeholder', '상인'); placeholder.hidden = true;
                image.onerror = () => { image.hidden = true; placeholder.hidden = false; };
                image.src = `/api/npcs/${encodeURIComponent(npc.npcId)}/image`;
                actor.append(label, action, image, placeholder);
                actor.onclick = () => {
                    if (busy) return;
                    lastFocus = actor; activeId = npc.npcId; backdrop.hidden = false;
                    blockInput(true); panel.focus({ preventScroll: true });
                    void loadShop(npc.npcId);
                };
                layer.append(actor);
                // Stable registration order puts the two current merchants beside the spawn.
                actors.push({ button: actor, x: 260 + (index % 12) * 280, y: 510 + Math.floor(index / 12) * 70 });
            });
        } catch (cause) {
            if (disposed) return;
            noticeText.textContent = cause instanceof Error ? cause.message : '상인을 불러오지 못했어요.';
            reloadNpcs.hidden = false;
        }
    }
    async function loadShop(id: string) {
        loading = true; controls.length = 0; list.replaceChildren(); retry.hidden = true;
        title.textContent = '상점'; dialogue.textContent = ''; setStatus('판매 상품을 불러오고 있어요…'); sync();
        try {
            const shop = await request<Shop>(`/api/npcs/${encodeURIComponent(id)}/shop`, { signal: abort.signal });
            if (disposed || activeId !== id) return;
            title.textContent = `${shop.npc.name} 상점`; dialogue.textContent = shop.npc.dialogue;
            for (const item of shop.items) {
                const row = el('article', 'shop-item');
                const image = el('img', 'item-icon'); image.alt = ''; image.draggable = false;
                image.src = `/api/items/${encodeURIComponent(item.itemId)}/image`;
                image.onerror = () => { image.hidden = true; };
                const info = el('div', 'shop-item-info'); info.append(el('h3', '', item.name));
                if (item.description) info.append(el('p', 'item-caption', item.description));
                if (item.itemType === 'CONSUMABLE' && item.healHp > 0) info.append(el('p', 'item-bonuses', `HP ${item.healHp} 회복`));
                if (['WEAPON', 'HAT'].includes(item.itemType)) info.append(el('p', 'item-caption', `착용 레벨 ${item.requiredLevel} · 공격력 +${item.attack} / 방어력 +${item.defense} / 최대 체력 +${item.hp}`));
                info.append(el('p', 'shop-price', `개당 ${money(item.price)} 재화`));
                const label = el('label', 'shop-quantity', '수량');
                const input = el('input', ''); input.type = 'number'; input.min = '1'; input.max = '99'; input.step = '1'; input.value = '1';
                input.setAttribute('aria-label', `${item.name} 구매 수량`); input.oninput = sync;
                label.append(input);
                const total = el('p', 'shop-total');
                const button = el('button', 'item-action', '구매하기'); button.type = 'button';
                button.setAttribute('aria-label', `${item.name} 구매하기`);
                button.onclick = () => void purchase(id, item, input.valueAsNumber);
                const actions = el('div', 'shop-item-actions'); actions.append(label, total, button);
                controls.push({ input, button, total, item }); row.append(image, info, actions); list.append(row);
            }
            setStatus(shop.items.length ? '' : '지금 판매 중인 상품이 없어요.');
        } catch (cause) {
            if (disposed || activeId !== id) return;
            setStatus(cause instanceof Error ? cause.message : '상점 목록을 불러오지 못했어요.', true);
            retry.hidden = false;
        } finally {
            if (activeId === id) { loading = false; sync(); }
        }
    }
    async function purchase(npcId: string, item: ShopItem, quantity: number) {
        if (busy || loading || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
        busy = true; setStatus('구매하고 있어요…'); sync();
        try {
            const csrf = await request<{ headerName: string; token: string }>('/api/auth/csrf', { signal: abort.signal });
            if (disposed) return;
            const result = await request<{ name: string; quantity: number; currency: string }>(`/api/characters/${encodeURIComponent(character.characterId)}/npcs/${encodeURIComponent(npcId)}/purchases`, {
                method: 'POST', signal: abort.signal,
                headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                body: JSON.stringify({ shopItemId: item.npcShopItemId, quantity, unitPrice: item.price })
            });
            await refreshInventory();
            if (disposed) return;
            setStatus(`${result.name} ${result.quantity}개를 구매했어요.`);
        } catch (cause) {
            if (disposed) return;
            // Never retry a purchase automatically: refresh its result and the latest offer first.
            await refreshInventory();
            if (disposed) return;
            await loadShop(npcId);
            setStatus(cause instanceof Error ? cause.message : '구매 결과를 확인하지 못했어요. 가방과 재화를 확인해 주세요.', true);
        } finally { busy = false; if (!disposed) sync(); }
    }
    void loadNpcs();
    return {
        setMap(value: string) { layer.hidden = value !== 'forest'; notice.hidden = value !== 'forest'; },
        position(scrollX: number, scrollY: number, zoom: number) {
            actors.forEach(({ button, x, y }) => {
                const screenX = (x - scrollX) * zoom, screenY = (y - scrollY) * zoom;
                button.hidden = screenX < -100 || screenX > shell.clientWidth + 100 || screenY < 0 || screenY > shell.clientHeight + 150;
                button.style.left = `${screenX}px`; button.style.top = `${screenY}px`;
                button.style.transform = `translate(-50%, -100%) scale(${zoom})`;
                button.querySelector<HTMLElement>('.npc-name')!.style.fontSize = `${14 / Math.min(1, zoom)}px`;
                button.querySelector<HTMLElement>('.npc-action')!.style.fontSize = `${11 / Math.min(1, zoom)}px`;
            });
        },
        updateCharacter(next: GameCharacter) { character = next; sync(); },
        dispose() { disposed = true; abort.abort(); layer.remove(); notice.remove(); backdrop.remove(); blockInput(false); }
    };
}
