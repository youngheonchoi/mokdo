export type GameCharacter = {
    characterId: string;
    slotNo: number;
    nickname: string;
    level?: number;
    exp?: number;
    maxHp?: number;
    attack?: number;
    defense?: number;
    requiredExp?: number | null;
    equippedCostumeId?: string | null;
    appearanceCode?: string | null;
    weapon?: { characterItemId: string; itemId: string; itemCode: string; name: string; appearanceCode: string } | null;
};
