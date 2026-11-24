import { QuickslotStore } from './quickslots';
import { emptyBag, ITEMS, emptyEquipment, parseEquipment, type Equipment, type Bag } from './items';

export const SAVE_KEY = 'mokdo.solo.v1';
export const LEVEL_XP = [0, 80, 210, 400, 660] as const;
export interface Profile { version: 1; xp: number; bag: Bag; equipment: Equipment; kills: number; bossClears: number }
export const freshProfile = (): Profile => ({ version: 1, xp: 0, bag: emptyBag(), equipment: emptyEquipment(), kills: 0, bossClears: 0 });
export const cloneProfile = (profile: Profile): Profile => ({ ...profile, bag: { ...profile.bag }, equipment: { ...profile.equipment } });
export function levelOf(xp: number) { return LEVEL_XP.filter(required => xp >= required).length || 1; }
export function statsFor(xp: number) {
    const level = levelOf(xp);
    return { level, maxHp: 100 + (level - 1) * 25, attack: 32 + (level - 1) * 8 };
}
export function xpProgress(xp: number) {
    const level = levelOf(xp);
    if (level === 5) return { current: 0, required: 0, percent: 100 };
    const current = xp - LEVEL_XP[level - 1];
    const required = LEVEL_XP[level] - LEVEL_XP[level - 1];
    return { current, required, percent: current / required * 100 };
}

function validCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 99999999;
}
export function parseProfile(raw: string): Profile {
    const p = JSON.parse(raw);
    if (!p || p.version !== 1 || !validCount(p.xp) || p.xp > LEVEL_XP[4] || !validCount(p.kills) || !validCount(p.bossClears) ||
        !p.bag || !Object.keys(ITEMS).every(item => p.bag[item] === undefined && !['gold', 'moss', 'shard', 'core'].includes(item) || validCount(p.bag[item]))) throw new Error('Invalid save');
    return { version: 1, xp: p.xp, bag: Object.fromEntries(Object.keys(ITEMS).map(id => [id, p.bag[id] ?? 0])) as Bag, equipment: parseEquipment(p.equipment), kills: p.kills, bossClears: p.bossClears };
}

interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export class ProgressStore {
    private current = freshProfile();
    message = '';
    constructor(private storage: SaveStorage | null, private saveKey = SAVE_KEY) {
        if (!storage) { this.message = '저장소를 사용할 수 없어 이번 탭에서만 기록이 유지됩니다.'; return; }
        try {
            const raw = storage.getItem(this.saveKey);
            if (raw !== null) this.current = parseProfile(raw);
        } catch {
            this.message = '저장 기록을 읽지 못해 새 여행자로 시작합니다. 저장 공간과 브라우저 설정을 확인해 주세요.';
        }
    }
    read() { return cloneProfile(this.current); }
    commit(profile: Profile) {
        this.current = cloneProfile(profile);
        try {
            if (!this.storage) throw new Error('No storage');
            this.storage.setItem(this.saveKey, JSON.stringify(this.current));
            this.message = '';
        } catch { this.message = '자동 저장에 실패했습니다. 이번 탭에서는 계속할 수 있지만 새로고침 시 진행이 사라질 수 있습니다.'; }
    }
    reset(): boolean {
        try {
            if (this.storage) this.storage.removeItem(this.saveKey);
            this.current = freshProfile();
            this.message = this.storage ? '' : '이번 탭에서만 기록이 유지됩니다.';
            return true;
        } catch { this.message = '기록 초기화에 실패했습니다. 브라우저 저장 설정을 확인해 주세요.'; return false; }
    }
}
function browserStorage() {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage; } catch { return null; }
}
export const characterSaveKey = (characterId: string) => `${SAVE_KEY}.character.${encodeURIComponent(characterId)}`;
// The legacy anonymous save is deliberately left untouched; it has no character owner.
export let quickslots = new QuickslotStore(null);
export let progress = new ProgressStore(null);
export function selectCharacterProgress(characterId: string): void {
    progress = new ProgressStore(browserStorage(), characterSaveKey(characterId));
    quickslots = new QuickslotStore(browserStorage(), `${characterSaveKey(characterId)}.quickslots`);
}
export function clearCharacterProgress(): void {
    progress = new ProgressStore(null);
    quickslots = new QuickslotStore(null);
}
