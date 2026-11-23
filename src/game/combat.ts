import { emptyBag, rollLoot, type Bag, type Drop } from './items';
import { cloneProfile, freshProfile, LEVEL_XP, levelOf, statsFor, type Profile } from './progression';

// Simulation owns movement, timing and damage. Phaser only supplies input and renders it.
export interface Point { x: number; y: number }
export interface Obstacle extends Point { radius: number; kind: 'tree' | 'rock' }
export interface InputFrame { x: number; y: number; attack: boolean; dodge: boolean; skill?: boolean; collect?: boolean }
export type Pattern = 'line' | 'circle' | 'safe';
export interface Warning extends Point {
    kind: Pattern;
    angle: number;
    remaining: number;
    duration: number;
}
export interface CombatEvent extends Point {
    kind: 'attack' | 'hurt' | 'hit' | 'dodge' | 'impact' | 'skill' | 'levelup' | 'drop' | 'pickup' | 'defeat';
    value?: number;
    pattern?: Pattern;
    angle?: number;
    item?: keyof Bag;
    amount?: number;
}
export type AdventureMode = 'field' | 'boss';
export interface RunResult { won: boolean; seconds: number; hits: number; dodges: number; mode: AdventureMode; xp: number; kills: number; loot: Bag; firstClear: boolean; retreated?: boolean }
export interface Enemy extends Point { id: number; kind: 'melee' | 'ranged'; hp: number; maxHp: number; spawn: Point; cooldown: number; windup: number; target: Point; respawn: number }
export interface Projectile extends Point { id: number; vx: number; vy: number; life: number }


export const OBSTACLES: Obstacle[] = [
    { x: 186, y: 266, radius: 32, kind: 'tree' },
    { x: 421, y: 245, radius: 32, kind: 'tree' },
    { x: 557, y: 596, radius: 30, kind: 'tree' },
    { x: 245, y: 604, radius: 29, kind: 'tree' },
    { x: 535, y: 329, radius: 29, kind: 'rock' },
    { x: 1080, y: 592, radius: 33, kind: 'rock' }
];
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function isInWarning(point: Point, warning: Warning): boolean {
    if (warning.kind === 'circle') return distance(point, warning) < 92 + 14;
    if (warning.kind === 'safe') return distance(point, warning) > 100 - 14;
    const dx = point.x - warning.x;
    const dy = point.y - warning.y;
    const along = dx * Math.cos(warning.angle) + dy * Math.sin(warning.angle);
    const across = -dx * Math.sin(warning.angle) + dy * Math.cos(warning.angle);
    return along > -14 && along < 740 && Math.abs(across) < 46 + 14;
}

export class CombatWorld {
    player = { x: 320, y: 474, hp: 100, facing: 0, attackCooldown: 0, dodgeCooldown: 0, invulnerable: 0 };
    boss = { x: 900, y: 390, hp: 1920, maxHp: 1920 };
    mode: AdventureMode;
    profile: Profile;
    revision = 0;
    drops: Drop[] = [];
    enemies: Enemy[] = [];
    projectiles: Projectile[] = [];
    sessionLoot = emptyBag();
    earnedXp = 0;
    defeated = 0;
    firstClear = false;
    skillCooldown = 0;
    skillPose = 0;
    private sequence = 0;
    private random: () => number;
    elapsed = 0;
    started = false;
    phase: 1 | 2 = 1;
    warning: Warning | null = null;
    result: RunResult | null = null;
    attackPose = 0;
    dodgeTime = 0;
    hits = 0;
    dodges = 0;
    private direction = { x: 1, y: 0 };
    private nextAttack = 1.8;
    private patternIndex = 0;
    private safeTimer = 0;

    constructor(mode: AdventureMode = 'boss', profile: Profile = freshProfile(), random: () => number = Math.random) {
        this.mode = mode;
        this.profile = cloneProfile(profile);
        this.random = random;
        this.player.hp = statsFor(profile.xp).maxHp;
        if (mode === 'field') {
            const spawns = [[450, 440], [780, 310], [1010, 480], [710, 580], [360, 315], [1120, 350]];
            this.enemies = spawns.map(([x, y], i) => ({ id: i, kind: i % 2 ? 'ranged' : 'melee', x, y, spawn: { x, y }, hp: i % 2 ? 64 : 76, maxHp: i % 2 ? 64 : 76, cooldown: 1.5 + i * 0.2, windup: 0, target: { x, y }, respawn: 0 }));
        }
    }

    step(dt: number, input: InputFrame): CombatEvent[] {
        if (this.result && !this.result.won) return [];
        const events: CombatEvent[] = [];
        if (!this.result) this.elapsed += dt;
        this.drops.forEach(drop => drop.age += dt);
        this.skillCooldown = Math.max(0, this.skillCooldown - dt);
        this.skillPose = Math.max(0, this.skillPose - dt);
        const p = this.player;
        p.attackCooldown = Math.max(0, p.attackCooldown - dt);
        p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
        p.invulnerable = Math.max(0, p.invulnerable - dt);
        this.attackPose = Math.max(0, this.attackPose - dt);

        const length = Math.hypot(input.x, input.y);
        const direction = length ? { x: input.x / length, y: input.y / length } : null;
        if (direction && this.dodgeTime <= 0) {
            this.direction = direction;
            p.facing = Math.atan2(direction.y, direction.x);
        }
        if (input.dodge && p.dodgeCooldown <= 0) {
            this.dodgeTime = 0.2;
            p.dodgeCooldown = 1.6;
            p.invulnerable = 0.32;
            this.dodges++;
            events.push({ kind: 'dodge', x: p.x, y: p.y });
        }
        const dodging = this.dodgeTime > 0;
        this.dodgeTime = Math.max(0, this.dodgeTime - dt);
        const move = dodging ? this.direction : direction;
        if (move) {
            const speed = dodging ? 620 : 215;
            this.moveAxis('x', move.x * speed * dt);
            this.moveAxis('y', move.y * speed * dt);
        }

        events.push(...this.collect(input.collect ? 165 : 38));
        if (this.result) return events;
        if (this.mode === 'boss' && !this.started && p.x > 635) this.started = true;
        if (input.skill && this.skillCooldown <= 0 && !dodging) {
            this.skillCooldown = 5;
            this.skillPose = 0.42;
            this.attackPose = 0.18;
            events.push({ kind: 'skill', x: p.x, y: p.y });
            this.damageTargets(165, statsFor(this.profile.xp).attack * 2.5, events);
            if (this.result) return events;
        }
        if (input.attack && p.attackCooldown <= 0 && !dodging) {
            p.attackCooldown = 0.46;
            this.attackPose = 0.18;
            events.push({ kind: 'attack', x: p.x, y: p.y });
            this.damageTargets(132, statsFor(this.profile.xp).attack, events);
            if (this.result) return events;
        }
        if (this.mode === 'field') {
            this.updateEnemies(dt, events);
            if (p.hp <= 0) this.finish(false);
            return events;
        }
        if (!this.started) return events;
        if (this.boss.hp <= this.boss.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.safeTimer = 0;
            this.warning = null;
            this.nextAttack = 0.6;
        }

        if (this.warning) {
            this.warning.remaining -= dt;
            if (this.warning.remaining <= 0) {
                const warning = this.warning;
                events.push({ kind: 'impact', x: warning.x, y: warning.y, pattern: warning.kind, angle: warning.angle });
                // Safe-zone mechanics require positioning; dodge cannot bypass them.
                if (isInWarning(p, warning) && (warning.kind === 'safe' || p.invulnerable <= 0)) {
                    const damage = warning.kind === 'safe' ? 36 : 20;
                    p.hp = Math.max(0, p.hp - damage);
                    p.invulnerable = 0.6;
                    events.push({ kind: 'hurt', x: p.x, y: p.y - 44, value: damage });
                }
                this.warning = null;
                this.nextAttack = this.phase === 2 ? 0.85 : 1.15;
            }
        } else {
            this.nextAttack -= dt;
            this.safeTimer -= dt;
            if (this.nextAttack <= 0) {
                if (this.phase === 2 && this.safeTimer <= 0) {
                    const side = this.patternIndex % 2 ? -1 : 1;
                    this.warning = { kind: 'safe', x: 860 + side * 115, y: 480, angle: 0, remaining: 3.4, duration: 3.4 };
                    this.safeTimer = 13;
                } else {
                    const kind = this.patternIndex++ % 2 === 0 ? 'line' : 'circle';
                    const duration = this.phase === 2 ? 1.05 : 1.4;
                    this.warning = {
                        kind, x: kind === 'line' ? this.boss.x : p.x,
                        y: kind === 'line' ? this.boss.y : p.y,
                        angle: Math.atan2(p.y - this.boss.y, p.x - this.boss.x),
                        remaining: duration, duration
                    };
                }
            }
        }
        if (p.hp <= 0) this.finish(false);
        return events;
    }

    private moveAxis(axis: 'x' | 'y', amount: number) {
        const p = this.player;
        const previous = p[axis];
        p[axis] = Math.max(axis === 'x' ? 82 : 220, Math.min(axis === 'x' ? 1198 : 649, previous + amount));
        if (OBSTACLES.some(obstacle => distance(p, obstacle) < obstacle.radius + 14)) p[axis] = previous;
    }

    collect(radius: number): CombatEvent[] {
        const events: CombatEvent[] = [];
        this.drops = this.drops.filter(drop => {
            if (drop.age < 0.6 || distance(this.player, drop) > radius) return true;
            this.profile.bag[drop.item] = Math.min(99999999, this.profile.bag[drop.item] + drop.amount);
            this.sessionLoot[drop.item] += drop.amount;
            this.revision++;
            events.push({ kind: 'pickup', x: drop.x, y: drop.y, item: drop.item, amount: drop.amount });
            return false;
        });
        if (this.result) this.result.loot = { ...this.sessionLoot };
        return events;
    }

    leave(): RunResult {
        this.drops.forEach(drop => drop.age = 1);
        this.collect(Infinity);
        if (!this.result) {
            this.finish(this.mode === 'field');
            this.result!.retreated = this.mode === 'boss';
        }
        return this.result!;
    }

    private damageTargets(range: number, damage: number, events: CombatEvent[]) {
        if (this.mode === 'boss') {
            if (!this.started || this.boss.hp <= 0 || distance(this.player, this.boss) >= range) return;
            this.player.facing = Math.atan2(this.boss.y - this.player.y, this.boss.x - this.player.x);
            this.boss.hp = Math.max(0, this.boss.hp - damage);
            this.hits++;
            events.push({ kind: 'hit', x: this.boss.x, y: this.boss.y - 65, value: damage });
            if (this.boss.hp === 0) {
                this.firstClear = this.profile.bossClears === 0;
                this.profile.bossClears++;
                this.reward(this.boss, true, 180, events);
                this.warning = null;
                this.finish(true);
            }
        } else {
            this.enemies.forEach(enemy => {
                if (enemy.hp <= 0 || distance(this.player, enemy) >= range) return;
                enemy.hp = Math.max(0, enemy.hp - damage);
                this.hits++;
                events.push({ kind: 'hit', x: enemy.x, y: enemy.y - 42, value: damage });
                if (enemy.hp === 0) {
                    enemy.windup = 0;
                    enemy.respawn = 14;
                    this.reward(enemy, false, enemy.kind === 'melee' ? 18 : 26, events);
                }
            });
        }
    }

    private reward(point: Point, boss: boolean, xp: number, events: CombatEvent[]) {
        const oldLevel = levelOf(this.profile.xp);
        const previousXp = this.profile.xp;
        this.profile.xp = Math.min(LEVEL_XP[4], this.profile.xp + xp);
        this.earnedXp += this.profile.xp - previousXp;
        this.profile.kills++;
        this.defeated++;
        this.revision++;
        events.push({ kind: 'defeat', x: point.x, y: point.y, value: xp });
        if (levelOf(this.profile.xp) > oldLevel) {
            this.player.hp = statsFor(this.profile.xp).maxHp;
            events.push({ kind: 'levelup', x: this.player.x, y: this.player.y, value: levelOf(this.profile.xp) });
        }
        const loot = rollLoot(boss, this.random);
        loot.forEach((item, i) => {
            const angle = i * Math.PI * 2 / loot.length + this.random() * 0.4;
            const radius = boss ? 48 + this.random() * 65 : 28 + this.random() * 12;
            this.drops.push({ ...item, id: this.sequence++, x: Math.max(85, Math.min(1190, point.x + Math.cos(angle) * radius)), y: Math.max(230, Math.min(640, point.y + Math.sin(angle) * radius)), age: 0 });
        });
        events.push({ kind: 'drop', x: point.x, y: point.y, value: loot.length });
    }

    private updateEnemies(dt: number, events: CombatEvent[]) {
        const p = this.player;
        this.enemies.forEach(enemy => {
            if (enemy.hp <= 0) {
                enemy.respawn -= dt;
                if (enemy.respawn <= 0 && distance(p, enemy.spawn) > 180) {
                    Object.assign(enemy, enemy.spawn, { hp: enemy.maxHp, cooldown: 1.5, windup: 0 });
                }
                return;
            }
            if (enemy.windup > 0) {
                enemy.windup -= dt;
                if (enemy.windup <= 0) {
                    if (enemy.kind === 'melee') {
                        events.push({ kind: 'impact', x: enemy.x, y: enemy.y, pattern: 'circle', value: 54 });
                        if (distance(p, enemy) < 66) this.hurt(12, events);
                    } else {
                        const angle = Math.atan2(enemy.target.y - enemy.y, enemy.target.x - enemy.x);
                        this.projectiles.push({ id: this.sequence++, x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 230, vy: Math.sin(angle) * 230, life: 3 });
                    }
                    enemy.cooldown = enemy.kind === 'melee' ? 1.5 : 2.2;
                }
                return;
            }
            enemy.cooldown -= dt;
            const separation = distance(p, enemy);
            if (separation > 360) return;
            const targetDistance = enemy.kind === 'melee' ? 45 : 185;
            const dx = (p.x - enemy.x) / Math.max(1, separation);
            const dy = (p.y - enemy.y) / Math.max(1, separation);
            if (separation > targetDistance + 10 || (enemy.kind === 'ranged' && separation < 115)) {
                const sign = separation < 115 && enemy.kind === 'ranged' ? -1 : 1;
                const speed = enemy.kind === 'melee' ? 90 : 62;
                for (const axis of ['x', 'y'] as const) {
                    const old = enemy[axis];
                    enemy[axis] = Math.max(axis === 'x' ? 95 : 235, Math.min(axis === 'x' ? 1180 : 635, old + (axis === 'x' ? dx : dy) * speed * sign * dt));
                    if (OBSTACLES.some(obstacle => distance(enemy, obstacle) < obstacle.radius + 18)) enemy[axis] = old;
                }
            }
            if (separation < (enemy.kind === 'melee' ? 72 : 300) && enemy.cooldown <= 0) {
                enemy.windup = enemy.kind === 'melee' ? 0.65 : 0.85;
                enemy.target = { x: p.x, y: p.y };
            }
        });
        this.projectiles = this.projectiles.filter(shot => {
            shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
            if (distance(p, shot) < 23) { this.hurt(10, events); return false; }
            return shot.life > 0 && shot.x > 60 && shot.x < 1220 && shot.y > 215 && shot.y < 660 && !OBSTACLES.some(obstacle => distance(shot, obstacle) < obstacle.radius);
        });
    }

    private hurt(damage: number, events: CombatEvent[]) {
        if (this.player.invulnerable > 0) return;
        this.player.hp = Math.max(0, this.player.hp - damage);
        this.player.invulnerable = 0.6;
        events.push({ kind: 'hurt', x: this.player.x, y: this.player.y - 44, value: damage });
    }

    private finish(won: boolean) {
        this.result = { won, seconds: this.elapsed, hits: this.hits, dodges: this.dodges, mode: this.mode, xp: this.earnedXp, kills: this.defeated, loot: { ...this.sessionLoot }, firstClear: this.firstClear };
    }
}
