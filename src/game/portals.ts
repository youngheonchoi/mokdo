export type MapId = 'forest' | 'clearing';
export const maps = {
    forest: { name: '숲길 초입', tint: 0xffffff },
    clearing: { name: '숲속 공터', tint: 0xb9d6b2 }
};
export const portals = [
    { id: 'forest-east', mapId: 'forest', x: 3400, y: 560, destination: '숲속 공터' },
    { id: 'clearing-west', mapId: 'clearing', x: 200, y: 560, destination: '숲길 초입' }
] as const;
export const nearbyPortal = (mapId: MapId, x: number, y: number) => portals.find(portal =>
    portal.mapId === mapId && Math.hypot(x - portal.x, y - portal.y) <= 100);
