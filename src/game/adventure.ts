import type { CharacterSummary } from '../api/auth';
import { clearCharacterProgress, selectCharacterProgress } from './progression';

let character: CharacterSummary | null = null;

export function startAdventure(selected: CharacterSummary): void {
    selectCharacterProgress(selected.id);
    character = { ...selected };
}

export function endAdventure(): void {
    character = null;
    clearCharacterProgress();
}

export function adventureCharacter(): CharacterSummary | null {
    return character;
}

export function adventurerName(): string {
    return character?.name ?? '여행자';
}
