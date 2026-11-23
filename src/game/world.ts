import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { BOSS_POSITION, DUNGEON_GATE_X, SPIKE_TRAPS, TOWN_MAP, spikeState, type WorldMap } from './maps';
const MENU_PROPS = [{ x: 186, y: 266, kind: 'tree' }, { x: 421, y: 245, kind: 'tree' }, { x: 557, y: 596, kind: 'tree' }, { x: 245, y: 604, kind: 'tree' }, { x: 535, y: 329, kind: 'rock' }, { x: 1080, y: 592, kind: 'rock' }];

const C = { ground: 0x153e35, moss: 0x315c47, leaf: 0x327b55, light: 0x65a365, bark: 0x594d39, stone: 0x78938a };

function tree(scene: Scene, x: number, y: number, scale = 1) {
    const g = scene.add.graphics().setPosition(x, y).setScale(scale).setDepth(y);
    g.fillStyle(0x071f1c, 0.35).fillEllipse(8, 3, 118, 34);
    g.fillStyle(C.bark).fillRoundedRect(-12, -62, 24, 68, 6);
    g.fillStyle(0x796243).fillRect(-8, -46, 5, 43);
    g.lineStyle(8, C.bark).lineBetween(0, -30, -30, -63).lineBetween(5, -37, 28, -80);
    g.fillStyle(0x184c3c).fillCircle(-31, -77, 38).fillCircle(32, -85, 42).fillCircle(-4, -115, 46);
    g.fillStyle(0x276b49).fillCircle(-35, -90, 31).fillCircle(26, -104, 36).fillCircle(-4, -132, 34);
    g.fillStyle(0x3f8756).fillEllipse(-14, -145, 49, 29).fillEllipse(28, -116, 42, 25);
    g.fillStyle(0x75ab69, 0.55).fillEllipse(-24, -153, 22, 8).fillEllipse(34, -122, 17, 7);
    g.lineStyle(2, 0x53925d, 0.5).lineBetween(-55, -89, -34, -82).lineBetween(5, -118, 23, -127);
}

function rock(scene: Scene, x: number, y: number, size = 1) {
    const g = scene.add.graphics().setPosition(x, y).setScale(size).setDepth(y);
    g.fillStyle(0x071f1c, 0.3).fillEllipse(7, 6, 87, 25);
    g.fillStyle(0x4c6a62).fillPoints([{ x: -38, y: 0 }, { x: -33, y: -28 }, { x: -8, y: -48 }, { x: 24, y: -40 }, { x: 40, y: -12 }, { x: 31, y: 9 }, { x: -13, y: 12 }].map(point => new PhaserMath.Vector2(point.x, point.y)), true);
    g.fillStyle(0x82998a).fillPoints([{ x: -33, y: -28 }, { x: -8, y: -48 }, { x: 24, y: -40 }, { x: 8, y: -16 }].map(point => new PhaserMath.Vector2(point.x, point.y)), true);
    g.fillStyle(0x648275).fillPoints([{ x: 8, y: -16 }, { x: 24, y: -40 }, { x: 40, y: -12 }, { x: 31, y: 9 }].map(point => new PhaserMath.Vector2(point.x, point.y)), true);
    g.fillStyle(0x65935d).fillEllipse(-15, -32, 39, 12).fillEllipse(-22, -20, 20, 9);
}

export function drawForest(scene: Scene) {
    scene.cameras.main.setBackgroundColor(C.ground);
    const g = scene.add.graphics().setDepth(-10);
    g.fillStyle(0x1c493b).fillEllipse(650, 450, 1190, 650);
    g.fillStyle(0x28513d).fillEllipse(895, 416, 626, 438);
    g.fillStyle(0x45634b, 0.65).fillPoints([
        { x: 78, y: 482 }, { x: 400, y: 429 }, { x: 695, y: 401 }, { x: 900, y: 335 },
        { x: 1100, y: 426 }, { x: 866, y: 496 }, { x: 651, y: 491 }, { x: 408, y: 530 }, { x: 80, y: 566 }
    ].map(point => new PhaserMath.Vector2(point.x, point.y)), true);
    g.fillStyle(0x4f6b4d, 0.5).fillEllipse(887, 420, 455, 310);
    g.lineStyle(3, 0x7d9470, 0.27).strokeCircle(895, 407, 174);
    g.lineStyle(1, 0x92a881, 0.22).strokeCircle(895, 407, 158);
    for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        const x = 895 + Math.cos(angle) * 168;
        const y = 407 + Math.sin(angle) * 168;
        g.lineStyle(3, 0xa6b08b, 0.45).lineBetween(x - 4, y - 4, x + 4, y + 4);
    }
    let seed = 74;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 780; i++) {
        const x = random() * 1280;
        const y = 160 + random() * 585;
        const inPath = y > 418 && y < 530 && x < 680;
        g.fillStyle(inPath ? 0x96a17a : (i % 3 ? 0x497952 : 0x6a945c), inPath ? 0.25 : 0.38);
        if (i % 5 === 0) g.fillEllipse(x, y, 10 + random() * 12, 3 + random() * 5);
        else g.fillRect(x, y, 2, 2 + random() * 5);
    }
    for (let i = 0; i < 12; i++) {
        const x = 95 + i * 48;
        const y = 493 - i * 2 + Math.sin(i * 2) * 13;
        g.fillStyle(0x9aa58b, 0.48).fillRoundedRect(x, y, 32, 17, 5);
        g.lineStyle(1, 0xc3c8a8, 0.2).lineBetween(x + 4, y + 2, x + 24, y + 2);
    }
    // Forest borders frame the playable clearing. Collision uses the same foot positions.
    for (let i = 0; i < 15; i++) tree(scene, i * 96 - 25, 205 + Math.sin(i * 3) * 25, 1.1 + random() * 0.3);
    for (let i = 0; i < 14; i++) tree(scene, i * 108 - 32, 790 + Math.sin(i) * 18, 0.9 + random() * 0.3);
    for (const side of [12, 1267]) for (let i = 0; i < 4; i++) tree(scene, side, 340 + i * 110, 1.15);
    MENU_PROPS.forEach(obstacle => obstacle.kind === 'tree' ? tree(scene, obstacle.x, obstacle.y) : rock(scene, obstacle.x, obstacle.y));
    rock(scene, 734, 228, 0.65);
    rock(scene, 1125, 276, 0.8);
    for (const [x, y] of [[655, 298], [1174, 502], [140, 567], [447, 596], [660, 624]]) {
        const plant = scene.add.graphics().setDepth(y).setPosition(x, y);
        plant.lineStyle(3, 0x6b9870).lineBetween(0, 0, -6, -20).lineBetween(0, 0, 8, -15);
        plant.fillStyle(0x84b386).fillEllipse(-8, -15, 14, 6).fillEllipse(8, -10, 13, 6);
        plant.fillStyle(0xe0d5a0).fillCircle(-6, -21, 3).fillCircle(8, -17, 3);
    }
    // Broken stone gate on the approach to the arena.
    for (const y of [277, 590]) {
        const pillar = scene.add.graphics().setPosition(670, y).setDepth(y);
        pillar.fillStyle(0x132f28, 0.5).fillEllipse(8, 3, 70, 23);
        pillar.fillStyle(0x5d7970).fillRoundedRect(-18, -73, 36, 73, 4);
        pillar.fillStyle(0x91a18b).fillRect(-19, -76, 38, 12);
        pillar.fillStyle(0x426353).fillRect(7, -62, 11, 62);
        pillar.lineStyle(2, 0xaab391, 0.7).strokeCircle(-3, -43, 7);
        pillar.fillStyle(0x83e5bd, 0.9).fillCircle(-3, -43, 3);
    }
    const motes = scene.add.graphics().setDepth(900);
    for (let i = 0; i < 32; i++) motes.fillStyle(0xb8f3be, 0.25 + random() * 0.4).fillCircle(80 + random() * 1120, 230 + random() * 390, 1 + random() * 1.5);
    scene.tweens.add({ targets: motes, alpha: 0.35, y: -10, duration: 2800, yoyo: true, repeat: -1 });
}

export interface Actor { root: GameObjects.Container; body: GameObjects.Graphics }

export function createActor(scene: Scene): Actor {
    const root = scene.add.container(0, 0);
    const shadow = scene.add.graphics().fillStyle(0x071c19, 0.4).fillEllipse(0, 1, 40, 15);
    const body = scene.add.graphics();
    root.add([shadow, body]);
    return { root, body };
}

export function drawAdventurer(actor: Actor, clock: number, moving: boolean, facing: number, attacking: boolean) {
    const g = actor.body.clear();
    const walk = moving ? Math.sin(clock * 14) * 4 : 0;
    const bob = moving ? Math.abs(Math.sin(clock * 14)) * 2 : Math.sin(clock * 3) * 0.8;
    const back = Math.sin(facing) < -0.55;
    g.y = -bob;
    g.scaleX = Math.cos(facing) < -0.1 ? -1 : 1;
    g.fillStyle(0x182b32).fillRoundedRect(-10, -13 + walk, 8, 14, 3).fillRoundedRect(4, -13 - walk, 8, 14, 3);
    g.fillStyle(0x8a6747).fillRoundedRect(-12, -4 + walk, 11, 6, 2).fillRoundedRect(3, -4 - walk, 11, 6, 2);
    g.fillStyle(0x254e64).fillTriangle(-17, -12, -13, -38, 15, -12);
    g.fillStyle(0x367d8a).fillRoundedRect(-12, -35, 26, 25, 5);
    g.fillStyle(0x66adad).fillRect(-8, -33, 5, 19);
    g.fillStyle(0xd5ad70).fillRect(-12, -15, 26, 4).fillRect(1, -17, 5, 7);
    g.fillStyle(0xe7b98f).fillRoundedRect(-17, -32 + walk * 0.5, 7, 16, 3).fillRoundedRect(11, -31 - walk * 0.5, 7, 15, 3);
    if (back) g.fillStyle(0x294f5b).fillRoundedRect(-9, -32, 19, 20, 4);
    g.fillStyle(0x563a31).fillRoundedRect(-15, -62, 31, 29, 9);
    g.fillStyle(0xf1c6a0).fillRoundedRect(-12, -56, 25, 23, 9);
    g.fillStyle(0x674537).fillRoundedRect(-15, -63, 31, 13, 6).fillRect(-15, -54, 6, 15);
    g.fillStyle(0x8c6041).fillTriangle(-12, -59, 10, -60, -1, -47);
    if (back) g.fillStyle(0x674537).fillRoundedRect(-14, -57, 29, 24, 7);
    else {
        g.fillStyle(0x263d38).fillRect(-3, -46, 3, 4).fillRect(7, -46, 3, 4);
        g.fillStyle(0xd99679, 0.65).fillEllipse(-6, -40, 5, 3).fillEllipse(10, -40, 5, 3);
    }
    g.fillStyle(0x91d3b4).fillTriangle(-17, -58, -7, -68, 10, -59);
    g.fillStyle(0xe1c78b).fillCircle(4, -60, 3);
    const swordY = attacking ? -33 : -8;
    g.lineStyle(5, 0x354a47).lineBetween(19, swordY, attacking ? 51 : 28, attacking ? -49 : -33);
    g.lineStyle(3, 0xd9eee0).lineBetween(19, swordY, attacking ? 51 : 28, attacking ? -49 : -33);
    g.lineStyle(4, 0xc4a66a).lineBetween(15, swordY - 5, 24, swordY);
}

export function drawGuardian(actor: Actor, clock: number, phase: number, warning: boolean) {
    const g = actor.body.clear();
    const bob = Math.sin(clock * 2.5) * 3;
    g.y = bob;
    g.fillStyle(0x0a2420, 0.3).fillEllipse(0, -2, 108, 30);
    g.fillStyle(0x405b50).fillRoundedRect(-34, -35, 23, 36, 7).fillRoundedRect(12, -35, 23, 36, 7);
    g.fillStyle(0x789078).fillRoundedRect(-39, -63, 79, 48, 17);
    g.fillStyle(0x9cae8b).fillRoundedRect(-29, -66, 51, 38, 13);
    g.fillStyle(0x456c4b).fillEllipse(-34, -56, 40, 29).fillEllipse(35, -57, 41, 31);
    g.fillStyle(0x8ab075).fillEllipse(-38, -64, 33, 14).fillEllipse(34, -65, 34, 14);
    g.fillStyle(0x657c66).fillRoundedRect(-53, -49, 21, 37, 8).fillRoundedRect(34, -50, 21, 38, 8);
    g.fillStyle(0x52664f).fillRoundedRect(-29, -106, 60, 51, 16);
    g.fillStyle(0xa3b18b).fillRoundedRect(-27, -111, 53, 45, 13);
    g.fillStyle(0x405844).fillRoundedRect(-20, -95, 42, 22, 8);
    g.fillStyle(phase === 2 ? 0xffba78 : 0xa6f0c4).fillRoundedRect(-14, -89, 10, 5, 2).fillRoundedRect(8, -89, 10, 5, 2);
    g.lineStyle(8, 0x5c7552).lineBetween(-16, -109, -28, -138).lineBetween(-28, -138, -47, -148).lineBetween(-28, -134, -24, -153);
    g.lineBetween(15, -109, 28, -139).lineBetween(28, -139, 48, -150).lineBetween(29, -133, 24, -156);
    g.fillStyle(0x72a26a).fillEllipse(-40, -147, 26, 10).fillEllipse(42, -148, 25, 10);
    g.fillStyle(0xa9c28c).fillEllipse(-25, -152, 14, 8).fillEllipse(26, -153, 14, 8);
    g.lineStyle(2, 0xd0d6ac, 0.6).strokeCircle(0, -46, 11);
    g.fillStyle(warning ? 0xffd899 : 0xabe6b7).fillCircle(0, -46, warning ? 7 + Math.sin(clock * 12) * 2 : 5);
    g.lineStyle(2, 0x526c56, 0.8).lineBetween(-5, -106, -10, -96).lineBetween(17, -73, 11, -63);
}

export function drawMonster(actor: Actor, clock: number, kind: 'melee' | 'ranged', attacking: boolean) {
    const g = actor.body.clear();
    g.y = Math.sin(clock * 5) * 2;
    if (kind === 'melee') {
        g.fillStyle(0x3e8263).fillEllipse(0, -16, 51, 39);
        g.fillStyle(0x8bc394).fillEllipse(-3, -22, 42, 30);
        g.fillStyle(0xb4d9a2, 0.65).fillEllipse(-10, -29, 14, 8);
        g.fillStyle(0x365c43).fillTriangle(-5, -33, -14, -50, 8, -41);
        g.fillStyle(0x7fbc77).fillEllipse(5, -42, 24, 9);
        g.fillStyle(attacking ? 0xf9b180 : 0x224b37).fillCircle(-9, -19, 3).fillCircle(8, -19, 3);
        g.lineStyle(2, 0x3e7350).lineBetween(-3, -10, 3, -10);
    } else {
        g.fillStyle(0xabc0aa).fillRoundedRect(-12, -35, 24, 35, 8);
        g.fillStyle(0x326658).fillRoundedRect(-15, -10, 12, 11, 4).fillRoundedRect(4, -10, 12, 11, 4);
        g.fillStyle(0x825c77).fillEllipse(0, -34, 62, 26);
        g.fillStyle(attacking ? 0xd7a09d : 0xb492a2).fillEllipse(0, -43, 51, 32);
        g.fillStyle(0xdecbb1).fillCircle(-12, -46, 6).fillCircle(12, -50, 5).fillCircle(22, -38, 4);
        g.fillStyle(0x234d3c).fillCircle(-5, -22, 2).fillCircle(6, -22, 2);
    }
}

export function drawPortal(scene: Scene, x: number, y: number, label: string, tint = 0xaad6b6) {
    const floor = scene.add.graphics().setDepth(1).setPosition(x, y);
    floor.fillStyle(tint, 0.12).fillEllipse(0, 0, 135, 54);
    floor.lineStyle(2, tint, 0.7).strokeEllipse(0, 0, 112, 41);
    floor.lineStyle(1, tint, 0.35).strokeEllipse(0, 0, 140, 57);
    const gate = scene.add.graphics().setDepth(y).setPosition(x, y);
    gate.fillStyle(0x577564).fillRoundedRect(-49, -103, 19, 105, 5).fillRoundedRect(30, -103, 19, 105, 5);
    gate.lineStyle(18, 0x829680).beginPath().arc(0, -91, 40, Math.PI, Math.PI * 2).strokePath();
    gate.fillStyle(0xd0dbb2, 0.9).fillCircle(-39, -80, 4).fillCircle(39, -80, 4);
    const light = scene.add.graphics().setPosition(x, y).setDepth(y - 1);
    light.fillStyle(tint, 0.12).fillEllipse(0, -56, 63, 103);
    light.fillStyle(tint, 0.19).fillEllipse(0, -56, 40, 91);
    light.lineStyle(2, tint, 0.8).strokeEllipse(0, -56, 56, 94);
    scene.tweens.add({ targets: light, alpha: 0.45, duration: 1600, yoyo: true, repeat: -1 });
    scene.add.text(x, y - 162, label, { fontFamily: 'Arial', fontSize: 15, color: '#e4efd0', stroke: '#173b2d', strokeThickness: 5 }).setOrigin(0.5).setDepth(10000);
}

export function drawCave(scene: Scene, x: number, y: number) {
    const g = scene.add.graphics().setPosition(x, y).setDepth(y - 5);
    g.fillStyle(0x0a241f, 0.4).fillEllipse(0, 0, 182, 47);
    g.fillStyle(0x4a6559).fillRoundedRect(-87, -96, 174, 108, 28);
    g.fillStyle(0x6c8270).fillEllipse(-42, -81, 82, 72).fillEllipse(13, -100, 99, 77).fillEllipse(65, -65, 58, 82);
    g.fillStyle(0x9caa88, 0.5).fillEllipse(-28, -119, 81, 23);
    g.fillStyle(0x0a211f).fillRoundedRect(-42, -78, 84, 90, { tl: 40, tr: 40, bl: 4, br: 4 });
    g.fillStyle(0x25463b).fillEllipse(0, 6, 87, 22);
    g.lineStyle(2, 0xb2c39a, 0.5).lineBetween(-12, -66, 0, -72).lineBetween(0, -72, 12, -66);
    g.fillStyle(0x82b98e).fillEllipse(-57, -103, 37, 11).fillEllipse(55, -82, 42, 15);
    for (const dx of [-62, 62]) {
        g.fillStyle(0x766344).fillRect(dx - 3, -37, 6, 33);
        g.fillStyle(0xe9c782, 0.15).fillCircle(dx, -43, 18);
        g.fillStyle(0xf1cb88).fillEllipse(dx, -44, 10, 18);
    }
    scene.add.text(x, y - 156, '수호자의 동굴', { fontFamily: 'Arial', fontSize: 16, color: '#e5d8ae', stroke: '#173b2d', strokeThickness: 5 }).setOrigin(0.5).setDepth(10000);
    scene.add.text(x, y + 25, '동굴 대기실 · 권장 Lv. 3', { fontFamily: 'Arial', fontSize: 12, color: '#d0c6a1', stroke: '#173b2d', strokeThickness: 4 }).setOrigin(0.5).setDepth(10000);
}

export function drawVillage(scene: Scene) {
    drawLargeMap(scene, TOWN_MAP);
    for (const { x, y } of TOWN_MAP.obstacles.filter(obstacle => obstacle.kind === 'house')) {
        const g = scene.add.graphics().setPosition(x, y).setDepth(y);
        g.fillStyle(0x0b211e, 0.35).fillEllipse(8, 3, 163, 42);
        g.fillStyle(0x8d9473).fillRoundedRect(-58, -85, 116, 88, 6);
        g.fillStyle(0x536e55).fillRect(29, -85, 29, 86);
        g.fillStyle(0x425f49).fillTriangle(-78, -80, 0, -154, 78, -80);
        g.fillStyle(0x78936a).fillTriangle(-68, -88, 0, -148, 43, -88);
        g.lineStyle(4, 0x9baa77).lineBetween(-74, -82, 0, -150).lineBetween(0, -150, 76, -82);
        g.fillStyle(0x354c37).fillRoundedRect(-13, -45, 29, 47, { tl: 14, tr: 14, bl: 0, br: 0 });
        g.fillStyle(0xd5c788).fillRect(-43, -57, 18, 21).fillRect(30, -57, 17, 21);
        g.lineStyle(3, 0x53694d).lineBetween(-34, -59, -34, -34).lineBetween(38, -59, 38, -34);
    }
    const fire = scene.add.graphics().setPosition(620, 850).setDepth(850);
    fire.fillStyle(0xb4a07a).fillEllipse(0, 0, 59, 26);
    fire.fillStyle(0x654c32).fillEllipse(0, -2, 39, 18);
    fire.fillStyle(0xefa86c).fillTriangle(-14, -5, 2, -46, 17, -5);
    fire.fillStyle(0xffd99c).fillTriangle(-6, -4, 4, -29, 10, -4);
    scene.tweens.add({ targets: fire, alpha: 0.7, duration: 650, yoyo: true, repeat: -1 });
}

export function drawLargeMap(scene: Scene, map: WorldMap) {
    const dungeon = map.key === 'dungeon';
    scene.cameras.main.setBackgroundColor(dungeon ? 0x102725 : 0x173e32);
    const g = scene.add.graphics().setDepth(-10);
    g.fillStyle(dungeon ? 0x102725 : 0x1d4939).fillRect(0, 0, map.width, map.height);
    let seed = 1337;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    if (dungeon) {
        for (const room of map.rooms!) {
            g.fillStyle(0x4c6554).fillRoundedRect(room.x - 12, room.y - 12, room.width + 24, room.height + 24, 20);
            g.fillStyle(0x2c4c40).fillRect(room.x, room.y, room.width, room.height);
            g.lineStyle(3, 0x92a17d, 0.4).strokeRect(room.x + 12, room.y + 12, room.width - 24, room.height - 24);
            for (let x = room.x + 30; x < room.x + room.width - 20; x += 64) for (let y = room.y + 30; y < room.y + room.height - 20; y += 64) {
                g.fillStyle(random() > 0.5 ? 0x58715c : 0x6c7f60, 0.15).fillRoundedRect(x, y, 53, 51, 5);
            }
        }
        // Erase internal room borders where the corridor joins each chamber.
        g.fillStyle(0x2c4c40).fillRect(1160, 634, 110, 252).fillRect(2510, 634, 150, 252);
        g.fillStyle(0x758262, 0.15).fillCircle(BOSS_POSITION.x, BOSS_POSITION.y, 250);
        g.lineStyle(3, 0xa0af82, 0.4).strokeCircle(BOSS_POSITION.x, BOSS_POSITION.y, 220);
        g.lineStyle(1, 0x9fa879, 0.3).strokeCircle(BOSS_POSITION.x, BOSS_POSITION.y, 197);
        for (const [x, y, label] of [[610, 460, '01 · 입구의 파수꾼'], [1840, 565, '02 · 가시의 통로'], [3200, 455, '03 · 수호자의 성소']] as const) {
            scene.add.text(x, y, label, { fontFamily: 'Arial', fontSize: 20, color: '#cbd4ae', stroke: '#183b30', strokeThickness: 5 }).setOrigin(0.5).setDepth(10000);
        }
        for (const x of [1150, 1500, 1850, 2200, 2550]) {
            const torch = scene.add.graphics().setPosition(x, 595).setDepth(595);
            torch.fillStyle(0x697b61).fillRoundedRect(-12, -48, 24, 50, 5);
            torch.fillStyle(0xf3cd85, 0.1).fillCircle(0, -56, 30);
            torch.fillStyle(0xf1c47f).fillTriangle(-8, -45, 0, -70, 8, -45);
        }
    } else {
        for (let i = 0; i < 45; i++) g.fillStyle(i % 2 ? 0x335b40 : 0x28543b, 0.5).fillEllipse(random() * map.width, random() * map.height, 250 + random() * 350, 160 + random() * 200);
        // A continuous stone trail gives the large maps a readable eastbound route.
        g.lineStyle(120, 0x657653, 0.26).beginPath().moveTo(100, map.key === 'town' ? 1000 : 1120).lineTo(map.width - 350, map.key === 'town' ? 950 : 1120).lineTo(map.width - 360, map.key === 'town' ? 950 : 520).strokePath();
        for (let x = 140; x < map.width - 300; x += 70) {
            const y = (map.key === 'town' ? 980 : 1120) + Math.sin(x * 0.01) * 21;
            g.fillStyle(0xa6ae83, 0.36).fillRoundedRect(x, y, 35, 20, 5);
        }
        for (let i = 0; i < 2200; i++) {
            const x = random() * map.width, y = random() * map.height;
            g.fillStyle(i % 3 ? 0x609360 : 0x91a778, 0.22).fillRect(x, y, 2 + random() * 3, 3 + random() * 5);
        }
        for (let x = 0; x < map.width + 120; x += 130) {
            tree(scene, x, 175 + random() * 35, 1.1);
            tree(scene, x, map.height + 15 + random() * 30, 1.15);
        }
        for (let y = 330; y < map.height; y += 145) {
            tree(scene, 8, y, 1.15); tree(scene, map.width - 8, y, 1.15);
        }
    }
    for (const obstacle of map.obstacles) {
        if (obstacle.kind === 'tree') tree(scene, obstacle.x, obstacle.y, 1.15);
        if (obstacle.kind === 'rock') rock(scene, obstacle.x, obstacle.y, 1.1);
    }
}

export function drawDungeonMechanics(g: GameObjects.Graphics, elapsed: number, gateOpen: boolean, bossStarted: boolean, cleared: boolean) {
    g.clear();
    for (const trap of SPIKE_TRAPS) {
        const state = cleared ? 'idle' : spikeState(elapsed, trap.offset);
        const color = state === 'active' ? 0xe6a68c : state === 'warning' ? 0xe6bb78 : 0x78957e;
        g.fillStyle(color, state === 'idle' ? 0.12 : 0.27).fillRect(trap.x, trap.y, trap.width, trap.height);
        g.lineStyle(2, color, state === 'idle' ? 0.25 : 0.85).strokeRect(trap.x + 3, trap.y + 3, trap.width - 6, trap.height - 6);
        for (let x = trap.x + 18; x < trap.x + trap.width; x += 32) for (let y = trap.y + 24; y < trap.y + trap.height; y += 36) {
            g.fillStyle(0x0f2a24, 0.7).fillEllipse(x, y, 19, 8);
            if (state === 'active') {
                g.fillStyle(0xc5cec0).fillTriangle(x - 8, y, x, y - 29, x + 8, y);
                g.fillStyle(0x7c9386).fillTriangle(x, y - 29, x + 8, y, x + 2, y);
            } else if (state === 'warning') g.fillStyle(0xf7cc8c, 0.7).fillCircle(x, y - 2, 3);
        }
    }
    for (const x of [DUNGEON_GATE_X, 2630]) {
        const locked = x === DUNGEON_GATE_X ? !gateOpen : bossStarted && !cleared;
        g.fillStyle(0x8a9f7d).fillRect(x - 18, 608, 36, 18).fillRect(x - 18, 894, 36, 18);
        if (locked) {
            g.fillStyle(0xc5b48b, 0.18).fillRect(x - 9, 628, 18, 264);
            g.lineStyle(3, 0xd2c09a, 0.8).lineBetween(x, 628, x, 891);
            for (let y = 640; y < 891; y += 34) g.lineStyle(2, 0xb3c59d, 0.7).lineBetween(x - 11, y, x + 11, y + 15);
        }
    }
}

export function followExplorer(scene: Scene, target: GameObjects.Container, map: WorldMap) {
    scene.cameras.main.setBounds(0, 0, map.width, map.height);
    scene.cameras.main.startFollow(target, true, 0.12, 0.12);
    scene.cameras.main.setDeadzone(120, 80);
    scene.cameras.main.centerOn(target.x, target.y);
}
