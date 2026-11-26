// Preserve the supplied 128×352 sheet. Each cell is 32×32, without spacing.
const frameWidth = 32;
const frameHeight = 32;
const directions = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
export type CharacterDirection = typeof directions[number];
type Pose = 'idle' | 'step-1' | 'step-2' | 'crouch' | 'jump';
type FrameName = `${CharacterDirection}-${Pose}` | 'hurt' | 'collapse' | 'dead';
type Cell = readonly [column: number, row: number];
type Frame = { x: number; y: number; w: number; h: number };
type Animation = { frames: FrameName[]; frameRate: number; repeat: number };

const layout: Record<CharacterDirection, { idle: Cell; walk: readonly [Cell, Cell]; jump: readonly [Cell, Cell] }> = {
    south: { idle: [0, 0], walk: [[1, 0], [2, 0]], jump: [[0, 5], [1, 5]] },
    'south-west': { idle: [0, 9], walk: [[0, 3], [1, 3]], jump: [[2, 5], [3, 5]] },
    west: { idle: [1, 9], walk: [[3, 0], [0, 1]], jump: [[0, 6], [1, 6]] },
    'north-west': { idle: [2, 9], walk: [[0, 4], [1, 4]], jump: [[2, 6], [3, 6]] },
    north: { idle: [3, 9], walk: [[3, 1], [0, 2]], jump: [[0, 7], [1, 7]] },
    'north-east': { idle: [0, 10], walk: [[2, 4], [3, 4]], jump: [[2, 7], [3, 7]] },
    east: { idle: [1, 10], walk: [[1, 1], [2, 1]], jump: [[0, 8], [1, 8]] },
    'south-east': { idle: [2, 10], walk: [[2, 3], [3, 3]], jump: [[2, 8], [3, 8]] }
};

function frame([column, row]: Cell): Frame {
    return { x: column * frameWidth, y: row * frameHeight, w: frameWidth, h: frameHeight };
}

const frames = {} as Record<FrameName, Frame>;
const idle = {} as Record<CharacterDirection, FrameName>;
const animations = {} as Record<`walk-${CharacterDirection}` | `jump-${CharacterDirection}` | 'death', Animation>;
for (const direction of directions) {
    const cells = layout[direction];
    const idleName = `${direction}-idle` as const;
    const firstStep = `${direction}-step-1` as const;
    const secondStep = `${direction}-step-2` as const;
    const crouch = `${direction}-crouch` as const;
    const jump = `${direction}-jump` as const;
    frames[idleName] = frame(cells.idle);
    frames[firstStep] = frame(cells.walk[0]);
    frames[secondStep] = frame(cells.walk[1]);
    frames[crouch] = frame(cells.jump[0]);
    frames[jump] = frame(cells.jump[1]);
    idle[direction] = idleName;
    animations[`walk-${direction}`] = { frames: [idleName, firstStep, idleName, secondStep], frameRate: 8, repeat: -1 };
    animations[`jump-${direction}`] = { frames: [crouch, jump, idleName], frameRate: 6, repeat: 0 };
}
frames.hurt = frame([1, 2]);
frames.collapse = frame([2, 2]);
frames.dead = frame([3, 2]);
animations.death = { frames: ['hurt', 'collapse', 'dead'], frameRate: 5, repeat: 0 };

export const defaultCharacter = {
    key: 'common-character-01',
    textureUrl: '/assets/characters/common_character_01.png',
    sheetWidth: 128,
    sheetHeight: 352,
    displayScale: 3,
    frames,
    idle,
    animations
} as const;

export function defaultCharacterAtlas() {
    return {
        frames: Object.fromEntries(Object.entries(defaultCharacter.frames).map(([name, rect]) => [name, {
            frame: rect, rotated: false, trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
            sourceSize: { w: frameWidth, h: frameHeight }
        }])),
        meta: { image: 'common_character_01.png', size: { w: 128, h: 352 }, scale: '1' }
    };
}
