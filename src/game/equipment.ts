import { EQUIPMENT_LABELS, ITEMS, equipmentSlotFor, type EquipmentSlot, type ItemId } from './items';
import { cloneProfile, type Profile } from './progression';

export interface EquipmentResult { profile?: Profile; message: string }
export function equipItem(profile: Profile, slot: EquipmentSlot, id: unknown): EquipmentResult {
    if (!Object.prototype.hasOwnProperty.call(EQUIPMENT_LABELS, slot) || equipmentSlotFor(id) !== slot) return { message: '이 장비는 해당 부위에 장착할 수 없어요.' };
    const itemId = id as ItemId;
    if (profile.equipment[slot] === itemId) return { message: '이미 같은 장비를 장착하고 있어요.' };
    if (!(profile.bag[itemId] > 0)) return { message: '가방에 보유한 장비만 장착할 수 있어요.' };
    const previous = profile.equipment[slot];
    if (previous && profile.bag[previous] >= 99999999) return { message: '기존 장비를 돌려놓을 공간이 없어요.' };
    const next = cloneProfile(profile);
    if (previous) next.bag[previous]++;
    next.bag[itemId]--;
    next.equipment[slot] = itemId;
    return { profile: next, message: `${ITEMS[itemId].name}을(를) 장착했어요.` };
}
export function unequipItem(profile: Profile, slot: EquipmentSlot): EquipmentResult {
    if (!Object.prototype.hasOwnProperty.call(EQUIPMENT_LABELS, slot)) return { message: '장비 부위를 확인해주세요.' };
    const id = profile.equipment[slot];
    if (!id) return { message: '장착한 장비가 없어요.' };
    if (profile.bag[id] >= 99999999) return { message: '가방의 보유 한도를 초과해 해제할 수 없어요.' };
    const next = cloneProfile(profile);
    next.equipment[slot] = null;
    next.bag[id]++;
    return { profile: next, message: `${ITEMS[id].name}을(를) 가방으로 옮겼어요.` };
}
export const EQUIPPED_DRAG_TYPE = 'application/x-mokdo-equipped-slot';
