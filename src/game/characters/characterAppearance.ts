import { defaultCharacter } from './defaultCharacter';

// PNG layout comes from /api/costumes/{code}/sprite; legacy costumes keep the default layout.
export function characterTextureUrl(appearanceCode?: string | null): string {
    if (!appearanceCode || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(appearanceCode)) {
        return defaultCharacter.textureUrl;
    }
    return `/api/costumes/${appearanceCode}/image`;
}
