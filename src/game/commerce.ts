import { ITEMS, type ItemId, type EquipmentSlot } from './items';
import { cloneProfile, levelOf, LEVEL_XP, type Profile } from './progression';

export interface Merchant {
    id: string; name: string; x: number; y: number; radius: number;
    stock: readonly ItemId[]; slots: readonly EquipmentSlot[]; general?: boolean;
}
export const MERCHANTS: readonly Merchant[] = [
    { id: 'equipment', name: '장비상인', x: 440, y: 980, radius: 85, stock: ['starterHat', 'starterArmor', 'starterGloves', 'starterShoes'], slots: ['head', 'armor', 'gloves', 'shoes'] },
    { id: 'weapons', name: '무기상인', x: 800, y: 980, radius: 85, stock: ['starterSword', 'starterShield'], slots: ['weapon', 'offhand'] },
    { id: 'accessories', name: '장신구상인', x: 440, y: 1230, radius: 85, stock: ['starterEarring', 'starterNecklace', 'starterRing'], slots: ['earring', 'necklace', 'ring'] },
    { id: 'general', name: '잡화상인', x: 800, y: 1230, radius: 85, stock: ['healthPotion'], slots: [], general: true }
];
export function nearestMerchant(point: { x: number; y: number }): Merchant | undefined {
    return MERCHANTS.filter(merchant => Math.hypot(point.x - merchant.x, point.y - merchant.y) <= merchant.radius)
        .sort((a, b) => Math.hypot(point.x - a.x, point.y - a.y) - Math.hypot(point.x - b.x, point.y - b.y))[0];
}
export function canSell(merchant: Merchant, id: ItemId): boolean {
    if (id === 'gold') return false;
    const item = ITEMS[id];
    return merchant.general ? item.category === 'misc' || item.category === 'consumable'
        : 'slot' in item && merchant.slots.includes(item.slot);
}
export type TradeMode = 'buy' | 'sell';
export function trade(profile: Profile, merchantId: string, mode: TradeMode, id: ItemId, quantity: number): { profile?: Profile; message: string } {
    const merchant = MERCHANTS.find(entry => entry.id === merchantId);
    if (!merchant || !Object.prototype.hasOwnProperty.call(ITEMS, id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999 || !['buy', 'sell'].includes(mode)) return { message: '거래할 상품과 수량을 확인해주세요.' };
    const item = ITEMS[id];
    if (mode === 'buy' && !merchant.stock.includes(id) || mode === 'sell' && !canSell(merchant, id)) return { message: '이 상인과 거래할 수 없는 아이템이에요.' };
    const price = (mode === 'buy' ? item.buyPrice : item.sellPrice) * quantity;
    if (mode === 'buy' && profile.bag.gold < price) return { message: '골드가 부족해요.' };
    if (mode === 'sell' && profile.bag[id] < quantity) return { message: '보유 수량이 부족해요.' };
    if (mode === 'buy' && profile.bag[id] + quantity > 99999999 || mode === 'sell' && profile.bag.gold + price > 99999999) return { message: '보유 한도를 초과해 거래할 수 없어요.' };
    const next = cloneProfile(profile);
    next.bag.gold += mode === 'buy' ? -price : price;
    next.bag[id] += mode === 'buy' ? quantity : -quantity;
    return { profile: next, message: `${item.name} ${quantity}개를 ${mode === 'buy' ? '구매' : '판매'}했어요.` };
}
export function applyCheat(profile: Profile, cheat: 'level' | 'gold'): Profile {
    const next = cloneProfile(profile);
    if (cheat === 'gold') next.bag.gold = Math.min(99999999, next.bag.gold + 10000);
    else {
        const level = levelOf(next.xp);
        if (level < LEVEL_XP.length) next.xp = LEVEL_XP[level];
    }
    return next;
}
