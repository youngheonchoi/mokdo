import { defaultCharacter } from '../characters/defaultCharacter';
import type { Scene, GameObjects } from 'phaser';

export type SpriteSheet = {
    version: number; sheetWidth: number; sheetHeight: number; cellWidth: number; cellHeight: number;
    frames: Record<string, { x: number; y: number; w: number; h: number }>;
    animations: Record<string, { frames: string[]; frameRate: number; repeat: number }>;
};
export const legacyCharacterSheet: SpriteSheet = {
    version: 1, sheetWidth: defaultCharacter.sheetWidth, sheetHeight: defaultCharacter.sheetHeight,
    cellWidth: 32, cellHeight: 32, frames: { ...defaultCharacter.frames },
    animations: { ...defaultCharacter.animations,
        'idle-east': { frames: ['east-idle'], frameRate: 8, repeat: -1 },
        'idle-west': { frames: ['west-idle'], frameRate: 8, repeat: -1 } }
};
export function spriteSheet(data: unknown): SpriteSheet | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const sheet = data as SpriteSheet;
    return sheet.version === 1 && sheet.frames && sheet.animations ? sheet : undefined;
}
export function atlas(sheet: SpriteSheet) {
    const frames = { ...sheet.frames };
    // Aliases retain the game's existing hurt/jump/death behavior for optional actions.
    for (const dir of ['east', 'west']) {
        const idle = sheet.animations[`idle-${dir}`].frames[0];
        frames[`${dir}-idle`] = frames[idle];
        frames[`${dir}-crouch`] = frames[sheet.animations[`jump-${dir}`]?.frames[0] ?? idle];
        frames[`${dir}-jump`] = frames[sheet.animations[`jump-${dir}`]?.frames[1] ?? sheet.animations[`jump-${dir}`]?.frames[0] ?? idle];
    }
    const idle = sheet.animations['idle-east'].frames[0];
    frames.hurt ??= frames[sheet.animations['hurt-east']?.frames[0] ?? idle];
    frames.dead ??= frames[sheet.animations['death-east']?.frames.slice(-1)[0] ?? idle];
    return { frames: Object.fromEntries(Object.entries(frames).map(([name, frame]) => [name, {
        frame, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: frame.w, h: frame.h }, sourceSize: { w: frame.w, h: frame.h }
    }])), meta: { size: { w: sheet.sheetWidth, h: sheet.sheetHeight }, scale: '1' } };
}
export function registerSheet(scene: Scene, key: string, source: string, sheet: SpriteSheet) {
    const image = scene.textures.get(source).getSourceImage() as HTMLImageElement;
    if (image.width !== sheet.sheetWidth || image.height !== sheet.sheetHeight) throw new Error('PNG와 JSON 크기가 다릅니다.');
    scene.textures.addAtlas(key, image, atlas(sheet));
    for (const [name, anim] of Object.entries(sheet.animations)) {
        scene.anims.create({ key: `${key}-${name}`, frames: anim.frames.map(frame => ({ key, frame })),
            frameRate: anim.frameRate, repeat: anim.repeat });
    }
}
export function playAction(sprite: GameObjects.Sprite, scene: Scene, key: string, action: string, dir: string, duration?: number) {
    const animation = `${key}-${action}-${dir}`;
    if (scene.anims.exists(animation)) {
        sprite.anims.timeScale = duration ? scene.anims.get(animation).duration / duration : 1;
        if (sprite.anims.currentAnim?.key === animation && sprite.anims.currentAnim.repeat === 0) return;
        sprite.play(animation, true);
    }
    else { sprite.anims.timeScale = 1; sprite.stop().setFrame(`${dir}-idle`); }
}
