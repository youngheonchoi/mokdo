// Preserve the supplied sheet; named frames crop it only at render time.
const cell = 1254 / 4;
const frameWidth = 256;
const frameHeight = 280;

function frame(column: number, row: number) {
    return { x: Math.round(column * cell) + 30, y: Math.round(row * cell) + 20,
        w: frameWidth, h: frameHeight };
}

export const defaultCharacter = {
    key: 'common-character-01',
    textureUrl: '/assets/characters/common_character_01.png',
    sheetWidth: 1254,
    sheetHeight: 1254,
    frames: {
        'south-idle': frame(0, 0),
        'south-step-1': frame(1, 0),
        'south-step-2': frame(2, 0),
        'west-step-1': frame(3, 0),
        'west-step-2': frame(0, 1),
        'east-step-1': frame(1, 1),
        'east-step-2': frame(2, 1),
        'north-step-1': frame(3, 1),
        'north-step-2': frame(0, 2),
        hurt: frame(1, 2),
        collapse: frame(2, 2),
        dead: frame(3, 2),
        crouch: frame(0, 3),
        jump: frame(1, 3)
    },
    idle: { south: 'south-idle', west: 'west-step-1', east: 'east-step-1', north: 'north-step-1' },
    animations: {
        'walk-south': { frames: ['south-idle', 'south-step-1', 'south-idle', 'south-step-2'], frameRate: 8, repeat: -1 },
        'walk-west': { frames: ['west-step-1', 'west-step-2'], frameRate: 6, repeat: -1 },
        'walk-east': { frames: ['east-step-1', 'east-step-2'], frameRate: 6, repeat: -1 },
        'walk-north': { frames: ['north-step-1', 'north-step-2'], frameRate: 6, repeat: -1 },
        jump: { frames: ['crouch', 'jump', 'south-idle'], frameRate: 6, repeat: 0 },
        death: { frames: ['hurt', 'collapse', 'dead'], frameRate: 5, repeat: 0 }
    }
} as const;

export function defaultCharacterAtlas() {
    return {
        frames: Object.fromEntries(Object.entries(defaultCharacter.frames).map(([name, rect]) => [name, {
            frame: rect,
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
            sourceSize: { w: frameWidth, h: frameHeight }
        }])),
        meta: { image: 'common_character_01.png', size: { w: 1254, h: 1254 }, scale: '1' }
    };
}
