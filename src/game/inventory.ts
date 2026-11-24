import { equipItem, unequipItem, EQUIPPED_DRAG_TYPE, type EquipmentResult } from './equipment';
import { cloneProfile, type Profile } from './progression';
import { createInventoryQuickslots } from './quickslotView';
import { ITEM_DRAG_TYPE, isConsumable, type QuickslotStore } from './quickslots';
import { ITEM_CATEGORIES, ITEMS, equipmentSlotFor, type ItemCategory, type ItemId, type EquipmentSlot } from './items';

const equipmentSlots = [
    { id: 'earring', label: '귀걸이', icon: 'M5 8a4 4 0 1 1 8 0c0 3-4 4-4 7M9 15l3 3-3 3-3-3 3-3ZM17 5a3 3 0 0 1 3 3c0 2-2 3-2 5m0 0 2 3-2 3-2-3 2-3Z' },
    { id: 'head', label: '머리', icon: 'M5 13V10a7 7 0 0 1 14 0v3M4 13h16v5H4zM8 18v3m8-3v3' },
    { id: 'necklace', label: '목걸이', icon: 'M5 3v5a7 7 0 0 0 14 0V3M12 15l4 4-4 4-4-4 4-4Z' },
    { id: 'armor', label: '갑옷', icon: 'm8 3 4 3 4-3 5 5-4 3v10H7V11L3 8l5-5Z' },
    { id: 'gloves', label: '장갑', icon: 'M7 20 3 12a2 2 0 0 1 3-2l2 2V4a1 1 0 0 1 2 0v6-7a1 1 0 0 1 2 0v7-6a1 1 0 0 1 2 0v6-4a1 1 0 0 1 2 0v8l-2 6H7Z' },
    { id: 'weapon', label: '무기', icon: 'm5 19 9-9m-6 4 4 4M13 5l7-2-2 7-6 6-4-4 5-7ZM3 21l3-3' },
    { id: 'offhand', label: '보조무기', icon: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm0 4v10M8 11h8' },
    { id: 'shoes', label: '신발', icon: 'M5 3h7v8l7 4c2 1 2 3 2 5H3v-7l2-3V3Zm-2 14h18M12 11l-3 3m6-1-3 3' },
    { id: 'ring', label: '반지', icon: 'M6 14a6 6 0 1 0 12 0 6 6 0 1 0-12 0M8 5l4-3 4 3-4 5-4-5Z' }
] as const;

/** Categories and equipment locations are data-driven so more can be added later. */
export function createInventory(profile: Profile, characterName: string, bindings: QuickslotStore, commit: (profile: Profile) => string): HTMLElement {
    const current = cloneProfile(profile);
    const bag = current.bag;
    let draggedItem: ItemId | null = null;
    let selectedEquipment: ItemId | null = null;
    const layout = document.createElement('div');
    layout.className = 'inventory-layout';
    const quickslotEditor = createInventoryQuickslots(bindings, bag);
    const equipment = document.createElement('section');
    equipment.className = 'equipment-panel';
    equipment.setAttribute('aria-labelledby', 'equipment-title');
    equipment.innerHTML = '<h3 id="equipment-title">장착 장비</h3><p class="equipment-character"></p><div class="equipment-grid"><div class="equipment-silhouette" aria-hidden="true"><svg viewBox="0 0 80 180" fill="none" stroke="currentColor" stroke-width="2"><circle cx="40" cy="24" r="14"/><path d="m27 48-12 45 8 4 10-30-4 50-7 47h12l6-39 6 39h12l-7-47-4-50 10 30 8-4-12-45Z"/></svg></div></div><p class="equipment-note" role="status">장비를 알맞은 칸으로 드래그하세요. 해제는 가방으로 드래그하거나 우클릭하세요.</p>';
    equipment.querySelector('.equipment-character')!.textContent = characterName;
    const equipmentGrid = equipment.querySelector('.equipment-grid')!;
    const equipmentNote = equipment.querySelector('.equipment-note')!;
    const inventory = document.createElement('section');
    inventory.className = 'inventory-panel';
    inventory.setAttribute('aria-label', '소지품');
    const tabs = document.createElement('div');
    tabs.className = 'inventory-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '아이템 분류');
    const panel = document.createElement('div');
    panel.id = 'inventory-category-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
    const grid = document.createElement('div');
    grid.className = 'inventory-grid';
    const categoryStatus = document.createElement('p');
    categoryStatus.className = 'inventory-category-status';
    categoryStatus.setAttribute('role', 'status');
    panel.append(grid, categoryStatus);
    let category: ItemCategory = ITEM_CATEGORIES[0].id;
    const tabButtons: HTMLButtonElement[] = [];
    const render = (next: ItemCategory) => {
        category = next;
        for (const tab of tabButtons) {
            const selected = tab.dataset.category === category;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }
        panel.setAttribute('aria-labelledby', `inventory-tab-${category}`);
        grid.setAttribute('aria-label', `${ITEM_CATEGORIES.find(item => item.id === category)!.label} 가방 슬롯 24칸`);
        const owned = (Object.keys(ITEMS) as ItemId[]).filter(id => id !== 'gold' && bag[id] > 0 && ITEMS[id].category === category);
        grid.replaceChildren();
        for (let index = 0; index < 24; index++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            const id = owned[index];
            if (id) {
                const item = ITEMS[id];
                slot.title = `${item.name} · ${item.rarity} · ${bag[id].toLocaleString()}개`;
                slot.setAttribute('aria-label', slot.title);
                slot.tabIndex = 0;
                slot.dataset.itemId = id;
                if (equipmentSlotFor(id)) {
                    slot.draggable = true;
                    slot.dataset.draggableItem = id;
                    slot.ondragstart = event => {
                        draggedItem = id;
                        event.dataTransfer!.setData(ITEM_DRAG_TYPE, id);
                        event.dataTransfer!.effectAllowed = 'move';
                    };
                    const select = () => { selectedEquipment = id; equipmentNote.textContent = `${item.name} 선택됨 · 장착할 부위를 누르세요.`; };
                    slot.onclick = select;
                    slot.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } };
                }
                if (isConsumable(id)) {
                    slot.draggable = true;
                    slot.dataset.draggableItem = id;
                    slot.ondragstart = event => {
                        draggedItem = id;
                        event.dataTransfer!.setData(ITEM_DRAG_TYPE, id);
                        event.dataTransfer!.effectAllowed = 'copy';
                    };
                    slot.onclick = () => quickslotEditor.selectItem(id);
                    slot.onkeydown = event => {
                        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); quickslotEditor.selectItem(id); }
                    };
                }
                const icon = document.createElement('span');
                icon.className = 'inventory-icon';
                icon.textContent = item.icon;
                icon.style.color = item.color;
                const count = document.createElement('span');
                count.className = 'inventory-count';
                count.textContent = bag[id].toLocaleString();
                slot.append(icon, count);
            } else slot.setAttribute('aria-label', `빈 가방 슬롯 ${index + 1}`);
            grid.append(slot);
        }
        categoryStatus.textContent = owned.length ? `${owned.length}종 보유` : '보유한 아이템이 없어요.';
    };
    for (const entry of ITEM_CATEGORIES) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `inventory-tab-${entry.id}`;
        tab.dataset.category = entry.id;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', panel.id);
        tab.textContent = entry.label;
        tab.onclick = () => render(entry.id);
        tab.onkeydown = event => {
            const index = tabButtons.indexOf(tab);
            const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabButtons.length
                : event.key === 'ArrowLeft' ? (index + tabButtons.length - 1) % tabButtons.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabButtons.length - 1 : -1;
            if (nextIndex < 0) return;
            event.preventDefault();
            const next = tabButtons[nextIndex];
            render(next.dataset.category as ItemCategory);
            next.focus();
        };
        tabs.append(tab);
        tabButtons.push(tab);
    }
    for (const entry of equipmentSlots) {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = `equipment-slot equipment-${entry.id}`;
        slot.setAttribute('aria-label', `${entry.label}${entry.id === 'armor' ? ' (전신)' : ''} · 미장착`);
        slot.setAttribute('aria-pressed', 'false');
        slot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${entry.icon}"/></svg><span>${entry.label}</span>`;
        if (entry.id === 'armor') slot.title = '갑옷 (전신)';
        slot.dataset.equipmentSlot = entry.id;
        slot.onclick = () => {
            if (selectedEquipment) { apply(equipItem(current, entry.id, selectedEquipment)); selectedEquipment = null; }
            else {
                render('equipment');
                equipmentNote.textContent = current.equipment[entry.id] ? '장착 중인 장비는 가방으로 드래그하거나 우클릭해 해제할 수 있어요.' : '가방의 장비를 선택하거나 이 칸으로 드래그해주세요.';
            }
        };
        slot.ondragover = event => {
            if (!event.dataTransfer?.types.includes(ITEM_DRAG_TYPE)) return;
            event.preventDefault();
            const fits = draggedItem && equipmentSlotFor(draggedItem) === entry.id;
            slot.classList.toggle('equipment-drop-valid', !!fits);
            slot.classList.toggle('equipment-drop-invalid', !fits);
        };
        slot.ondragleave = () => slot.classList.remove('equipment-drop-valid', 'equipment-drop-invalid');
        slot.ondrop = event => {
            event.preventDefault();
            slot.classList.remove('equipment-drop-valid', 'equipment-drop-invalid');
            apply(equipItem(current, entry.id, event.dataTransfer?.getData(ITEM_DRAG_TYPE)));
        };
        slot.ondragstart = event => {
            const id = current.equipment[entry.id];
            if (!id || !event.dataTransfer) { event.preventDefault(); return; }
            draggedItem = id;
            event.dataTransfer.setData(ITEM_DRAG_TYPE, id);
            event.dataTransfer.setData(EQUIPPED_DRAG_TYPE, entry.id);
            event.dataTransfer.effectAllowed = 'move';
        };
        slot.oncontextmenu = event => { event.preventDefault(); apply(unequipItem(current, entry.id)); };
        slot.onkeydown = event => {
            if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); apply(unequipItem(current, entry.id)); }
        };
        equipmentGrid.append(slot);
    }
    const renderEquipped = () => {
        for (const entry of equipmentSlots) {
            const slot = equipmentGrid.querySelector<HTMLButtonElement>(`[data-equipment-slot="${entry.id}"]`)!;
            const id = current.equipment[entry.id];
            slot.classList.toggle('is-equipped', !!id);
            slot.draggable = !!id;
            delete slot.dataset.itemId;
            slot.removeAttribute('title');
            if (id) {
                slot.dataset.itemId = id;
                const icon = document.createElement('span'); icon.className = 'equipped-icon'; icon.textContent = ITEMS[id].icon; icon.style.color = ITEMS[id].color;
                const label = document.createElement('span'); label.textContent = entry.label;
                slot.replaceChildren(icon, label);
                slot.setAttribute('aria-label', `${entry.label} · ${ITEMS[id].name} 장착 중`);
            } else {
                slot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${entry.icon}"/></svg><span>${entry.label}</span>`;
                slot.setAttribute('aria-label', `${entry.label}${entry.id === 'armor' ? ' (전신)' : ''} · 미장착`);
            }
        }
    };
    const apply = (result: EquipmentResult) => {
        let warning = '';
        if (result.profile) {
            Object.assign(current.bag, result.profile.bag);
            Object.assign(current.equipment, result.profile.equipment);
            warning = commit(cloneProfile(current));
            render(category);
            renderEquipped();
        }
        equipmentNote.textContent = [result.message, warning].filter(Boolean).join(' ');
    };
    grid.ondragover = event => { if (event.dataTransfer?.types.includes(EQUIPPED_DRAG_TYPE)) event.preventDefault(); };
    grid.ondrop = event => {
        const source = event.dataTransfer?.getData(EQUIPPED_DRAG_TYPE) as EquipmentSlot;
        if (!source) return;
        event.preventDefault();
        if (current.equipment[source] !== event.dataTransfer?.getData(ITEM_DRAG_TYPE)) return;
        category = 'equipment';
        apply(unequipItem(current, source));
    };
    layout.ondragend = () => {
        draggedItem = null;
        equipmentGrid.querySelectorAll('.equipment-slot').forEach(slot => slot.classList.remove('equipment-drop-valid', 'equipment-drop-invalid'));
    };
    const gold = document.createElement('div');
    gold.className = 'inventory-gold';
    const label = document.createElement('span');
    label.textContent = '골드';
    const amount = document.createElement('strong');
    amount.textContent = bag.gold.toLocaleString();
    gold.append(label, amount);
    inventory.append(tabs, panel, gold);
    layout.append(equipment, inventory, quickslotEditor.element);
    render(category);
    renderEquipped();
    return layout;
}
