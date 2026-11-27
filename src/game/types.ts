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

export type InventoryItem = {
    characterItemId: string;
    itemId: string;
    itemCode: string;
    name: string;
    itemType: string;
    quantity: number;
    appearanceCode: string | null;
    equipped: boolean;
    requiredLevel: number;
    attack: number;
    defense: number;
    hp: number;
};
