import type { Scene } from 'phaser';
import { defaultCharacter } from './defaultCharacter';

export function registerDefaultCharacterAnimations(scene: Scene) {
    for (const [name, animation] of Object.entries(defaultCharacter.animations)) {
        const key = `${defaultCharacter.key}-${name}`;
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
            key,
            frames: animation.frames.map(frame => ({ key: defaultCharacter.key, frame })),
            frameRate: animation.frameRate,
            repeat: animation.repeat
        });
    }
}
