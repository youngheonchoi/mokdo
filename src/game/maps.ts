export interface MapPoint { x: number; y: number }
export interface MapRect extends MapPoint { width: number; height: number }
export interface MapObstacle extends MapPoint { radius: number; kind: 'tree' | 'rock' | 'house' | 'camp' }
export interface WorldMap {
    key: 'town' | 'field' | 'dungeon';
    width: number; height: number;
    bounds: MapRect;
    spawn: MapPoint;
    obstacles: MapObstacle[];
    rooms?: MapRect[];
}
export const TOWN_MAP: WorldMap = {
    key: 'town', width: 2560, height: 1600, bounds: { x: 75, y: 190, width: 2410, height: 1280 },
    spawn: { x: 620, y: 1000 },
    obstacles: [
        { x: 450, y: 760, radius: 64, kind: 'house' }, { x: 800, y: 560, radius: 64, kind: 'house' },
        { x: 1250, y: 1180, radius: 64, kind: 'house' }, { x: 1750, y: 570, radius: 64, kind: 'house' },
        { x: 620, y: 850, radius: 27, kind: 'camp' },
        ...[[320, 1130], [1050, 780], [1460, 540], [1550, 1250], [2050, 1200], [1950, 420]].map(([x, y]) => ({ x, y, radius: 34, kind: 'tree' as const })),
        { x: 1400, y: 1060, radius: 32, kind: 'rock' }
    ]
};
export const FIELD_MAP: WorldMap = {
    key: 'field', width: 3200, height: 1800, bounds: { x: 75, y: 190, width: 3050, height: 1480 },
    spawn: { x: 280, y: 1120 },
    obstacles: [
        ...[[440, 760], [780, 1350], [1040, 740], [1250, 1420], [1500, 620], [1800, 1400], [2040, 1000], [2470, 840], [2680, 1280], [3010, 1000], [2230, 310], [930, 350]].map(([x, y]) => ({ x, y, radius: 34, kind: 'tree' as const })),
        ...[[650, 440], [1270, 630], [1620, 1020], [2380, 1430], [2990, 440]].map(([x, y]) => ({ x, y, radius: 30, kind: 'rock' as const }))
    ]
};
export const DUNGEON_MAP: WorldMap = {
    key: 'dungeon', width: 3840, height: 1440, bounds: { x: 75, y: 190, width: 3690, height: 1120 },
    spawn: { x: 300, y: 760 },
    rooms: [
        { x: 90, y: 300, width: 1150, height: 820 },
        { x: 1160, y: 620, width: 1470, height: 280 },
        { x: 2550, y: 260, width: 1180, height: 1000 }
    ],
    obstacles: [
        { x: 410, y: 390, radius: 32, kind: 'rock' }, { x: 790, y: 1040, radius: 32, kind: 'rock' },
        { x: 2800, y: 400, radius: 33, kind: 'rock' }, { x: 3550, y: 1110, radius: 32, kind: 'rock' }
    ]
};
export const DUNGEON_GATE_X = 1200;
export const BOSS_POSITION = { x: 3200, y: 750 };
export const BOSS_ARENA: MapRect = { x: 2645, y: 285, width: 1060, height: 945 };
export interface SpikeTrap extends MapRect { offset: number }
export const SPIKE_TRAPS: SpikeTrap[] = [
    { x: 1330, y: 620, width: 160, height: 145, offset: 0 },
    { x: 1620, y: 755, width: 160, height: 145, offset: 0.8 },
    { x: 1910, y: 620, width: 160, height: 145, offset: 1.6 },
    { x: 2200, y: 755, width: 160, height: 145, offset: 2.4 }
];
export type SpikeState = 'idle' | 'warning' | 'active';
export function spikeState(elapsed: number, offset: number): SpikeState {
    const phase = ((elapsed + offset) % 3.4 + 3.4) % 3.4;
    return phase < 1.55 ? 'idle' : phase < 2.65 ? 'warning' : 'active';
}
export function inRect(point: MapPoint, rect: MapRect, padding = 0) {
    return point.x >= rect.x + padding && point.x <= rect.x + rect.width - padding && point.y >= rect.y + padding && point.y <= rect.y + rect.height - padding;
}
export function onWalkableFloor(point: MapPoint, map: WorldMap, radius = 14) {
    return inRect(point, map.bounds) && (!map.rooms || map.rooms.some(room => inRect(point, room, radius)));
}
