import { AUTO, Game, Scale } from 'phaser';
import { Forest } from './scenes/Forest';
import type { GameCharacter } from './types';

export default function StartGame(parent: HTMLElement, character: GameCharacter,
    callbacks: ConstructorParameters<typeof Forest>[1]) {
    return new Game({
        type: AUTO, parent, width: parent.clientWidth, height: parent.clientHeight,
        backgroundColor: '#24372c', pixelArt: true, roundPixels: true,
        fps: { smoothStep: false },
        scale: { mode: Scale.RESIZE, resizeInterval: 100 },
        input: { keyboard: true },
        scene: [new Forest(character, callbacks)]
    });
}
