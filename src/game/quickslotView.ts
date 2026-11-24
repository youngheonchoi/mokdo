import { ITEMS, type Bag, type ItemId } from './items';
import { ITEM_DRAG_TYPE, QUICKSLOT_KEYS, isConsumable, type QuickslotStore } from './quickslots';

export function updateQuickslotCounts(root: HTMLElement, bag: Bag): void {
    root.querySelectorAll<HTMLElement>('[data-quickslot-item]').forEach(slot => {
        const id = slot.dataset.quickslotItem as ItemId;
        const count = bag[id];
        const key = QUICKSLOT_KEYS[Number(slot.dataset.consumableSlot)];
        const label = `${key} · ${ITEMS[id].name} · ${count.toLocaleString()}개`;
        slot.title = label;
        slot.setAttribute('aria-label', label);
        slot.classList.toggle('depleted', count === 0);
        const amount = slot.querySelector('.quickslot-count')!;
        if (amount.textContent !== String(count)) amount.textContent = String(count);
    });
}

export function renderConsumableSlots(root: HTMLElement, store: QuickslotStore, bag: Bag): void {
    const slots = store.read();
    root.querySelectorAll<HTMLElement>('[data-consumable-slot]').forEach(slot => {
        const index = Number(slot.dataset.consumableSlot);
        const id = slots[index];
        slot.replaceChildren();
        const key = document.createElement('span');
        key.className = 'quickslot-key';
        key.textContent = QUICKSLOT_KEYS[index];
        slot.append(key);
        slot.setAttribute('aria-keyshortcuts', QUICKSLOT_KEYS[index]);
        slot.classList.toggle('empty-quickslot', !id);
        delete slot.dataset.quickslotItem;
        delete slot.dataset.itemId;
        if (id) {
            slot.dataset.quickslotItem = id;
            slot.dataset.itemId = id;
            const icon = document.createElement('span');
            icon.className = 'ability-icon';
            icon.textContent = ITEMS[id].icon;
            icon.style.color = ITEMS[id].color;
            const count = document.createElement('span');
            count.className = 'quickslot-count';
            slot.append(icon, count);
        } else {
            slot.classList.remove('depleted');
            slot.setAttribute('aria-label', `빈 퀵슬롯 ${index + 1} (${QUICKSLOT_KEYS[index]})`);
            slot.title = `퀵슬롯 ${index + 1} (${QUICKSLOT_KEYS[index]})`;
        }
    });
    updateQuickslotCounts(root, bag);
}

export function createInventoryQuickslots(store: QuickslotStore, bag: Bag): {
    element: HTMLElement; selectItem: (id: ItemId) => void;
} {
    let selected: ItemId | null = null;
    const section = document.createElement('section');
    section.className = 'inventory-quickslots';
    section.setAttribute('aria-label', '가방 퀵슬롯');
    section.innerHTML = `<h3>퀵슬롯</h3><div class="inventory-quickslot-grid">${QUICKSLOT_KEYS.map((_, index) => `<button type="button" class="quickslot" data-consumable-slot="${index}"></button>`).join('')}</div><p class="quickslot-feedback" role="status">소모품을 끌어 넣거나 선택 후 빈 슬롯을 누르세요. 우클릭 또는 Delete로 해제할 수 있어요.</p>`;
    const feedback = section.querySelector('.quickslot-feedback')!;
    const assign = (index: number, id: unknown) => {
        if (store.assign(index, id, bag)) {
            feedback.textContent = store.message || `${ITEMS[id as ItemId].name}을(를) 퀵슬롯 ${index + 1}에 등록했어요.`;
            renderConsumableSlots(section, store, bag);
        } else feedback.textContent = '보유한 소모품만 등록할 수 있어요.';
    };
    section.querySelectorAll<HTMLButtonElement>('[data-consumable-slot]').forEach(slot => {
        const index = Number(slot.dataset.consumableSlot);
        slot.ondragover = event => {
            if (!event.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            slot.classList.add('drop-target');
        };
        slot.ondragleave = () => slot.classList.remove('drop-target');
        slot.ondrop = event => {
            event.preventDefault();
            slot.classList.remove('drop-target');
            assign(index, event.dataTransfer?.getData(ITEM_DRAG_TYPE));
        };
        slot.onclick = () => {
            if (selected) assign(index, selected);
            else feedback.textContent = '소모 탭에서 등록할 소모품을 먼저 선택해주세요.';
        };
        const clear = () => {
            store.clear(index);
            feedback.textContent = store.message || `퀵슬롯 ${index + 1} 등록을 해제했어요. 아이템은 가방에 그대로 있어요.`;
            renderConsumableSlots(section, store, bag);
        };
        slot.oncontextmenu = event => { event.preventDefault(); clear(); };
        slot.onkeydown = event => {
            if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); clear(); }
        };
    });
    renderConsumableSlots(section, store, bag);
    return { element: section, selectItem: id => {
        if (!isConsumable(id)) return;
        selected = id;
        feedback.textContent = `${ITEMS[id].name} 선택됨 · 등록할 퀵슬롯을 눌러주세요.`;
    } };
}
