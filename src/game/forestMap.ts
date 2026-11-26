import type { GameObjects, Scene } from 'phaser';

export const forestMap = {
    size: 64,
    spawn: { x: 0, y: 1024 },
    tileUrl: '/assets/terrain/forest-tiles.png',
    treeUrl: '/assets/objects/forest-tree.png',
    atlas: {
        frames: Object.fromEntries(Array.from({ length: 16 }, (_, index) => [String(index), {
            frame: { x: (index % 4) * 33, y: Math.floor(index / 4) * 33, w: 32, h: 32 },
            rotated: false, trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }
        }])),
        meta: { size: { w: 131, h: 131 }, scale: '1' }
    }
};

export type Obstacle = { x: number; y: number; radius: number; tree?: GameObjects.Image };

function random(x: number, y: number) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
}

function isPath(x: number, y: number) {
    const vertical = Math.abs(x - Math.sin(y / 180) * 65) < 58;
    const horizontal = Math.abs(y - forestMap.spawn.y - Math.sin(x / 160) * 30) < 43;
    return vertical || horizontal || (x / 210) ** 2 + ((y - forestMap.spawn.y) / 116) ** 2 < 1;
}

export function buildForest(scene: Scene): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const size = forestMap.size;
    let treeIndex = 0;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const x = (col - row) * 32;
            const y = (col + row) * 16;
            const r = random(col, row);
            const path = isPath(x, y);
            const edge = !path && (isPath(x + 32, y + 16) || isPath(x - 32, y - 16));
            const frame = path ? (r < .72 ? 4 : r < .88 ? 5 : 6)
                : edge ? 8 + Math.floor(r * 4)
                : r < .55 ? 0 : r < .75 ? 3 : r < .90 ? 1 : 2;
            scene.add.image(x, y, 'forest-tiles', String(frame)).setScale(2).setDepth(-10000 + y * .01);
            if (!path && r < .14 && col > 1 && row > 1 && col < size - 2 && row < size - 2) {
                if (treeIndex++ % 10 !== 0) continue;
                scene.add.ellipse(x, y + 2, 104, 38, 0x0d211a, .16).setDepth(y - 1);
                const tree = scene.add.image(x, y, 'forest-tree').setScale(2).setOrigin(.5, .96).setDepth(y);
                obstacles.push({ x, y, radius: 30, tree });
            }
        }
    }
    return obstacles;
}

export function isForestPositionWalkable(x: number, y: number, obstacles: Obstacle[]) {
    const col = (x / 32 + y / 16) / 2;
    const row = (y / 16 - x / 32) / 2;
    return col >= 2 && row >= 2 && col <= forestMap.size - 3 && row <= forestMap.size - 3
        && !obstacles.some(obstacle => Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + 9);
}
