import type { GameObjects, Scene } from 'phaser';

export const forestMap = {
    width: 3600,
    height: 900,
    walkArea: { left: 72, right: 3528, top: 430, bottom: 690 },
    spawn: { x: 400, y: 560 },
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

// Reuse the diamond tiles as a rectangular strip. The screen-space lattice is
// staggered, but movement bounds are ordinary floor coordinates, not tile axes.
export function buildForest(scene: Scene): Obstacle[] {
    const obstacles: Obstacle[] = [];
    for (let row = 0; row < 38; row++) {
        const y = 300 + row * 16;
        for (let col = -1; col <= forestMap.width / 64 + 1; col++) {
            const x = col * 64 + (row % 2) * 32;
            const r = random(col, row);
            const path = y >= 432 && y <= 688;
            const edge = y === 416 || y === 704;
            const frame = path ? (r < .7 ? 4 : r < .9 ? 5 : 6)
                : edge ? 8 + Math.floor(r * 4)
                : r < .55 ? 0 : r < .8 ? 3 : r < .95 ? 1 : 2;
            scene.add.image(x, y, 'forest-tiles', String(frame)).setScale(2).setDepth(-1000);
        }
    }
    // Distant trees use the same supplied PNG with tint/scale for forest depth.
    for (let row = 0; row < 3; row++) {
        for (let col = -1; col < forestMap.width / 116 + 1; col++) {
            const x = col * 116 + (row % 2) * 58;
            const y = 230 + row * 66 + random(col, row) * 18;
            scene.add.image(x, y, 'forest-tree').setOrigin(.5, .96)
                .setScale(2 + row * .12).setTint([0x40594e, 0x66805b, 0xa0ad78][row]).setDepth(y);
        }
    }
    // Foreground trunks sit outside the walkable strip. Fade their crowns when
    // they overlap the player, preserving the existing foot-position sorting.
    for (let col = -1; col < forestMap.width / 240 + 1; col++) {
        const x = col * 240 + random(col, 9) * 70;
        const y = 884 + random(col, 11) * 24;
        scene.add.ellipse(x, y, 104, 32, 0x0d211a, .2).setDepth(y - 1);
        const tree = scene.add.image(x, y, 'forest-tree').setScale(2.4).setOrigin(.5, .96).setDepth(y);
        obstacles.push({ x, y, radius: 30, tree });
    }
    // Trees close the boundaries visually; portals handle map transitions inside the walkable strip.
    for (const x of [0, forestMap.width]) {
        for (const y of [430, 570, 730]) {
            const tree = scene.add.image(x, y, 'forest-tree').setScale(2).setOrigin(.5, .96).setDepth(y);
            obstacles.push({ x, y, radius: 30, tree });
        }
    }
    return obstacles;
}

export function isForestPositionWalkable(x: number, y: number, obstacles: Obstacle[]) {
    const area = forestMap.walkArea;
    return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom
        && !obstacles.some(obstacle => Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius + 9);
}
