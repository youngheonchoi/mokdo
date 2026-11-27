import { request } from '../../api/request';
import { defaultWeapon } from '../characters/defaultWeapon';
import type { GameCharacter, InventoryItem } from '../types';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}
const typeNames: Record<string, string> = { WEAPON: '무기', HAT: '모자', MATERIAL: '기타', CONSUMABLE: '소비', ARMOR: '방어구' };

function icon(item: InventoryItem) {
    const image = el('img', 'item-icon');
    image.alt = '';
    image.draggable = false;
    image.onerror = () => {
        image.onerror = null;
        if (item.itemType === 'WEAPON' && item.appearanceCode === defaultWeapon.key) image.src = defaultWeapon.textureUrl;
        else image.hidden = true;
    };
    image.src = `/api/items/${encodeURIComponent(item.itemId)}/image`;
    return image;
}

export function mountItemWindows(shell: HTMLElement, toolbar: HTMLElement, initial: GameCharacter,
    changed: (character: GameCharacter) => void, blockInput: (blocked: boolean) => void) {
    let character = initial;
    let items: InventoryItem[] = [];
    let selectedId: string | undefined;
    let selectedSource: 'inventory' | 'equipment' = 'inventory';
    let busy = false;
    let loading = false;
    let loaded = false;
    let stale = false;
    let disposed = false;
    let message = '';
    let error = false;
    let top = 4;
    const abort = new AbortController();
    const windows: { panel: HTMLElement; body: HTMLElement; trigger: HTMLButtonElement }[] = [];
    const tooltip = el('div', 'item-tooltip');
    tooltip.id = 'game-item-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    shell.append(tooltip);
    let tooltipOwner: HTMLElement | undefined;
    let dragging: { item: InventoryItem; pointer: number; x: number; y: number; active: boolean; source: HTMLElement } | undefined;
    let ghost: HTMLElement | undefined;
    let suppressClickUntil = 0;
    const hideTooltip = () => {
        tooltip.hidden = true;
        tooltipOwner?.removeAttribute('aria-describedby');
        tooltipOwner = undefined;
    };
    const isOpen = () => windows.some(({ panel }) => !panel.hidden);
    const focusWindow = (panel: HTMLElement) => { panel.style.zIndex = String(++top); };
    const clamp = (panel: HTMLElement) => {
        panel.style.left = `${Math.max(8, Math.min(parseFloat(panel.style.left) || 8, shell.clientWidth - panel.offsetWidth - 8))}px`;
        panel.style.top = `${Math.max(8, Math.min(parseFloat(panel.style.top) || 8, shell.clientHeight - panel.offsetHeight - 8))}px`;
    };
    function createWindow(title: string, index: number) {
        const trigger = el('button', 'game-tool', title);
        trigger.type = 'button';
        trigger.setAttribute('aria-expanded', 'false');
        const panel = el('section', 'item-window');
        panel.hidden = true;
        panel.id = `game-items-${index}`;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-labelledby', `${panel.id}-title`);
        panel.tabIndex = -1;
        trigger.setAttribute('aria-controls', panel.id);
        const header = el('div', 'item-window-header');
        const heading = el('h2', '', title);
        heading.id = `${panel.id}-title`;
        const hint = el('span', 'item-drag-hint', '드래그하여 이동');
        const close = el('button', 'item-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', `${title} 닫기`);
        function toggle(open: boolean) {
            hideTooltip();
            cancelDrag();
            panel.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
            blockInput(isOpen());
            if (open) {
                if (!panel.style.left) {
                    panel.style.left = `${Math.max(8, shell.clientWidth - (index + 1) * 392 - 24)}px`;
                    panel.style.top = `${Math.min(118, shell.clientHeight * .15)}px`;
                }
                focusWindow(panel);
                clamp(panel);
                panel.focus({ preventScroll: true });
                if (!loading && !busy) void refresh();
            } else trigger.focus({ preventScroll: true });
        }
        close.onclick = () => toggle(false);
        trigger.onclick = () => toggle(panel.hidden);
        const body = el('div', 'item-window-body');
        header.append(heading, hint, close);
        panel.append(header, body);
        panel.addEventListener('pointerdown', () => focusWindow(panel), { signal: abort.signal });
        let drag: { id: number; x: number; y: number; left: number; top: number } | undefined;
        header.onpointerdown = event => {
            if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
            event.preventDefault();
            hideTooltip();
            cancelDrag();
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: panel.offsetLeft, top: panel.offsetTop };
            header.setPointerCapture(event.pointerId);
        };
        header.onpointermove = event => {
            if (!drag || event.pointerId !== drag.id) return;
            panel.style.left = `${drag.left + event.clientX - drag.x}px`;
            panel.style.top = `${drag.top + event.clientY - drag.y}px`;
            clamp(panel);
        };
        header.onpointerup = header.onpointercancel = () => { drag = undefined; };
        header.onlostpointercapture = () => { drag = undefined; };
        windows.push({ panel, body, trigger });
        toolbar.append(trigger);
        shell.append(panel);
        return body;
    }
    const inventory = createWindow('인벤토리', 0);
    const equipment = createWindow('장비', 1);
    const resize = new ResizeObserver(() => {
        hideTooltip();
        cancelDrag();
        windows.forEach(({ panel }) => { if (!panel.hidden) clamp(panel); });
    });
    resize.observe(shell);
    window.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (dragging?.active) { event.preventDefault(); suppressClickUntil = performance.now() + 300; cancelDrag(); return; }
        const front = windows.filter(({ panel }) => !panel.hidden)
            .sort((a, b) => Number(b.panel.style.zIndex) - Number(a.panel.style.zIndex))[0];
        if (front) { event.preventDefault(); front.trigger.click(); }
    }, { signal: abort.signal });

    function equipProblem(item: InventoryItem, slot = item.itemType): string | undefined {
        if (item.itemType !== slot || !['WEAPON', 'HAT'].includes(slot)) return '아이템 종류에 맞는 장비 칸에 놓아 주세요.';
        if ((character.level ?? 1) < item.requiredLevel) return `레벨 ${item.requiredLevel}부터 장착할 수 있어요.`;
        if (item.quantity !== 1) return '수량이 1인 장비만 장착할 수 있어요.';
    }

    function bindTooltip(cell: HTMLElement, item: InventoryItem) {
        const show = () => {
            if (dragging?.active) return;
            hideTooltip();
            tooltipOwner = cell;
            cell.setAttribute('aria-describedby', tooltip.id);
            tooltip.replaceChildren(el('h3', '', item.name),
                el('p', 'item-caption', `${typeNames[item.itemType] ?? item.itemType} · 수량 ${item.quantity}${item.equipped ? ' · 장착 중' : ''}`));
            if (['WEAPON', 'HAT'].includes(item.itemType)) {
                tooltip.append(el('p', 'item-caption', `착용 레벨 ${item.requiredLevel} · 현재 레벨 ${character.level ?? 1}`),
                    el('p', 'item-bonuses', `공격력 +${item.attack} / 방어력 +${item.defense} / 최대 체력 +${item.hp}`));
                const problem = equipProblem(item);
                if (problem) tooltip.append(el('p', 'item-status error', problem));
            }
            tooltip.hidden = false;
            const rect = cell.getBoundingClientRect();
            const root = shell.getBoundingClientRect();
            const x = rect.right - root.left + 10;
            const y = rect.top - root.top;
            tooltip.style.left = `${Math.max(8, Math.min(x + tooltip.offsetWidth > shell.clientWidth - 8 ? rect.left - root.left - tooltip.offsetWidth - 10 : x, shell.clientWidth - tooltip.offsetWidth - 8))}px`;
            tooltip.style.top = `${Math.max(8, Math.min(y, shell.clientHeight - tooltip.offsetHeight - 8))}px`;
        };
        cell.onpointerenter = show;
        cell.onpointerleave = hideTooltip;
        cell.onfocus = show;
        cell.onblur = hideTooltip;
    }

    function clearDropTargets() {
        equipment.querySelectorAll('.drop-valid, .drop-invalid').forEach(slot => slot.classList.remove('drop-valid', 'drop-invalid'));
    }
    function cancelDrag() {
        const previous = dragging;
        dragging = undefined;
        if (previous?.source.hasPointerCapture(previous.pointer)) previous.source.releasePointerCapture(previous.pointer);
        ghost?.remove();
        ghost = undefined;
        clearDropTargets();
    }
    const dropTarget = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-equipment-type]');
    window.addEventListener('pointermove', event => {
        if (!dragging || event.pointerId !== dragging.pointer) return;
        if (!dragging.active && Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) < 6) return;
        if (!dragging.active) {
            dragging.active = true;
            hideTooltip();
            ghost = el('div', 'item-drag-ghost');
            ghost.append(icon(dragging.item));
            shell.append(ghost);
        }
        event.preventDefault();
        const root = shell.getBoundingClientRect();
        ghost!.style.left = `${event.clientX - root.left - 24}px`;
        ghost!.style.top = `${event.clientY - root.top - 24}px`;
        clearDropTargets();
        const target = dropTarget(event.clientX, event.clientY);
        if (target) target.classList.add(equipProblem(dragging.item, target.dataset.equipmentType) ? 'drop-invalid' : 'drop-valid');
    }, { signal: abort.signal, passive: false });
    window.addEventListener('pointerup', event => {
        if (!dragging || event.pointerId !== dragging.pointer) return;
        const { item, active } = dragging;
        const target = active ? dropTarget(event.clientX, event.clientY) : undefined;
        if (active) suppressClickUntil = performance.now() + 300;
        cancelDrag();
        if (!target) return;
        const problem = equipProblem(item, target.dataset.equipmentType);
        if (problem) { message = problem; error = true; render(); }
        else void equip(item, false);
    }, { signal: abort.signal });
    window.addEventListener('pointercancel', cancelDrag, { signal: abort.signal });
    window.addEventListener('blur', () => { hideTooltip(); cancelDrag(); }, { signal: abort.signal });
    shell.addEventListener('scroll', hideTooltip, { signal: abort.signal, capture: true });

    async function refresh() {
        loading = true;
        error = false;
        message = '';
        render();
        try {
            const [nextItems, characters] = await Promise.all([
                request<InventoryItem[]>(`/api/characters/${encodeURIComponent(character.characterId)}/items`, { signal: abort.signal }),
                request<GameCharacter[]>('/api/characters', { signal: abort.signal })
            ]);
            if (disposed) return;
            const next = characters.find(value => value.characterId === character.characterId);
            if (!next) throw new Error('캐릭터를 찾을 수 없어요. 캐릭터 선택으로 돌아가 주세요.');
            items = nextItems;
            character = next;
            loaded = true;
            stale = false;
            changed(next);
        } catch (cause) {
            if (disposed) return;
            stale = true;
            message = cause instanceof Error ? cause.message : '아이템을 불러오지 못했어요. 다시 시도해 주세요.';
            error = true;
        } finally {
            loading = false;
            if (!disposed) render();
        }
    }

    async function equip(item: InventoryItem, unequip = item.equipped) {
        if (busy || loading || stale || (!unequip && (item.equipped || equipProblem(item)))) return;
        busy = true;
        message = '장비를 변경하고 있어요…';
        error = false;
        render();
        try {
            const csrf = await request<{ headerName: string; token: string }>('/api/auth/csrf', { signal: abort.signal });
            if (disposed) return;
            await request(`/api/characters/${encodeURIComponent(character.characterId)}/${item.itemType === 'HAT' ? 'hat' : 'weapon'}`, {
                method: 'PUT', signal: abort.signal,
                headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                body: JSON.stringify({ characterItemId: unequip ? null : item.characterItemId })
            });
            await refresh();
            if (!stale) { message = `${item.name}${unequip ? ' 장착을 해제했어요.' : ' 장착했어요.'}`; error = false; }
        } catch (cause) {
            if (disposed) return;
            // Re-read after a rejected or interrupted change before allowing another mutation.
            await refresh();
            message = cause instanceof Error ? cause.message : '장비 변경에 실패했어요. 다시 시도해 주세요.';
            error = true;
        } finally {
            busy = false;
            if (!disposed) render();
        }
    }

    function action(item: InventoryItem) {
        const button = el('button', 'item-action', item.equipped ? '장착 해제' : '장착하기');
        button.type = 'button';
        const underLevel = (character.level ?? 1) < item.requiredLevel;
        button.disabled = busy || loading || stale || (!item.equipped && (underLevel || item.quantity !== 1));
        if (!item.equipped && underLevel) button.textContent = `레벨 ${item.requiredLevel}부터 장착`;
        button.onclick = () => void equip(item);
        return button;
    }

    function render() {
        hideTooltip();
        cancelDrag();
        inventory.replaceChildren();
        equipment.replaceChildren();
        for (const body of [inventory, equipment]) {
            if (loading || message) {
                const status = el('p', `item-status${error && !loading ? ' error' : ''}`, loading ? '아이템을 불러오고 있어요…' : message);
                status.setAttribute('role', 'status');
                body.append(status);
            }
            if (stale) {
                const retry = el('button', 'item-action', '다시 불러오기');
                retry.disabled = loading || busy;
                retry.onclick = () => void refresh();
                body.append(retry);
            }
        }
        if (!loaded) return;
        inventory.append(el('p', 'item-caption', `보유 아이템 ${items.length}개 · 마우스를 올리면 정보를 볼 수 있어요`));
        const grid = el('div', 'inventory-grid');
        for (const item of items) {
            const cell = el('button', `inventory-cell${selectedId === item.characterItemId ? ' selected' : ''}`);
            cell.type = 'button';
            cell.setAttribute('aria-pressed', String(selectedId === item.characterItemId));
            cell.setAttribute('aria-label', `${item.name}, ${typeNames[item.itemType] ?? item.itemType}, 수량 ${item.quantity}${item.equipped ? ', 장착 중' : ''}`);
            cell.append(icon(item), el('span', 'inventory-quantity', `×${item.quantity}`));
            if (item.equipped) cell.append(el('span', 'item-badge', '장착'));
            bindTooltip(cell, item);
            cell.onclick = () => {
                if (performance.now() < suppressClickUntil) return;
                selectedId = item.characterItemId;
                selectedSource = 'inventory';
                render();
            };
            if (['WEAPON', 'HAT'].includes(item.itemType)) {
                cell.classList.add('draggable-item');
                cell.onpointerdown = event => {
                    if (event.button !== 0 || busy || loading || stale) return;
                    dragging = { item, pointer: event.pointerId, x: event.clientX, y: event.clientY, active: false, source: cell };
                    cell.setPointerCapture(event.pointerId);
                };
            }
            grid.append(cell);
        }
        // Visual slots are not a gameplay capacity limit; add rows for larger inventories.
        const slotCount = Math.max(24, Math.ceil(items.length / 6) * 6);
        for (let index = items.length; index < slotCount; index++) {
            const empty = el('div', 'inventory-cell empty');
            empty.setAttribute('aria-hidden', 'true');
            grid.append(empty);
        }
        inventory.append(grid);
        if (!items.length) inventory.append(el('p', 'item-empty', '보유한 아이템이 없어요.'));
        inventory.append(el('p', 'item-caption slot-help', '장비창의 무기·모자 칸으로 드래그하면 장착할 수 있어요.'));
        equipment.append(el('p', 'item-caption', `${character.nickname} · 레벨 ${character.level ?? 1}`));
        const stats = el('dl', 'equipment-stats');
        for (const [label, value] of [['최대 체력', character.maxHp], ['공격력', character.attack], ['방어력', character.defense]] as const) {
            stats.append(el('dt', '', label), el('dd', '', value?.toLocaleString() ?? '—'));
        }
        equipment.append(stats);
        const slots = el('div', 'equipment-grid');
        for (const type of ['WEAPON', 'HAT']) {
            const group = el('div', 'equipment-slot-group');
            const label = el('span', 'equipment-slot-label', typeNames[type]);
            const item = items.find(value => value.itemType === type && value.equipped);
            const slot = el('button', `equipment-slot${item ? ' occupied' : ''}`);
            slot.type = 'button';
            slot.dataset.equipmentType = type;
            slot.setAttribute('aria-label', `${typeNames[type]} 슬롯: ${item?.name ?? '미장착'}`);
            if (item) {
                slot.append(icon(item));
                bindTooltip(slot, item);
                slot.onclick = () => {
                    selectedId = item.characterItemId;
                    selectedSource = 'equipment';
                    render();
                };
            } else slot.append(el('span', 'equipment-placeholder', '미장착'));
            group.append(label, slot);
            slots.append(group);
        }
        equipment.append(slots, el('p', 'item-caption slot-help', '인벤토리에서 알맞은 칸으로 아이템을 끌어 놓으세요. 장착한 아이템을 누르면 해제할 수 있어요. 모자는 능력치에만 반영돼요.'));
        const selected = items.find(item => item.characterItemId === selectedId);
        if (selected) {
            const detail = el('div', 'item-detail');
            detail.append(el('h3', '', selected.name),
                el('p', 'item-caption', `${typeNames[selected.itemType] ?? selected.itemType} · 수량 ${selected.quantity}`));
            if (['WEAPON', 'HAT'].includes(selected.itemType)) {
                detail.append(el('p', 'item-caption', `착용 레벨 ${selected.requiredLevel} · 현재 레벨 ${character.level ?? 1}`),
                    el('p', 'item-bonuses', `공격력 +${selected.attack} / 방어력 +${selected.defense} / 최대 체력 +${selected.hp}`));
            }
            if (['WEAPON', 'HAT'].includes(selected.itemType)) detail.append(action(selected));
            else detail.append(el('p', 'item-caption', '보관 중인 아이템이에요.'));
            (selectedSource === 'inventory' ? inventory : equipment).append(detail);
        }
        windows.forEach(({ panel }) => { if (!panel.hidden) clamp(panel); });
    }
    render();
    return () => {
        hideTooltip();
        cancelDrag();
        tooltip.remove();
        disposed = true;
        abort.abort();
        resize.disconnect();
        windows.forEach(({ panel, trigger }) => { panel.remove(); trigger.remove(); });
    };
}
