export function weaponTextureUrl(appearanceCode?: string | null, itemId?: string | null): string | null {
    if (itemId && /^[a-f0-9-]{36}$/i.test(itemId)) return `/api/items/${itemId}/image`;
    if (!appearanceCode || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(appearanceCode)) return null;
    return `/asset-files/weapons/${appearanceCode}.png`;
}
