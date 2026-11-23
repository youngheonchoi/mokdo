import { GameObjects, Input, Scene } from 'phaser';
import { CombatWorld, type CombatEvent, type InputFrame, type AdventureMode } from '../combat';
import { createActor, drawAdventurer, drawForest, drawGuardian, drawMonster, type Actor } from '../world';
import { ITEMS } from '../items';
import { progress, statsFor, xpProgress } from '../progression';
import { mountUI, timeLabel } from '../ui';

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'attack' | 'dodge' | 'pause' | 'skill' | 'collect', Input.Keyboard.Key>;

export class Game extends Scene {
    world: CombatWorld;
    private hero: Actor;
    private guardian: Actor;
    private warningArt: GameObjects.Graphics;
    private slash: GameObjects.Graphics;
    private nameTag: GameObjects.Text;
    private keys: Keys;
    private ui: HTMLElement;
    private paused = false;
    private uiAttack = false;
    private uiDodge = false;
    private uiSkill = false;
    private uiCollect = false;
    private savedRevision = -1;
    private victoryShown = false;
    private monsterViews = new Map<number, { actor: Actor; bar: GameObjects.Graphics }>();
    private dropViews = new Map<number, GameObjects.Container>();
    private shotArt: GameObjects.Graphics;
    private moving = false;
    private phaseSeen = 1;
    private resultSent = false;
    private hpBar: HTMLElement;
    private bossBar: HTMLElement;
    private hpText: HTMLElement;
    private bossText: HTMLElement;
    private objective: HTMLElement;
    private patternText: HTMLElement;
    private timer: HTMLElement;
    private dodgeButton: HTMLButtonElement;
    private attackButton: HTMLButtonElement;

    constructor() { super('Game'); }

    create(data: { mode?: AdventureMode } = {}) {
        this.world = new CombatWorld(data.mode ?? 'boss', progress.read());
        this.uiSkill = false; this.uiCollect = false; this.savedRevision = 0; this.victoryShown = false;
        this.monsterViews = new Map(); this.dropViews = new Map();
        const field = this.world.mode === 'field';
        this.paused = false;
        this.uiAttack = false;
        this.uiDodge = false;
        this.phaseSeen = 1;
        this.resultSent = false;
        drawForest(this);
        this.warningArt = this.add.graphics().setDepth(2);
        this.slash = this.add.graphics().setDepth(700);
        this.shotArt = this.add.graphics().setDepth(680);
        this.guardian = createActor(this);
        this.hero = createActor(this);
        this.nameTag = this.add.text(0, 0, '여행자', { fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#e2f4df', stroke: '#17372e', strokeThickness: 4 }).setOrigin(0.5).setDepth(800);
        this.add.text(368, 374, '속삭이는 숲', { fontSize: 15, color: '#a1bea0', fontFamily: 'serif' }).setOrigin(0.5).setAlpha(0.7);
        this.ui = mountUI(this, `<div class="game-screen">
            <header class="game-header"><div class="location"><span class="brand-mark">✦</span><div><span class="eyebrow">MOKDO · 첫 번째 모험</span><h1>${field ? '이슬 맺힌 숲길' : '수호자의 유적'} <span>${field ? 'FIELD' : 'BOSS'}</span></h1></div></div><div class="session-info"><span class="solo-badge">SOLO</span><span id="run-time">00:00</span><button class="return-button" id="leave-adventure">전리품 회수·복귀</button><button class="icon-button" id="pause-game" aria-label="일시정지">Ⅱ</button></div></header>
            <section class="boss-hud" aria-label="보스 상태"><div class="boss-heading"><span class="boss-emblem">✧</span><div><span id="boss-phase" class="eyebrow">${field ? 'HUNTING GROUND · Lv. 1–5' : 'FOREST GUARDIAN · PHASE 01'}</span><h2>${field ? '새싹과 포자가 사는 숲' : '숲의 수호자, 그루'}</h2></div><span id="boss-hp-text">${this.world.boss.hp} / ${this.world.boss.maxHp}</span></div><div class="health-track boss-track"><div id="boss-hp-bar"></div></div><p id="pattern-text">수호자는 아직 잠들어 있습니다</p></section>
            <aside class="quest"><span class="eyebrow">이번 모험</span><strong id="objective">동쪽의 유적을 찾아가세요</strong><p>${field ? '몬스터를 처치하고 전리품을 모으세요.' : '이끼 낀 돌길을 따라가 보세요.'}</p><div class="session-rewards"><span id="session-xp">+0 XP</span><span id="session-gold">+0 골드</span></div><p id="save-warning" class="save-warning"></p></aside><div id="pickup-log" class="pickup-log" role="status"></div>
            <div class="field-caption"><i></i> ${field ? '새싹 슬라임 · 포자 버섯' : '오래된 숲의 유적'}</div><section class="victory-banner" id="victory-banner" hidden><div><span class="eyebrow">GUARDIAN DEFEATED</span><strong>수호자가 풍성한 선물을 남겼어요.</strong><span>가까이 가거나 E로 회수하세요. 복귀 시 모두 회수됩니다.</span></div><button class="button primary" id="claim-boss-loot">모두 회수하고 결과 보기</button></section>
            <div class="game-toast" id="game-toast" role="status"></div>
            <footer class="game-footer"><section class="player-hud"><div class="portrait">✦</div><div class="player-vitals"><div><b>여행자</b><span id="player-level">Lv. 1</span></div><div class="health-track player-track"><div id="player-hp-bar"></div></div><span id="player-hp-text">100 / 100 HP</span><div class="xp-track game-xp-track"><div id="player-xp-bar"></div></div><span id="player-xp-text" class="game-xp-label">0 / 80 XP</span></div></section><div class="movement-hint"><span class="key wide">W A S D</span><span>또는 방향키로 이동</span></div><div class="abilities"><button class="ability" id="collect-button"><span class="ability-icon">✦</span><span class="ability-name">주변 줍기</span><span class="ability-key">E</span></button><button class="ability skill-ability" id="skill-button"><span class="ability-icon">◎</span><span class="ability-name">숲빛 파동</span><span class="ability-key">K</span><span class="cooldown-cover"></span></button><button class="ability" id="attack-button"><span class="ability-icon sword-icon">⚔</span><span class="ability-name">기본 공격</span><span class="ability-key">J / 클릭</span><span class="cooldown-cover"></span></button><button class="ability" id="dodge-button"><span class="ability-icon">≋</span><span class="ability-name">회피</span><span class="ability-key">SPACE</span><span class="cooldown-cover"></span></button></div></footer>
            <div class="modal-backdrop" id="pause-panel" hidden><section class="modal pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="eyebrow">TAKE A BREATH</span><h2 id="pause-title">잠깐, 쉬어 가도 괜찮아요.</h2><p>모험은 여기에서 기다리고 있을게요.</p><button class="button primary" id="resume-game">계속 모험하기</button><button class="button secondary" id="return-menu">전리품 회수하고 거점으로</button></section></div>
        </div>`);
        const get = (id: string) => this.ui.querySelector<HTMLElement>(`#${id}`)!;
        this.hpBar = get('player-hp-bar'); this.bossBar = get('boss-hp-bar');
        this.hpText = get('player-hp-text'); this.bossText = get('boss-hp-text');
        this.objective = get('objective'); this.patternText = get('pattern-text'); this.timer = get('run-time');
        this.dodgeButton = get('dodge-button') as HTMLButtonElement;
        this.attackButton = get('attack-button') as HTMLButtonElement;
        get('pause-game').onclick = () => this.togglePause();
        get('resume-game').onclick = () => this.togglePause();
        get('return-menu').onclick = () => this.finishRun();
        get('leave-adventure').onclick = () => this.finishRun();
        get('claim-boss-loot').onclick = () => this.finishRun();
        get('skill-button').onclick = () => { this.uiSkill = true; (get('skill-button') as HTMLButtonElement).blur(); };
        get('collect-button').onclick = () => { this.uiCollect = true; (get('collect-button') as HTMLButtonElement).blur(); };
        this.attackButton.onclick = () => { this.uiAttack = true; this.attackButton.blur(); };
        this.dodgeButton.onclick = () => { this.uiDodge = true; this.dodgeButton.blur(); };
        this.keys = this.input.keyboard!.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', attack: 'J', dodge: 'SPACE', pause: 'ESC', skill: 'K', collect: 'E' }) as Keys;
        this.input.keyboard!.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
        const pointerAttack = (pointer: Input.Pointer) => { if (pointer.leftButtonDown()) this.uiAttack = true; };
        this.input.on('pointerdown', pointerAttack);
        const onHidden = () => { if (document.hidden && !this.paused && !this.resultSent) this.togglePause(); };
        document.addEventListener('visibilitychange', onHidden);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', pointerAttack);
            document.removeEventListener('visibilitychange', onHidden);
            this.input.keyboard!.removeCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
            this.input.keyboard!.resetKeys();
        });
        this.toast(field ? 'K로 숲빛 파동! 몬스터를 잡고 경험치와 전리품을 모으세요.' : '수호자의 유적입니다. 붉은 표식을 피하고 보상을 모으세요.');
        this.cameras.main.fadeIn(400, 10, 30, 24);
        this.renderWorld();
        this.renderHUD();
    }

    update(_time: number, delta: number) {
        if (Input.Keyboard.JustDown(this.keys.pause)) this.togglePause();
        if (this.paused || this.resultSent) return;
        const input: InputFrame = {
            x: Number(this.keys.right.isDown || this.keys.d.isDown) - Number(this.keys.left.isDown || this.keys.a.isDown),
            y: Number(this.keys.down.isDown || this.keys.s.isDown) - Number(this.keys.up.isDown || this.keys.w.isDown),
            attack: this.keys.attack.isDown || this.uiAttack,
            dodge: Input.Keyboard.JustDown(this.keys.dodge) || this.uiDodge,
            skill: Input.Keyboard.JustDown(this.keys.skill) || this.uiSkill,
            collect: Input.Keyboard.JustDown(this.keys.collect) || this.uiCollect
        };
        this.uiAttack = false; this.uiDodge = false; this.uiSkill = false; this.uiCollect = false;
        this.moving = input.x !== 0 || input.y !== 0;
        this.world.step(Math.min(delta / 1000, 0.05), input).forEach(event => this.showEvent(event));
        this.renderWorld();
        this.renderHUD();
        this.saveProgress();
        if (this.world.phase !== this.phaseSeen) {
            this.phaseSeen = this.world.phase;
            this.ui.querySelector('#boss-phase')!.textContent = 'FOREST GUARDIAN · PHASE 02';
            this.toast('수호자가 깨어납니다. 초록빛 안전지대를 찾아가세요!');
        }
        if (this.world.result?.won && !this.victoryShown) {
            this.victoryShown = true;
            this.ui.querySelector<HTMLElement>('#victory-banner')!.hidden = false;
            this.toast('수호자의 심장과 희귀 결정이 떨어졌어요! 전리품을 회수하세요.');
        }
        if (this.world.result && !this.world.result.won) {
            this.resultSent = true;
            const result = this.world.result;
            this.time.delayedCall(650, () => this.scene.start('GameOver', result));
        }
    }

    private togglePause() {
        if (this.resultSent) return;
        this.paused = !this.paused;
        this.ui.querySelector<HTMLElement>('#pause-panel')!.hidden = !this.paused;
        this.uiAttack = false; this.uiDodge = false; this.uiSkill = false; this.uiCollect = false;
        this.input.keyboard!.resetKeys();
        if (this.paused) this.ui.querySelector<HTMLButtonElement>('#resume-game')!.focus();
        else (document.activeElement as HTMLElement | null)?.blur();
    }

    private renderWorld() {
        const w = this.world;
        this.hero.root.setPosition(w.player.x, w.player.y).setDepth(w.player.y);
        this.hero.body.alpha = w.player.invulnerable > 0 ? 0.5 + Math.sin(w.elapsed * 45) * 0.25 : 1;
        this.hero.root.setVisible(w.player.hp > 0);
        drawAdventurer(this.hero, w.elapsed, this.moving || w.dodgeTime > 0, w.player.facing, w.attackPose > 0);
        this.guardian.root.setPosition(w.boss.x, w.boss.y).setDepth(w.boss.y).setVisible(w.mode === 'boss' && w.boss.hp > 0);
        drawGuardian(this.guardian, w.elapsed, w.phase, !!w.warning);
        this.nameTag.setPosition(w.player.x, w.player.y - 83).setVisible(w.player.hp > 0);
        const g = this.warningArt.clear().setPosition(0, 0).setRotation(0);
        const warning = w.warning;
        if (warning) {
            const progress = 1 - Math.max(0, warning.remaining / warning.duration);
            const pulse = 0.18 + Math.sin(w.elapsed * 12) * 0.05;
            if (warning.kind === 'line') {
                g.setPosition(warning.x, warning.y).setRotation(warning.angle);
                g.fillStyle(0xee7766, pulse).fillRect(0, -46, 740, 92);
                g.fillStyle(0xffa782, 0.3).fillRect(0, -46, 740 * progress, 92);
                g.lineStyle(2, 0xffb09a, 0.8).strokeRect(0, -46, 740, 92);
                for (let x = 60; x < 730; x += 80) g.lineStyle(2, 0xffcfb0, 0.6).lineBetween(x, -12, x + 12, 0).lineBetween(x + 12, 0, x, 12);
            } else if (warning.kind === 'circle') {
                g.fillStyle(0xee7766, pulse).fillCircle(warning.x, warning.y, 92);
                g.fillStyle(0xffa782, 0.32).fillCircle(warning.x, warning.y, 92 * progress);
                g.lineStyle(2, 0xffb09a, 0.9).strokeCircle(warning.x, warning.y, 92);
                g.lineStyle(1, 0xffc5a6, 0.6).strokeCircle(warning.x, warning.y, 77);
            } else {
                g.fillStyle(0xbc624d, 0.12 + progress * 0.12).fillRect(60, 206, 1160, 466);
                g.fillStyle(0x8bf3be, 0.26).fillCircle(warning.x, warning.y, 100);
                g.lineStyle(4, 0xb7ffd8).strokeCircle(warning.x, warning.y, 100);
                g.lineStyle(2, 0xecffe6, 0.8).strokeCircle(warning.x, warning.y, 86);
                g.fillStyle(0xe8ffcd).fillCircle(warning.x, warning.y, 5);
            }
        }
        this.renderEntities();
        this.slash.clear();
        if (w.skillPose > 0) {
            const radius = 165 * (1 - w.skillPose / 0.42);
            this.slash.fillStyle(0x9cdbbc, w.skillPose * 0.28).fillCircle(w.player.x, w.player.y, radius);
            this.slash.lineStyle(5, 0xc6f3ca, w.skillPose / 0.42).strokeCircle(w.player.x, w.player.y, radius);
        }
        if (w.attackPose > 0) {
            const a = w.player.facing;
            this.slash.lineStyle(7, 0xe4ffda, w.attackPose / 0.18).beginPath();
            this.slash.arc(w.player.x, w.player.y - 20, 66, a - 0.9, a + 0.9, false).strokePath();
        }
    }

    private renderHUD() {
        const w = this.world;
        const stats = statsFor(w.profile.xp);
        this.hpBar.style.width = `${w.player.hp / stats.maxHp * 100}%`;
        this.bossBar.style.width = `${w.boss.hp / w.boss.maxHp * 100}%`;
        this.hpText.textContent = `${w.player.hp} / ${stats.maxHp} HP`;
        this.bossText.textContent = `${w.boss.hp} / ${w.boss.maxHp}`;
        this.timer.textContent = timeLabel(w.elapsed);
        this.ui.querySelector('#player-level')!.textContent = `Lv. ${stats.level}`;
        const xp = xpProgress(w.profile.xp);
        this.ui.querySelector<HTMLElement>('#player-xp-bar')!.style.width = `${xp.percent}%`;
        this.ui.querySelector('#player-xp-text')!.textContent = stats.level === 5 ? 'MAX LEVEL' : `${xp.current} / ${xp.required} XP`;
        this.ui.querySelector('#session-xp')!.textContent = `+${w.earnedXp} XP`;
        this.ui.querySelector('#session-gold')!.textContent = `+${w.sessionLoot.gold} 골드`;
        this.ui.querySelector('#save-warning')!.textContent = progress.message;
        this.cooldown(this.ui.querySelector<HTMLButtonElement>('#skill-button')!, w.skillCooldown, 5, 'K');
        this.objective.textContent = w.started ? '숲의 수호자를 진정시키세요' : '동쪽의 유적을 찾아가세요';
        const warning = w.warning;
        this.patternText.textContent = warning ? `${warning.kind === 'safe' ? '초록빛 안으로! · 안전지대' : warning.kind === 'line' ? '옆으로 피하세요 · 뿌리 가르기' : '표식 밖으로! · 숲의 파동'}  ${Math.max(0, warning.remaining).toFixed(1)}s` : w.started ? (w.phase === 2 ? '깨어난 수호자 · 다음 공격에 대비하세요' : '붉은 표식을 보고 피하세요') : '수호자는 아직 잠들어 있습니다';
        this.patternText.className = warning?.kind === 'safe' ? 'safe-text' : warning ? 'danger-text' : '';
        if (w.mode === 'field') {
            this.bossBar.parentElement!.hidden = true;
            this.bossText.textContent = `처치 ${w.defeated}회`;
            this.objective.textContent = stats.level === 5 ? '성장 완료! 수호자에게 도전해 보세요' : '몬스터를 잡고 레벨을 올리세요';
            this.patternText.textContent = '근접 공격은 피하고, 포자탄은 이동으로 피하세요';
            this.patternText.className = '';
        } else if (w.result?.won) {
            this.patternText.textContent = '수호자 격파 · 전리품 12묶음';
            this.patternText.className = 'safe-text';
            this.objective.textContent = '바닥의 전리품을 회수하세요';
        }
        this.cooldown(this.dodgeButton, w.player.dodgeCooldown, 1.6, 'SPACE');
        this.cooldown(this.attackButton, w.player.attackCooldown, 0.46, 'J / 클릭');
    }

    private cooldown(button: HTMLButtonElement, seconds: number, total: number, label: string) {
        button.querySelector<HTMLElement>('.cooldown-cover')!.style.height = `${seconds / total * 100}%`;
        button.querySelector('.ability-key')!.textContent = seconds > 0 ? `${seconds.toFixed(1)}s` : label;
        button.classList.toggle('on-cooldown', seconds > 0);
    }

    private showEvent(event: CombatEvent) {
        if (event.kind === 'levelup') this.toast(`레벨 ${event.value} 달성! 체력이 회복되고 체력·공격력이 증가했어요.`);
        if (event.kind === 'pickup' && event.item) {
            const log = this.ui.querySelector<HTMLElement>('#pickup-log')!;
            const row = document.createElement('div');
            row.style.color = ITEMS[event.item].color;
            row.textContent = `${ITEMS[event.item].icon} ${ITEMS[event.item].name} +${event.amount}`;
            log.prepend(row);
            while (log.children.length > 3) log.lastElementChild!.remove();
            this.time.delayedCall(3500, () => row.remove());
        }
        if (event.kind === 'hurt') this.cameras.main.shake(140, 0.004);
        if (event.kind === 'hit' || event.kind === 'hurt') {
            const text = this.add.text(event.x, event.y, `${event.kind === 'hurt' ? '−' : ''}${event.value}`, { fontFamily: 'Georgia, serif', fontSize: event.kind === 'hit' ? 28 : 24, color: event.kind === 'hit' ? '#f3dc9a' : '#ffb6a4', stroke: '#213b30', strokeThickness: 4 }).setOrigin(0.5).setDepth(950);
            this.tweens.add({ targets: text, y: event.y - 50, alpha: 0, duration: 700, onComplete: () => text.destroy() });
        }
        if (event.kind === 'dodge') {
            const trail = this.add.ellipse(event.x, event.y - 20, 30, 46, 0xb4efce, 0.28).setDepth(event.y - 1);
            this.tweens.add({ targets: trail, alpha: 0, scale: 1.6, duration: 260, onComplete: () => trail.destroy() });
        }
        if (event.kind === 'impact') {
            const flash = this.add.graphics().setDepth(3);
            if (event.pattern === 'line') flash.setPosition(event.x, event.y).setRotation(event.angle ?? 0).fillStyle(0xffc598, 0.65).fillRect(0, -46, 740, 92);
            else if (event.pattern === 'circle') flash.lineStyle(8, 0xffc598, 0.8).strokeCircle(event.x, event.y, event.value ?? 92);
            else flash.lineStyle(9, 0xb4ffd6, 0.8).strokeCircle(event.x, event.y, 100);
            this.tweens.add({ targets: flash, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
        }
    }


    private saveProgress() {
        if (this.world.revision === this.savedRevision) return;
        progress.commit(this.world.profile);
        this.savedRevision = this.world.revision;
    }

    private finishRun() {
        if (this.resultSent) return;
        const result = this.world.leave();
        this.saveProgress();
        this.resultSent = true;
        this.scene.start('GameOver', result);
    }

    private renderEntities() {
        const w = this.world;
        for (const enemy of w.enemies) {
            let view = this.monsterViews.get(enemy.id);
            if (!view) {
                view = { actor: createActor(this), bar: this.add.graphics() };
                this.monsterViews.set(enemy.id, view);
            }
            view.actor.root.setPosition(enemy.x, enemy.y).setDepth(enemy.y).setVisible(enemy.hp > 0);
            drawMonster(view.actor, w.elapsed, enemy.kind, enemy.windup > 0);
            const bar = view.bar.clear().setDepth(enemy.y + 1);
            if (enemy.hp <= 0) continue;
            bar.fillStyle(0x102b23, 0.8).fillRoundedRect(enemy.x - 24, enemy.y - 64, 48, 5, 2);
            bar.fillStyle(enemy.kind === 'melee' ? 0xaecb88 : 0xc4a8c3).fillRoundedRect(enemy.x - 23, enemy.y - 63, 46 * enemy.hp / enemy.maxHp, 3, 1);
            if (enemy.windup > 0) {
                if (enemy.kind === 'melee') {
                    this.warningArt.fillStyle(0xf3a083, 0.2).fillCircle(enemy.x, enemy.y, 54);
                    this.warningArt.lineStyle(2, 0xffba94, 0.8).strokeCircle(enemy.x, enemy.y, 54);
                } else this.warningArt.lineStyle(2, 0xe0aece, 0.55).lineBetween(enemy.x, enemy.y, enemy.target.x, enemy.target.y);
            }
        }
        const active = new Set(w.drops.map(drop => drop.id));
        for (const [id, view] of this.dropViews) if (!active.has(id)) { view.destroy(); this.dropViews.delete(id); }
        for (const drop of w.drops) {
            let view = this.dropViews.get(drop.id);
            if (!view) {
                const color = Number.parseInt(ITEMS[drop.item].color.slice(1), 16);
                const glow = this.add.graphics().fillStyle(color, 0.09).fillRect(-10, -43, 20, 45).fillStyle(color, 0.18).fillEllipse(0, 3, 28, 11);
                const icon = this.add.text(0, -11, ITEMS[drop.item].icon, { fontFamily: 'Georgia, serif', fontSize: drop.item === 'core' ? 32 : 23, color: ITEMS[drop.item].color, stroke: '#16392e', strokeThickness: 3 }).setOrigin(0.5);
                const label = this.add.text(0, 13, `×${drop.amount}`, { fontFamily: 'Arial', fontSize: 10, color: '#ebefd1', stroke: '#16392e', strokeThickness: 3 }).setOrigin(0.5);
                view = this.add.container(drop.x, drop.y, [glow, icon, label]).setDepth(drop.y - 1);
                this.dropViews.set(drop.id, view);
            }
            const bounce = drop.age < 0.6 ? Math.sin(drop.age / 0.6 * Math.PI) * 24 : Math.sin(w.elapsed * 3 + drop.id) * 2;
            view.y = drop.y - bounce;
        }
        this.shotArt.clear();
        for (const shot of w.projectiles) {
            this.shotArt.fillStyle(0xd9b7dc, 0.15).fillCircle(shot.x, shot.y, 13);
            this.shotArt.fillStyle(0xe4c2e3, 0.95).fillCircle(shot.x, shot.y, 5);
        }
    }

    private toast(message: string) {
        const toast = this.ui.querySelector<HTMLElement>('#game-toast')!;
        toast.textContent = message;
        toast.classList.add('visible');
        this.time.delayedCall(4200, () => toast.classList.remove('visible'));
    }
}
