import type { Scene } from 'phaser';
import { defaultCharacter } from './defaultCharacter';

export function registerDefaultCharacterAnimations(scene: Scene, textureKey: string = defaultCharacter.key) {
    for (const [name, animation] of Object.entries(defaultCharacter.animations)) {
        const key = `${textureKey}-${name}`;
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
            key,
            frames: animation.frames.map(frame => ({ key: textureKey, frame })),
            frameRate: animation.frameRate,
            repeat: animation.repeat
        });
    }
}
