import { TOWN_MAP, type MapRect } from './maps';
export interface Position { x: number; y: number }
export interface Landmark extends Position { radius: number }
export const TOWN_PORTAL: Landmark = { x: 2200, y: 950, radius: 95 };
export const FIELD_RETURN: Landmark = { x: 145, y: 1120, radius: 74 };
export const CAVE_ENTRANCE: Landmark = { x: 2840, y: 520, radius: 95 };
export const FIELD_CAVE_SPAWN: Position = { x: 2780, y: 580 };
export const FIELD_TOWN_SPAWN: Position = { x: 280, y: 1120 };
export const nearLandmark = (position: Position, landmark: Landmark) => Math.hypot(position.x - landmark.x, position.y - landmark.y) <= landmark.radius;

export function walkExplorer(position: Position, input: Position, dt: number, obstacles: (Position & { radius: number })[], bounds: MapRect = TOWN_MAP.bounds) {
    const length = Math.hypot(input.x, input.y);
    if (!length) return;
    for (const axis of ['x', 'y'] as const) {
        const previous = position[axis];
        position[axis] = Math.max(bounds[axis], Math.min(bounds[axis] + (axis === 'x' ? bounds.width : bounds.height), previous + input[axis] / length * 215 * Math.min(dt, 0.05)));
        if (obstacles.some(obstacle => Math.hypot(position.x - obstacle.x, position.y - obstacle.y) < obstacle.radius + 14)) position[axis] = previous;
    }
}
