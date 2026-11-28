import type { GameCharacter } from './types';

export type BattleEffect = { kind: string; amount: number; label: string; x: number; y: number; attackId?: number | null };
export type BattleState = {
    mapId?: 'forest' | 'clearing';
    sessionId: string;
    seq: number;
    serverTime: number;
    character: GameCharacter;
    player: { x: number; y: number; facing: 'east' | 'west'; reviveAt: number | null };
    monster: {
        definition: { monsterId: string; monsterCode: string; name: string; level: number; maxHp: number; attack: number; defense: number; rewardExp: number; rewardCurrency: number };
        hp: number; x: number; y: number; respawnAt: number | null; generation: number; returning: boolean;
    };
    lastAttackId: number;
    effects: BattleEffect[];
};
export type BattlePrediction = { portalId?: string; movementX: number; movementY: number; sentAt: number };
export type BattleStrike = { id: number; generation: number; x: number; y: number; targetX: number; targetY: number; facing: 'east' | 'west' };
export type BattleInput = {
    portalId?: string;
    moveX: number; moveY: number; attack: boolean; jump: boolean; paused: boolean;
    strikes: BattleStrike[];
    travelX: number; travelY: number; prediction: BattlePrediction;
};
