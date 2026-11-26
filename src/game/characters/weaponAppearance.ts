export function weaponTextureUrl(appearanceCode?: string | null): string | null {
    if (!appearanceCode || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(appearanceCode)) return null;
    return `/asset-files/weapons/${appearanceCode}.png`;
}
