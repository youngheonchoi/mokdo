import { frameFootprint, type FrameFootprint } from '../assets/frameFootprint';
import { legacyCharacterSheet, spriteSheet, registerSheet, playAction, type SpriteSheet } from '../assets/spriteSheet';
import { moveMonster, monsterBehavior } from '../monsterMotion';
import { GameObjects, Input, Scene } from 'phaser';
import { defaultCharacter, defaultCharacterAtlas } from '../characters/defaultCharacter';
import { defaultWeapon } from '../characters/defaultWeapon';
import { inferWeaponGrip, weaponPose, type WeaponGrip } from '../characters/weaponGrip';
import { characterTextureUrl } from '../characters/characterAppearance';
import { weaponTextureUrl } from '../characters/weaponAppearance';
import { registerDefaultCharacterAnimations } from '../characters/registerDefaultCharacter';
import { buildForest, forestMap, isForestPositionWalkable, type Obstacle } from '../forestMap';
import type { GameCharacter } from '../types';
import type { BattleEffect, BattleInput, BattlePrediction, BattleState, BattleStrike } from '../battleTypes';

type Direction = 'east' | 'west';
type SceneCallbacks = { ready: () => void; failed: () => void; position: (x: number, y: number, screenX: number, screenY: number) => void; battlePosition?: (x: number, y: number, scrollX: number, scrollY: number, zoom: number) => void; battleView?: (state: BattleState) => void; action?: () => void };

export class Forest extends Scene {
    private character: GameCharacter;
    private callbacks: SceneCallbacks;
    private player: GameObjects.Container;
    private sprite: GameObjects.Sprite;
    private weapon?: GameObjects.Image;
    private weaponGrip: WeaponGrip = { originX: .5, originY: .85, axisAngle: -Math.PI / 2 };
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
    private battleAvailable = false;
    private outgoingJump = false;
    private enemy?: GameObjects.Container;
    private enemyImage?: GameObjects.Sprite;
    private characterSheet: SpriteSheet = legacyCharacterSheet;
    private enemyAnimated = false;
    private enemyFacing: Direction = 'west';
    private enemyAttackUntil = 0;
    private enemyAttackFacing: Direction = 'west';
    private enemyHurtUntil = 0;
    private enemyShadow?: GameObjects.Ellipse;
    private enemyFootprints = new Map<string, FrameFootprint>();
    private enemyHp = 0;
    private enemyTexture?: string;
    private enemyLoaded = false;
    private hurtUntil = 0;
    private movementX = 0;
    private movementY = 0;
    private sentMovementX = 0;
    private sentMovementY = 0;
    private correctionX = 0;
    private correctionY = 0;
    private enemyCorrectionX = 0;
    private enemyCorrectionY = 0;
    private enemyReturning = false;
    private battleState?: BattleState;
    private strikeSeq = 0;
    private strikeResolved = true;
    private queuedStrikes: BattleStrike[] = [];
    private pendingHits = new Map<number, { generation: number; damage: number }>();
    private shownHits = new Set<number>();

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
        if (costume !== defaultCharacter.textureUrl) {
            this.load.image('player-costume-source', costume);
            this.load.json('player-costume-metadata', `/api/costumes/${this.character.appearanceCode}/sprite`);
        }
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
        if (this.textures.exists('player-costume-source')) {
            this.characterSheet = spriteSheet(this.cache.json.get('player-costume-metadata')) ?? legacyCharacterSheet;
            try { registerSheet(this, 'player-costume', 'player-costume-source', this.characterSheet); }
            catch { this.callbacks.failed(); return; }
            this.textureKey = 'player-costume';
        } else registerDefaultCharacterAnimations(this);
        const { x, y } = forestMap.spawn;
        this.shadow = this.add.ellipse(x, y, 28, 11, 0x13241c, .3).setDepth(y - 1);
        this.sprite = this.add.sprite(0, 0, this.textureKey, 'east-idle').setOrigin(.5, .875).setScale(96 / this.characterSheet.cellHeight);
        this.player = this.add.container(x, y, [this.sprite]).setDepth(y);
        const weaponKey = this.textures.exists('player-weapon') ? 'player-weapon'
            : this.character.weapon?.appearanceCode === defaultWeapon.key && this.textures.exists(defaultWeapon.key) ? defaultWeapon.key : null;
        if (weaponKey) {
            this.attachWeapon(weaponKey);
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
            this.callbacks.battlePosition?.(this.enemy?.x ?? 800, this.enemy?.y ?? 560,
                camera.worldView.x, camera.worldView.y, camera.zoom);
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
        this.outgoingJump = false;
        this.input.keyboard?.resetKeys();
    }

    setUiBlocked(blocked: boolean) {
        this.uiBlocked = blocked;
        this.resetInput();
        if (this.input.keyboard) this.input.keyboard.enabled = !blocked;
    }

    setBattleAvailable(available: boolean) {
        if (this.battleAvailable !== available) this.resetInput();
        this.battleAvailable = available;
    }

    battleInput(): BattleInput {
        const paused = this.uiBlocked || !this.battleAvailable || document.hidden;
        const dead = (this.character.currentHp ?? 1) === 0;
        const input = {
            moveX: paused || dead ? 0 : Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown),
            moveY: paused || dead ? 0 : Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown),
            attack: false,
            jump: !paused && !dead && this.outgoingJump, paused,
            travelX: paused || dead ? 0 : this.movementX - this.sentMovementX,
            travelY: paused || dead ? 0 : this.movementY - this.sentMovementY,
            strikes: paused || dead ? [] : this.queuedStrikes.slice(0, 8),
            prediction: { movementX: this.movementX, movementY: this.movementY, sentAt: performance.now() }
        };
        this.sentMovementX = this.movementX;
        this.sentMovementY = this.movementY;
        this.outgoingJump = false;
        return input;
    }

    applyBattle(state: BattleState, entering: boolean, prediction?: BattlePrediction) {
        const previousGeneration = this.battleState?.monster.generation;
        const wasDead = (this.character.currentHp ?? 1) === 0;
        if (entering) {
            this.strikeSeq = 0;
            this.pendingHits.clear(); this.queuedStrikes = []; this.shownHits.clear();
        }
        for (const [id, hit] of this.pendingHits) {
            if (id <= state.lastAttackId || hit.generation !== state.monster.generation) this.pendingHits.delete(id);
        }
        this.queuedStrikes = this.queuedStrikes.filter(strike => strike.id > state.lastAttackId && strike.generation === state.monster.generation);
        const effects = state.effects.filter(effect => effect.attackId == null || !this.shownHits.has(effect.attackId));
        this.battleState = { ...state, effects: [] };
        this.setCharacter(state.character);
        const dead = (state.character.currentHp ?? 1) === 0;
        if (wasDead && !dead) this.sprite.setAlpha(1).clearTint();
        if (entering || dead || wasDead !== dead) {
            this.player.setPosition(state.player.x, state.player.y);
            this.facing = state.player.facing;
            this.correctionX = this.correctionY = 0;
            this.sentMovementX = this.movementX;
            this.sentMovementY = this.movementY;
        } else if (prediction) {
            // Reconcile against the acknowledged input, preserving movement that
            // happened while the HTTP response was in flight. Never snap on ticks.
            this.correctionX = state.player.x + this.movementX - prediction.movementX - this.player.x;
            this.correctionY = state.player.y + this.movementY - prediction.movementY - this.player.y;
        }
        if (dead) {
            this.jumpingUntil = 0; this.resetInput();
            this.pendingHits.clear(); this.queuedStrikes = []; this.strikeResolved = true;
        }
        const receivedAt = performance.now();
        if (!this.enemy) {
            this.enemyShadow = this.add.ellipse(state.monster.x, state.monster.y, 56, 16, 0x102118, .35);
            this.enemy = this.add.container(state.monster.x, state.monster.y);
            const placeholder = this.add.ellipse(0, -26, 66, 52, 0x698a4c).setStrokeStyle(2, 0xb3c78a);
            const missing = this.add.text(0, -28, '이미지 없음', { fontSize: '11px', color: '#ffffff' }).setOrigin(.5);
            this.enemy.add([placeholder, missing]);
            const key = `monster-${state.monster.definition.monsterId}`;
            this.enemyTexture = key;
            this.load.image(`${key}-source`, `/api/monsters/${state.monster.definition.monsterId}/image`);
            this.load.json(`${key}-metadata`, `/api/monsters/${state.monster.definition.monsterId}/sprite`);
            this.load.once('complete', () => {
                if (!this.sys.isActive() || this.enemyTexture !== key || !this.textures.exists(`${key}-source`)) return;
                const sheet = spriteSheet(this.cache.json.get(`${key}-metadata`));
                if (sheet) {
                    try { registerSheet(this, key, `${key}-source`, sheet); }
                    catch { return; }
                    this.enemyAnimated = true;
                }
                placeholder.destroy(); missing.destroy();
                this.enemyImage = this.add.sprite(0, 0, sheet ? key : `${key}-source`, sheet ? 'west-idle' : undefined).setOrigin(.5, 1);
                this.enemyImage.setScale(Math.min(80 / this.enemyImage.width, 80 / this.enemyImage.height));
                this.enemy!.add(this.enemyImage);
                this.positionEnemyShadow();
            });
            this.load.start();
        }
        if (entering || !this.enemyLoaded || previousGeneration !== state.monster.generation) {
            this.enemy.setPosition(state.monster.x, state.monster.y);
            this.enemyCorrectionX = this.enemyCorrectionY = 0;
            this.enemyReturning = state.monster.returning;
        } else {
            if (state.monster.returning) this.enemyReturning = true;
            else if (Math.hypot(this.enemy.x - monsterBehavior.home.x, (this.enemy.y - monsterBehavior.home.y) / .6) <= 2) this.enemyReturning = false;
            // Advance continuously between packets; use snapshots only to correct
            // drift. Account for response transit before setting the correction.
            const age = prediction ? Math.min(.5, (receivedAt - prediction.sentAt) / 2000) : 0;
            const projected = moveMonster({ x: state.monster.x, y: state.monster.y, returning: state.monster.returning },
                state.player.x, state.player.y, age);
            this.enemyCorrectionX = projected.x - this.enemy.x;
            this.enemyCorrectionY = projected.y - this.enemy.y;
        }
        this.enemyLoaded = true;
        this.publishBattle(effects);
        for (const event of effects) {
            if (event.kind === 'MONSTER_HIT' && this.enemyImage) {
                this.enemyHurtUntil = this.time.now + 140;
                this.enemyImage.setTint(0xffb2a2);
                this.time.delayedCall(140, () => this.enemyImage?.clearTint());
            }
            if (event.kind === 'PLAYER_HIT') {
                this.enemyAttackFacing = state.player.x > state.monster.x ? 'east' : 'west';
                this.enemyAttackUntil = this.time.now + this.actionDuration(this.enemyTexture, 'attack', this.enemyAttackFacing);
                this.hurtUntil = this.time.now + 200;
                this.sprite.setTint(0xff9d8b);
                this.time.delayedCall(200, () => this.sprite.clearTint());
                if (this.enemyImage) this.tweens.add({ targets: this.enemyImage,
                    x: state.player.x > state.monster.x ? 12 : -12, duration: 90, yoyo: true });
            }
            if (event.kind === 'REVIVE') { this.sprite.setAlpha(1).clearTint(); this.hurtUntil = 0; }
        }
    }

    private positionEnemyShadow() {
        if (!this.enemy || !this.enemyShadow) return;
        let x = this.enemy.x, y = this.enemy.y;
        const image = this.enemyImage;
        if (image) {
            const frame = image.frame;
            const key = `${image.texture.key}:${frame.name}`;
            let feet = this.enemyFootprints.get(key);
            if (!feet) {
                feet = frameFootprint(image.texture.getSourceImage() as CanvasImageSource, frame);
                this.enemyFootprints.set(key, feet);
            }
            x += image.x + (feet.centerX - image.originX * frame.cutWidth) * image.scaleX;
            y += image.y + (feet.bottom - image.originY * frame.cutHeight) * image.scaleY;
        }
        // Overlap the lowest visible pixels slightly so the body rests on the shadow.
        this.enemyShadow.setPosition(x, y - 2).setDepth(this.enemy.y - 1);
    }

    private actionDuration(key: string | undefined, action: string, dir: string) {
        const anim = key && this.anims.get(`${key}-${action}-${dir}`);
        return anim ? anim.duration : 0;
    }

    private publishBattle(effects: BattleEffect[]) {
        if (!this.battleState) return;
        const damage = [...this.pendingHits.values()].reduce((sum, hit) =>
            sum + (hit.generation === this.battleState!.monster.generation ? hit.damage : 0), 0);
        const hp = Math.max(0, this.battleState.monster.hp - damage);
        if (this.enemy) {
            if (this.enemyHp > 0 && hp === 0) {
                if (this.enemyAnimated && this.enemyImage) playAction(this.enemyImage, this, this.enemyTexture!, 'death', this.enemyFacing);
                this.tweens.add({ targets: this.enemy, alpha: 0, delay: this.enemyAnimated ? this.actionDuration(this.enemyTexture, 'death', this.enemyFacing) : 0, duration: 250 });
            }
            else if (this.enemyHp === 0 && hp > 0) {
                this.enemyAttackUntil = this.enemyHurtUntil = 0;
                this.tweens.killTweensOf(this.enemy);
                this.enemy.setAlpha(.25);
                this.tweens.add({ targets: this.enemy, alpha: 1, duration: 250 });
            }
        }
        this.enemyHp = hp;
        this.enemyShadow?.setVisible(hp > 0);
        this.callbacks.battleView?.({ ...this.battleState, monster: { ...this.battleState.monster, hp }, effects });
    }

    private resolveStrike() {
        if (!this.enemy || !this.battleState || this.enemyHp <= 0) return;
        const strike: BattleStrike = { id: ++this.strikeSeq, generation: this.battleState.monster.generation,
            x: this.player.x, y: this.player.y, targetX: this.enemy.x, targetY: this.enemy.y, facing: this.attackFacing };
        this.queuedStrikes.push(strike);
        const forward = (strike.targetX - strike.x) * (strike.facing === 'east' ? 1 : -1);
        if (forward >= -18 && forward <= 110 && Math.abs(strike.targetY - strike.y) <= 38) {
            const damage = Math.min(this.enemyHp, Math.max(1, (this.character.attack ?? 0) - this.battleState.monster.definition.defense));
            this.pendingHits.set(strike.id, { generation: strike.generation, damage });
            this.shownHits.add(strike.id);
            for (const id of this.shownHits) if (id < strike.id - 256) this.shownHits.delete(id);
            this.enemyHurtUntil = this.time.now + 140;
            this.enemyImage?.setTint(0xffb2a2);
            this.time.delayedCall(140, () => this.enemyImage?.clearTint());
            this.publishBattle([{ kind: 'MONSTER_HIT', amount: damage, label: '', x: this.enemy.x, y: this.enemy.y, attackId: strike.id }]);
        }
        this.callbacks.action?.();
    }

    private attachWeapon(texture: string) {
        this.weapon = this.add.image(12, -23, texture);
        const source = this.textures.get(texture).getSourceImage() as HTMLImageElement;
        this.weaponGrip = inferWeaponGrip(source, this.weapon.width, this.weapon.height);
        this.weapon.setScale(defaultWeapon.displaySize / Math.max(this.weapon.width, this.weapon.height));
        this.player.add(this.weapon);
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
            this.attachWeapon(texture);
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
        const dead = (this.character.currentHp ?? 1) === 0;
        const blocked = this.uiBlocked || !this.battleAvailable || dead || document.hidden;
        const dx = blocked ? 0 : Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
        const dy = blocked ? 0 : Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
        const distance = Math.hypot(dx, dy);
        // Preserve real-time speed during slow frames; split travel so collisions cannot be skipped.
        // Cap only long stalls (such as returning from a suspended browser).
        const step = Math.min(250, Math.max(0, delta)) / 1000 * 210;
        let moved = false;
        const beforeX = this.player.x, beforeY = this.player.y;
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
        this.movementX += this.player.x - beforeX;
        this.movementY += this.player.y - beforeY;
        const blendCorrection = 1 - Math.exp(-Math.min(delta, 250) / 160);
        const correctionX = this.correctionX * blendCorrection;
        const correctionY = this.correctionY * blendCorrection;
        this.player.x = Math.max(forestMap.walkArea.left, Math.min(forestMap.walkArea.right, this.player.x + correctionX));
        this.player.y = Math.max(forestMap.walkArea.top, Math.min(forestMap.walkArea.bottom, this.player.y + correctionY));
        this.correctionX -= correctionX;
        this.correctionY -= correctionY;
        const jumpPressed = !blocked && this.jumpRequested;
        this.jumpRequested = false;
        if (jumpPressed && time >= this.jumpingUntil) {
            this.jumpingUntil = time + 480;
            this.outgoingJump = true;
        }
        this.sprite.y = !dead && time < this.jumpingUntil
            ? -Math.sin((1 - (this.jumpingUntil - time) / 480) * Math.PI) * 52 : 0;
        if (dead) {
            playAction(this.sprite, this, this.textureKey, 'death', this.facing);
            if (!this.anims.exists(`${this.textureKey}-death-${this.facing}`)) this.sprite.setFrame('dead');
            this.sprite.setAlpha(.6);
            this.sprite.y = 0;
        } else if (time < this.hurtUntil) {
            if (this.anims.exists(`${this.textureKey}-hurt-${this.facing}`)) playAction(this.sprite, this, this.textureKey, 'hurt', this.facing);
            else this.sprite.stop().setFrame('hurt');
        } else if (time < this.jumpingUntil) {
            const progress = 1 - (this.jumpingUntil - time) / 480;
            this.sprite.stop();
            const frames = this.characterSheet.animations[`jump-${this.facing}`]?.frames;
            this.sprite.setFrame(frames ? frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))]
                : `${this.facing}-${progress < .12 || progress > .9 ? 'crouch' : 'jump'}`);
            this.sprite.y = -Math.sin(progress * Math.PI) * 52;
        } else if (time - this.attackStartedAt >= 0 && time - this.attackStartedAt < 300
            && this.anims.exists(`${this.textureKey}-attack-${this.attackFacing}`)) {
            playAction(this.sprite, this, this.textureKey, 'attack', this.attackFacing, 300);
        } else {
            this.sprite.y = 0;
            if (moved) playAction(this.sprite, this, this.textureKey, 'walk', this.facing);
            else {
                playAction(this.sprite, this, this.textureKey, 'idle', this.facing);
            }
        }
        this.player.setDepth(this.player.y);
        this.shadow.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 1);
        this.shadow.setScale(1 + this.sprite.y / 160);
        this.positionCamera();
        if (this.enemy) {
            const beforeX = this.enemy.x, beforeY = this.enemy.y;
            if (!blocked && this.enemyHp > 0) {
                const wasReturning = this.enemyReturning;
                const motion = moveMonster({ x: this.enemy.x, y: this.enemy.y, returning: this.enemyReturning },
                    this.player.x, this.player.y, Math.min(delta, 250) / 1000);
                this.enemy.x = motion.x;
                this.enemy.y = motion.y;
                this.enemyReturning = motion.returning || (wasReturning && this.battleState?.monster.returning === true);
                if (wasReturning && !motion.returning) this.enemyCorrectionX = this.enemyCorrectionY = 0;
                const blend = 1 - Math.exp(-Math.min(delta, 250) / 200);
                this.enemy.x += this.enemyCorrectionX * blend;
                this.enemy.y += this.enemyCorrectionY * blend;
                this.enemyCorrectionX *= 1 - blend;
                this.enemyCorrectionY *= 1 - blend;
            }
            this.enemy.x = Math.max(forestMap.walkArea.left, Math.min(forestMap.walkArea.right, this.enemy.x));
            this.enemy.y = Math.max(forestMap.walkArea.top, Math.min(forestMap.walkArea.bottom, this.enemy.y));
            if (this.enemyAnimated && this.enemyImage && this.enemyHp > 0) {
                const moving = Math.hypot(this.enemy.x - beforeX, this.enemy.y - beforeY) > .01;
                if (Math.abs(this.enemy.x - beforeX) > .01) this.enemyFacing = this.enemy.x > beforeX ? 'east' : 'west';
                else if (!this.enemyReturning) this.enemyFacing = this.player.x > this.enemy.x ? 'east' : 'west';
                const action = time < this.enemyAttackUntil ? 'attack' : time < this.enemyHurtUntil ? 'hurt' : moving ? 'walk' : 'idle';
                playAction(this.enemyImage, this, this.enemyTexture!, action, action === 'attack' ? this.enemyAttackFacing : this.enemyFacing);
            }
            this.enemy.setDepth(this.enemy.y);
            this.positionEnemyShadow();
        }
        for (const { tree } of this.obstacles) {
            if (!tree) continue;
            const obscuresPlayer = this.player.y < tree.y && this.player.y > tree.y - tree.displayHeight
                && Math.abs(this.player.x - tree.x) < tree.displayWidth / 2 + 22;
            tree.setAlpha(obscuresPlayer ? .28 : 1);
        }
        if (!blocked && (this.attackRequested || this.keys.Z.isDown) && time >= this.attackReadyAt) {
            this.strikeResolved = false;
            this.attackStartedAt = time;
            this.attackReadyAt = time + 400;
            this.attackFacing = this.facing;
        }
        this.attackRequested = false;
        if (!this.strikeResolved && time - this.attackStartedAt >= 90) {
            this.strikeResolved = true;
            if (!blocked) this.resolveStrike();
        }
        if (this.weapon) {
            const progress = (time - this.attackStartedAt) / 300;
            const facing = progress >= 0 && progress < 1 ? this.attackFacing : this.facing;
            const pose = weaponPose(time, facing, progress, this.sprite.y, moved);
            const west = facing === 'west';
            const axis = west ? Math.PI - this.weaponGrip.axisAngle : this.weaponGrip.axisAngle;
            this.weapon.setVisible(!dead).setFlipX(west)
                .setOrigin(west ? 1 - this.weaponGrip.originX : this.weaponGrip.originX, this.weaponGrip.originY)
                .setPosition(pose.x, pose.y).setRotation(pose.angle - axis);
            this.sprite.x = pose.lean;
            this.player.bringToTop(this.weapon);
        } else this.sprite.x = 0;
    }
}
