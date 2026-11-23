import { Scene } from 'phaser';

// All MVP artwork is drawn locally by world.ts; no network assets are required.
export class Preloader extends Scene {
    constructor() { super('Preloader'); }
    create() { this.scene.start('MainMenu'); }
}
