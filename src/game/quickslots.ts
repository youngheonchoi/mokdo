import { ITEMS, type Bag, type ItemId } from './items';

export const QUICKSLOT_KEYS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G'] as const;
export const CONSUMABLE_SLOT_COUNT = QUICKSLOT_KEYS.length;
export const ITEM_DRAG_TYPE = 'application/x-mokdo-item';
export function isConsumable(id: unknown): id is ItemId {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, id) && ITEMS[id as ItemId].category === 'consumable';
}
interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Stored separately from combat snapshots so combat saves cannot overwrite a new binding. */
export class QuickslotStore {
    private slots: (ItemId | null)[] = Array(CONSUMABLE_SLOT_COUNT).fill(null);
    private listeners = new Set<() => void>();
    message = '';
    constructor(private storage: Storage | null, private key = '') {
        if (!storage) return;
        try {
            const raw = storage.getItem(key);
            if (raw === null) return;
            const saved: unknown = JSON.parse(raw);
            if (!Array.isArray(saved) || ![CONSUMABLE_SLOT_COUNT, 12].includes(saved.length) || !saved.every(id => id === null || isConsumable(id))) throw new Error('Invalid quickslots');
            this.slots = saved.slice(0, CONSUMABLE_SLOT_COUNT);
            // Carry overflow registrations into free slots when migrating the old 12-slot layout.
            for (const id of saved.slice(CONSUMABLE_SLOT_COUNT)) {
                const free = this.slots.indexOf(null);
                if (id && free >= 0) this.slots[free] = id;
            }
        } catch { this.message = '퀵슬롯 구성을 불러오지 못했어요. 다시 등록해주세요.'; }
    }
    read(): (ItemId | null)[] { return [...this.slots]; }
    assign(index: number, id: unknown, bag: Bag): boolean {
        if (!Number.isInteger(index) || index < 0 || index >= CONSUMABLE_SLOT_COUNT || !isConsumable(id) || !(bag[id] > 0)) return false;
        this.slots[index] = id;
        this.save();
        return true;
    }
    clear(index: number): void {
        if (!Number.isInteger(index) || index < 0 || index >= CONSUMABLE_SLOT_COUNT) return;
        this.slots[index] = null;
        this.save();
    }
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private save(): void {
        try {
            if (!this.storage) throw new Error('No storage');
            this.storage.setItem(this.key, JSON.stringify(this.slots));
            this.message = '';
        } catch { this.message = '퀵슬롯 저장에 실패했어요. 이번 접속에서만 유지될 수 있어요.'; }
        this.listeners.forEach(listener => listener());
    }
}
