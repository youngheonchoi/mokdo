export const ITEMS = {
    gold: { name: '골드', icon: '●', color: '#efce78', rarity: '일반' },
    moss: { name: '숲의 정수', icon: '❧', color: '#b2dca0', rarity: '일반' },
    shard: { name: '빛나는 결정', icon: '◆', color: '#9cdbed', rarity: '희귀' },
    core: { name: '수호자의 심장', icon: '✧', color: '#d7b1f3', rarity: '영웅' }
} as const;
export type ItemId = keyof typeof ITEMS;
export type Bag = Record<ItemId, number>;
export interface Drop { id: number; item: ItemId; amount: number; x: number; y: number; age: number }
export const emptyBag = (): Bag => ({ gold: 0, moss: 0, shard: 0, core: 0 });

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
