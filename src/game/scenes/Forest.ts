import { GameObjects, Input, Scene } from 'phaser';
import { defaultCharacter, defaultCharacterAtlas } from '../characters/defaultCharacter';
import { defaultWeapon } from '../characters/defaultWeapon';
import { characterTextureUrl } from '../characters/characterAppearance';
import { weaponTextureUrl } from '../characters/weaponAppearance';
import { registerDefaultCharacterAnimations } from '../characters/registerDefaultCharacter';
import { buildForest, forestMap, isForestPositionWalkable, type Obstacle } from '../forestMap';
import type { GameCharacter } from '../types';

type Direction = keyof typeof defaultCharacter.idle;
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
    private facing: Direction = 'south';
    private textureKey = defaultCharacter.key as string;
    private jumpingUntil = 0;
    private jumpRequested = false;
    private attackRequested = false;
    private attackStartedAt = -Infinity;
    private attackReadyAt = 0;
    private attackFacing: Direction = 'south';
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
        this.sprite = this.add.sprite(0, 0, this.textureKey, 'south-idle').setOrigin(.5, .875).setScale(defaultCharacter.displayScale);
        this.player = this.add.container(x, y, [this.sprite]).setDepth(y);
        const weaponKey = this.textures.exists('player-weapon') ? 'player-weapon'
            : this.character.weapon?.appearanceCode === defaultWeapon.key && this.textures.exists(defaultWeapon.key) ? defaultWeapon.key : null;
        if (weaponKey) {
            this.weapon = this.add.image(32, -12, weaponKey)
                .setDisplaySize(defaultWeapon.displaySize, defaultWeapon.displaySize).setOrigin(.5, .85);
            this.player.add(this.weapon);
        }
        this.cameras.main.startFollow(this.player, true, 1, 1);
        this.cameras.main.roundPixels = true;
        this.cameras.main.centerOn(x, y);
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keys = this.input.keyboard!.addKeys('SPACE,Z') as typeof this.keys;
        this.keys.SPACE.on('down', () => { this.jumpRequested = true; });
        this.keys.Z.on('down', () => { this.attackRequested = true; });
        this.game.events.on('blur', this.resetInput, this);
        const resizeCamera = () => {
            this.cameras.main.setSize(this.scale.width, this.scale.height).centerOn(this.player.x, this.player.y);
        };
        const updateOverlay = () => {
            const camera = this.cameras.main;
            this.callbacks.position(this.player.x, this.player.y,
                Math.round(this.player.x - camera.worldView.x),
                Math.round(this.player.y + this.sprite.y - 66 - camera.worldView.y));
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
            const vx = dx / distance * step / substeps, vy = dy / distance * step / substeps;
            for (let i = 0; i < substeps; i++) {
                if (isForestPositionWalkable(this.player.x + vx, this.player.y, this.obstacles)) {
                    this.player.x += vx;
                    moved ||= Math.abs(vx) > .01;
                }
                if (isForestPositionWalkable(this.player.x, this.player.y + vy, this.obstacles)) {
                    this.player.y += vy;
                    moved ||= Math.abs(vy) > .01;
                }
            }
            this.facing = dx && dy ? `${dy > 0 ? 'south' : 'north'}-${dx > 0 ? 'east' : 'west'}`
                : dx ? dx > 0 ? 'east' : 'west' : dy > 0 ? 'south' : 'north';
        }
        const jumpPressed = this.jumpRequested;
        this.jumpRequested = false;
        if (jumpPressed && time >= this.jumpingUntil) {
            this.jumpingUntil = time + 480;
            this.sprite.play(`${this.textureKey}-jump-${this.facing}`);
        }
        if (time < this.jumpingUntil) this.sprite.y = -Math.sin((1 - (this.jumpingUntil - time) / 480) * Math.PI) * 28;
        else {
            this.sprite.y = 0;
            if (moved) this.sprite.play(`${this.textureKey}-walk-${this.facing}`, true);
            else {
                this.sprite.stop();
                this.sprite.setFrame(defaultCharacter.idle[this.facing]);
            }
        }
        this.player.setDepth(this.player.y);
        this.shadow.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 1);
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
                const facingAngle = {
                    east: 0, 'south-east': Math.PI / 4, south: Math.PI / 2, 'south-west': Math.PI * 3 / 4,
                    west: Math.PI, 'north-west': -Math.PI * 3 / 4, north: -Math.PI / 2, 'north-east': -Math.PI / 4
                }[this.attackFacing];
                const arc = facingAngle - 1.1 + (1 - (1 - progress) ** 2) * 2.2;
                this.weapon.setPosition(Math.cos(arc) * 35, -20 + Math.sin(arc) * 22);
                this.weapon.setRotation(arc + Math.PI / 2);
                if (this.attackFacing.startsWith('north')) this.player.sendToBack(this.weapon);
                else this.player.bringToTop(this.weapon);
            } else {
                this.weapon.setPosition(32, -12 + (this.reducedMotion ? 0 : Math.sin(time / 900) * 3)).setRotation(0);
                this.player.bringToTop(this.weapon);
            }
        }
    }
}
