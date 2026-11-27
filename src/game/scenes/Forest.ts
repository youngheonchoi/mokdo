import { GameObjects, Input, Scene } from 'phaser';
import { defaultCharacter, defaultCharacterAtlas } from '../characters/defaultCharacter';
import { defaultWeapon } from '../characters/defaultWeapon';
import { characterTextureUrl } from '../characters/characterAppearance';
import { weaponTextureUrl } from '../characters/weaponAppearance';
import { registerDefaultCharacterAnimations } from '../characters/registerDefaultCharacter';
import { buildForest, forestMap, isForestPositionWalkable, type Obstacle } from '../forestMap';
import type { GameCharacter } from '../types';

type Direction = 'east' | 'west';
type SceneCallbacks = { ready: () => void; failed: () => void; position: (x: number, y: number, screenX: number, screenY: number) => void };

export class Forest extends Scene {
    private character: GameCharacter;
    private callbacks: SceneCallbacks;
    private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    private player: GameObjects.Container;
    private sprite: GameObjects.Sprite;
    private weapon?: GameObjects.Image;
    private shadow: GameObjects.Ellipse;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys: Record<'SPACE' | 'Z', Input.Keyboard.Key>;
    private obstacles: Obstacle[] = [];
    private facing: Direction = 'east';
    private textureKey = defaultCharacter.key as string;
    private jumpingUntil = 0;
    private jumpRequested = false;
    private attackRequested = false;
    private attackStartedAt = -Infinity;
    private attackReadyAt = 0;
    private attackFacing: Direction = 'east';
    private uiBlocked = false;
    private weaponRevision = 0;

    constructor(character: GameCharacter, callbacks: SceneCallbacks) {
        super('Forest');
        this.character = character;
        this.callbacks = callbacks;
    }

    preload() {
        this.load.atlas('forest-tiles', forestMap.tileUrl, forestMap.atlas);
        this.load.image('forest-tree', forestMap.treeUrl);
        this.load.atlas(defaultCharacter.key, defaultCharacter.textureUrl, defaultCharacterAtlas());
        this.load.image(defaultWeapon.key, defaultWeapon.textureUrl);
        const costume = characterTextureUrl(this.character.appearanceCode);
        if (costume !== defaultCharacter.textureUrl) this.load.atlas('player-costume', costume, defaultCharacterAtlas());
        const weapon = weaponTextureUrl(this.character.weapon?.appearanceCode, this.character.weapon?.itemId);
        if (weapon) {
            this.load.image('player-weapon', weapon);
        }
    }

    create() {
        if (!this.textures.exists('forest-tiles') || !this.textures.exists('forest-tree') || !this.textures.exists(defaultCharacter.key)) {
            this.callbacks.failed();
            return;
        }
        this.cameras.main.setBackgroundColor(0x24372c);
        this.obstacles = buildForest(this);
        this.textureKey = this.textures.exists('player-costume') ? 'player-costume' : defaultCharacter.key;
        registerDefaultCharacterAnimations(this, this.textureKey);
        const { x, y } = forestMap.spawn;
        this.shadow = this.add.ellipse(x, y, 28, 11, 0x13241c, .3).setDepth(y - 1);
        this.sprite = this.add.sprite(0, 0, this.textureKey, 'east-idle').setOrigin(.5, .875).setScale(defaultCharacter.displayScale);
        this.player = this.add.container(x, y, [this.sprite]).setDepth(y);
        const weaponKey = this.textures.exists('player-weapon') ? 'player-weapon'
            : this.character.weapon?.appearanceCode === defaultWeapon.key && this.textures.exists(defaultWeapon.key) ? defaultWeapon.key : null;
        if (weaponKey) {
            this.weapon = this.add.image(32, -12, weaponKey)
                .setDisplaySize(defaultWeapon.displaySize, defaultWeapon.displaySize).setOrigin(.5, .85);
            this.player.add(this.weapon);
        }
        this.cameras.main.roundPixels = true;
        this.resizeCamera();
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = this.input.keyboard!.addKeys('SPACE,Z') as typeof this.keys;
        this.keys.SPACE.on('down', () => { this.jumpRequested = true; });
        this.keys.Z.on('down', () => { this.attackRequested = true; });
        this.game.events.on('blur', this.resetInput, this);
        const resizeCamera = () => this.resizeCamera();
        const updateOverlay = () => {
            const camera = this.cameras.main;
            this.callbacks.position(this.player.x, this.player.y,
                Math.round((this.player.x - camera.worldView.x) * camera.zoom),
                Math.round((this.player.y + this.sprite.y - 66 - camera.worldView.y) * camera.zoom));
        };
        this.game.events.on('postrender', updateOverlay);
        this.scale.on('resize', resizeCamera);
        this.events.once('shutdown', () => {
            this.game.events.off('blur', this.resetInput, this);
            this.scale.off('resize', resizeCamera);
            this.game.events.off('postrender', updateOverlay);
        });
        this.callbacks.ready();
    }

    private resizeCamera() {
        const camera = this.cameras.main;
        // Keep the complete floor depth visible at every viewport aspect ratio.
        camera.setSize(this.scale.width, this.scale.height).setZoom(this.scale.height / forestMap.height);
        this.positionCamera();
    }

    private positionCamera() {
        const camera = this.cameras.main;
        const halfWidth = camera.width / camera.zoom / 2;
        const x = halfWidth * 2 >= forestMap.width ? forestMap.width / 2
            : Math.max(halfWidth, Math.min(forestMap.width - halfWidth, this.player.x));
        camera.centerOn(x, forestMap.height / 2);
    }

    private resetInput() {
        this.jumpRequested = false;
        this.attackRequested = false;
        this.input.keyboard?.resetKeys();
    }

    setUiBlocked(blocked: boolean) {
        this.uiBlocked = blocked;
        this.resetInput();
        if (this.input.keyboard) this.input.keyboard.enabled = !blocked;
    }

    setCharacter(character: GameCharacter) {
        const previous = this.character.weapon;
        this.character = character;
        if (previous?.characterItemId === character.weapon?.characterItemId) return;
        const revision = ++this.weaponRevision;
        this.weapon?.destroy();
        this.weapon = undefined;
        this.attackStartedAt = -Infinity;
        this.attackRequested = false;
        const url = weaponTextureUrl(character.weapon?.appearanceCode, character.weapon?.itemId);
        if (!url) return;
        const key = `equipped-weapon-${character.weapon!.itemId}`;
        const attach = () => {
            if (!this.sys.isActive() || revision !== this.weaponRevision) return;
            const texture = this.textures.exists(key) ? key
                : character.weapon?.appearanceCode === defaultWeapon.key && this.textures.exists(defaultWeapon.key) ? defaultWeapon.key : null;
            if (!texture) return;
            this.weapon = this.add.image(32, -12, texture)
                .setDisplaySize(defaultWeapon.displaySize, defaultWeapon.displaySize).setOrigin(.5, .85);
            this.player.add(this.weapon);
        };
        if (this.textures.exists(key)) attach();
        else {
            this.load.image(key, url);
            this.load.once('complete', attach);
            this.load.start();
        }
    }

    update(time: number, delta: number) {
        if (!this.player || !this.cursors) return;
        const dx = this.uiBlocked ? 0 : Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const dy = this.uiBlocked ? 0 : Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
        const distance = Math.hypot(dx, dy);
        // Preserve real-time speed during slow frames; split travel so collisions cannot be skipped.
        // Cap only long stalls (such as returning from a suspended browser).
        const step = Math.min(250, Math.max(0, delta)) / 1000 * 210;
        let moved = false;
        if (distance) {
            const substeps = Math.max(1, Math.ceil(step / 4));
            const vx = dx / distance * step / substeps;
            const vy = dy / distance * step * .6 / substeps;
            const area = forestMap.walkArea;
            for (let i = 0; i < substeps; i++) {
                const nextX = Math.max(area.left, Math.min(area.right, this.player.x + vx));
                const nextY = Math.max(area.top, Math.min(area.bottom, this.player.y + vy));
                if (isForestPositionWalkable(nextX, this.player.y, this.obstacles)) {
                    moved ||= Math.abs(nextX - this.player.x) > .01;
                    this.player.x = nextX;
                }
                if (isForestPositionWalkable(this.player.x, nextY, this.obstacles)) {
                    moved ||= Math.abs(nextY - this.player.y) > .01;
                    this.player.y = nextY;
                }
            }
            // Depth movement keeps the last horizontal facing, as in a belt scroller.
            if (dx) this.facing = dx > 0 ? 'east' : 'west';
        }
        const jumpPressed = this.jumpRequested;
        this.jumpRequested = false;
        if (jumpPressed && time >= this.jumpingUntil) {
            this.jumpingUntil = time + 480;
        }
        if (time < this.jumpingUntil) {
            const progress = 1 - (this.jumpingUntil - time) / 480;
            this.sprite.stop();
            this.sprite.setFrame(`${this.facing}-${progress < .12 || progress > .9 ? 'crouch' : 'jump'}`);
            this.sprite.y = -Math.sin(progress * Math.PI) * 52;
        } else {
            this.sprite.y = 0;
            if (moved) this.sprite.play(`${this.textureKey}-walk-${this.facing}`, true);
            else {
                this.sprite.stop();
                this.sprite.setFrame(defaultCharacter.idle[this.facing]);
            }
        }
        this.player.setDepth(this.player.y);
        this.shadow.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 1);
        this.shadow.setScale(1 + this.sprite.y / 160);
        this.positionCamera();
        for (const { tree } of this.obstacles) {
            if (!tree) continue;
            const obscuresPlayer = this.player.y < tree.y && this.player.y > tree.y - tree.displayHeight
                && Math.abs(this.player.x - tree.x) < tree.displayWidth / 2 + 22;
            tree.setAlpha(obscuresPlayer ? .28 : 1);
        }
        if (this.attackRequested && this.weapon && time >= this.attackReadyAt) {
            this.attackStartedAt = time;
            this.attackReadyAt = time + 400;
            this.attackFacing = this.facing;
        }
        this.attackRequested = false;
        if (this.weapon) {
            const progress = (time - this.attackStartedAt) / 300;
            if (progress >= 0 && progress < 1) {
                const facingAngle = this.attackFacing === 'east' ? 0 : Math.PI;
                const arc = facingAngle - 1.1 + (1 - (1 - progress) ** 2) * 2.2;
                this.weapon.setPosition(Math.cos(arc) * 35, this.sprite.y - 20 + Math.sin(arc) * 22);
                this.weapon.setRotation(arc + Math.PI / 2);
                this.player.bringToTop(this.weapon);
            } else {
                this.weapon.setPosition(this.facing === 'east' ? 32 : -32, this.sprite.y - 12 + (this.reducedMotion ? 0 : Math.sin(time / 900) * 3)).setRotation(0);
                this.player.bringToTop(this.weapon);
            }
        }
    }
}
