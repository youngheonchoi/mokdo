export const ITEM_CATEGORIES = [
    { id: 'misc', label: '기타' },
    { id: 'consumable', label: '소모' },
    { id: 'equipment', label: '장비' }
] as const;
export type ItemCategory = typeof ITEM_CATEGORIES[number]['id'];
export type EquipmentSlot = 'head' | 'armor' | 'gloves' | 'shoes' | 'weapon' | 'offhand' | 'earring' | 'necklace' | 'ring';
interface ItemDefinition { name: string; icon: string; color: string; rarity: string; category: ItemCategory; buyPrice: number; sellPrice: number; slot?: EquipmentSlot; description?: string; effect?: string }

export const ITEMS = {
    gold: { name: '골드', description: '상인과 거래할 때 사용하는 화폐예요.', icon: '●', color: '#efce78', rarity: '일반', category: 'misc', buyPrice: 0, sellPrice: 0 },
    moss: { name: '숲의 정수', description: '숲의 기운이 담긴 재료예요. 잡화상인에게 판매할 수 있어요.', icon: '❧', color: '#b2dca0', rarity: '일반', category: 'misc', buyPrice: 0, sellPrice: 5 },
    shard: { name: '빛나는 결정', description: '은은한 빛을 내는 희귀한 결정이에요. 잡화상인에게 판매할 수 있어요.', icon: '◆', color: '#9cdbed', rarity: '희귀', category: 'misc', buyPrice: 0, sellPrice: 30 },
    healthPotion: { name: '체력 물약', description: '잡화상인이 판매하는 회복용 물약이에요.', effect: '체력 회복 · 사용 기능은 준비 중이에요.', icon: '✚', color: '#ed9289', rarity: '일반', category: 'consumable', buyPrice: 50, sellPrice: 20 },
    starterHat: { name: '여행자의 모자', icon: '⌂', color: '#c4d29e', rarity: '일반', category: 'equipment', slot: 'head', buyPrice: 200, sellPrice: 100 },
    starterArmor: { name: '여행자의 전신 갑옷', icon: '♜', color: '#c4d29e', rarity: '일반', category: 'equipment', slot: 'armor', buyPrice: 500, sellPrice: 250 },
    starterGloves: { name: '여행자의 장갑', icon: '♧', color: '#c4d29e', rarity: '일반', category: 'equipment', slot: 'gloves', buyPrice: 150, sellPrice: 75 },
    starterShoes: { name: '여행자의 신발', icon: '♟', color: '#c4d29e', rarity: '일반', category: 'equipment', slot: 'shoes', buyPrice: 150, sellPrice: 75 },
    starterSword: { name: '수련용 검', icon: '⚔', color: '#c2cfdb', rarity: '일반', category: 'equipment', slot: 'weapon', buyPrice: 400, sellPrice: 200 },
    starterShield: { name: '나무 방패', icon: '◇', color: '#c2cfdb', rarity: '일반', category: 'equipment', slot: 'offhand', buyPrice: 250, sellPrice: 125 },
    starterEarring: { name: '작은 은 귀걸이', icon: '♧', color: '#dfc79e', rarity: '일반', category: 'equipment', slot: 'earring', buyPrice: 200, sellPrice: 100 },
    starterNecklace: { name: '작은 은 목걸이', icon: '♙', color: '#dfc79e', rarity: '일반', category: 'equipment', slot: 'necklace', buyPrice: 250, sellPrice: 125 },
    starterRing: { name: '작은 은 반지', icon: '○', color: '#dfc79e', rarity: '일반', category: 'equipment', slot: 'ring', buyPrice: 200, sellPrice: 100 },
    core: { name: '수호자의 심장', description: '숲의 수호자가 남긴 귀한 재료예요. 잡화상인에게 판매할 수 있어요.', icon: '✧', color: '#d7b1f3', rarity: '영웅', category: 'misc', buyPrice: 0, sellPrice: 200 }
} as const satisfies Record<string, ItemDefinition>;
export type ItemId = keyof typeof ITEMS;
export type Bag = Record<ItemId, number>;
export const EQUIPMENT_LABELS: Record<EquipmentSlot, string> = {
    head: '모자 (머리)', armor: '갑옷 (전신)', gloves: '장갑', shoes: '신발',
    weapon: '무기', offhand: '보조무기', earring: '귀걸이', necklace: '목걸이', ring: '반지'
};
export type Equipment = Record<EquipmentSlot, ItemId | null>;
export const emptyEquipment = (): Equipment => Object.fromEntries(Object.keys(EQUIPMENT_LABELS).map(slot => [slot, null])) as Equipment;
export function equipmentSlotFor(id: unknown): EquipmentSlot | null {
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(ITEMS, id)) return null;
    const item = ITEMS[id as ItemId];
    return item.category === 'equipment' && 'slot' in item ? item.slot : null;
}
export function parseEquipment(raw: unknown): Equipment {
    const equipment = emptyEquipment();
    if (raw === undefined) return equipment;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid equipment');
    for (const slot of Object.keys(equipment) as EquipmentSlot[]) {
        const id = (raw as Record<string, unknown>)[slot];
        if (id === undefined || id === null) continue;
        if (equipmentSlotFor(id) !== slot) throw new Error('Invalid equipment slot');
        equipment[slot] = id as ItemId;
    }
    return equipment;
}
export function itemDetails(id: ItemId): { name: string; fields: { label: string; value: string }[] } {
    const item = ITEMS[id];
    if (item.category === 'equipment') return { name: item.name, fields: [{ label: '장비구분', value: EQUIPMENT_LABELS[item.slot] }] };
    const fields: { label: string; value: string }[] = [{ label: '설명', value: item.description }];
    if (item.category === 'consumable') fields.push({ label: '효과', value: item.effect });
    return { name: item.name, fields };
}
export interface Drop { id: number; item: ItemId; amount: number; x: number; y: number; age: number }
export const emptyBag = (): Bag => Object.fromEntries(Object.keys(ITEMS).map(id => [id, 0])) as Bag;

export function rollLoot(boss: boolean, random: () => number = Math.random): { item: ItemId; amount: number }[] {
    const count = (min: number, max: number) => min + Math.floor(Math.min(0.999999, Math.max(0, random())) * (max - min + 1));
    if (!boss) return [
        { item: 'gold', amount: count(3, 7) },
        { item: random() < 0.2 ? 'shard' : 'moss', amount: 1 }
    ];
    return [
        ...Array.from({ length: 6 }, () => ({ item: 'gold' as const, amount: count(16, 24) })),
        ...Array.from({ length: 3 }, () => ({ item: 'shard' as const, amount: count(1, 3) })),
        ...Array.from({ length: 2 }, () => ({ item: 'moss' as const, amount: count(3, 5) })),
        { item: 'core', amount: 1 }
    ];
}
