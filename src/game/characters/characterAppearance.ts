import { defaultCharacter } from './defaultCharacter';

// Costumes use the same sheet dimensions and frame layout as the default character.
export function characterTextureUrl(appearanceCode?: string | null): string {
    if (!appearanceCode || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(appearanceCode)) {
        return defaultCharacter.textureUrl;
    }
    return `/api/costumes/${appearanceCode}/image`;
}
