import { MERCHANTS, nearestMerchant } from '../commerce';
import { hudDialogOpen } from '../inGameHud';
import { adventureCharacter, adventurerName } from '../adventure';
import { Input, Scene } from 'phaser';
import { createActor, drawAdventurer, drawPortal, drawVillage, followExplorer, type Actor } from '../world';
import { mountUI, miniMap, updateMiniMap } from '../ui';
import { TOWN_MAP } from '../maps';
import { nearLandmark, TOWN_PORTAL, walkExplorer } from '../navigation';

type TownKeys = Record<'up' | 'down' | 'left' | 'right' | 'interact', Input.Keyboard.Key>;

export class Hub extends Scene {
    private hero: Actor;
    private player = { ...TOWN_MAP.spawn };
    private facing = 0;
    private moving = false;
    private keys: TownKeys;
    private ui: HTMLElement;
    private clock = 0;
    private interactRequested = false;
    private departing = false;

    constructor() { super('Hub'); }

    create(data: { fromField?: boolean } = {}) {
        if (!adventureCharacter()) { this.scene.start('CharacterSelect'); return; }
        this.scene.stop('Game');
        this.scene.stop('BossRoom');
        this.player = data.fromField ? { x: TOWN_PORTAL.x - 135, y: TOWN_PORTAL.y } : { ...TOWN_MAP.spawn };
        this.clock = 0; this.interactRequested = false; this.departing = false; this.moving = false; this.facing = 0;
        drawVillage(this);
        drawPortal(this, TOWN_PORTAL.x, TOWN_PORTAL.y, '숲길 포탈 · 사냥터');
        this.hero = createActor(this);
        for (const merchant of MERCHANTS) {
            const npc = createActor(this);
            npc.root.setPosition(merchant.x, merchant.y).setDepth(merchant.y).setScale(.9);
            drawAdventurer(npc, 0, false, Math.PI / 2, false);
            this.add.ellipse(merchant.x, merchant.y + 2, 58, 22, 0xe3cb82, .15).setDepth(merchant.y - 1);
            this.add.text(merchant.x, merchant.y - 84, merchant.name, { fontFamily: 'Arial', fontSize: 15, color: '#ead8a5', stroke: '#14382b', strokeThickness: 5 }).setOrigin(.5).setDepth(merchant.y + 1);
            this.add.text(merchant.x, merchant.y - 64, 'Space · 거래', { fontFamily: 'Arial', fontSize: 11, color: '#bed1a8', stroke: '#14382b', strokeThickness: 4 }).setOrigin(.5).setDepth(merchant.y + 1);
        }
        this.add.text(620, 780, '여행자의 쉼터', { fontFamily: 'Arial', fontSize: 14, color: '#e3d7ad', stroke: '#14382b', strokeThickness: 5 }).setOrigin(0.5).setDepth(10000);
        this.ui = mountUI(this, `<main class="town-screen game-screen">
            ${miniMap(TOWN_MAP)}
            <div class="interaction-prompt" id="town-interaction" hidden><span class="key">Space</span><div><strong>숲길 포탈</strong><span>이슬 맺힌 숲길로 이동</span></div><button class="button primary" id="use-town-portal">포탈 이용</button></div>
        </main>`);
        this.ui.querySelectorAll('[data-character-name]').forEach(node => { node.textContent = adventurerName(); });
        this.ui.querySelector<HTMLButtonElement>('#use-town-portal')!.onclick = () => this.interactWithTown();
        this.keys = this.input.keyboard!.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', interact: 'SPACE' }) as TownKeys;
        this.input.keyboard!.resetKeys();
        const interact = (event: KeyboardEvent) => { if (!event.repeat) this.interactRequested = true; };
        this.input.keyboard!.on('keydown-SPACE', interact);
        this.events.once('shutdown', () => this.input.keyboard!.off('keydown-SPACE', interact));
        this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);
        this.events.once('shutdown', () => { this.input.keyboard!.removeCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']); this.input.keyboard!.resetKeys(); });
        this.cameras.main.fadeIn(300, 9, 26, 24);
        this.renderExplorer();
        followExplorer(this, this.hero.root, TOWN_MAP);
    }

    update(_time: number, delta: number) {
        if (!this.keys || !adventureCharacter()) return;
        const interact = this.interactRequested;
        this.interactRequested = false;
        if (this.departing || hudDialogOpen(this.ui)) return;
        const dt = Math.min(delta / 1000, 0.05);
        this.clock += dt;
        const input = {
            x: Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
            y: Number(this.keys.down.isDown) - Number(this.keys.up.isDown)
        };
        this.moving = input.x !== 0 || input.y !== 0;
        if (this.moving) this.facing = Math.atan2(input.y, input.x);
        walkExplorer(this.player, input, dt, [...TOWN_MAP.obstacles, ...MERCHANTS.map(merchant => ({ ...merchant, radius: 18 }))]);
        this.renderExplorer();
        const merchant = nearestMerchant(this.player);
        const nearby = nearLandmark(this.player, TOWN_PORTAL);
        const prompt = this.ui.querySelector<HTMLElement>('#town-interaction')!;
        prompt.hidden = !merchant && !nearby;
        prompt.querySelector('strong')!.textContent = merchant?.name ?? '숲길 포탈';
        prompt.querySelector('div > span')!.textContent = merchant ? '상품을 구매하거나 보유 아이템을 판매하세요' : '이슬 맺힌 숲길로 이동';
        prompt.querySelector('button')!.textContent = merchant ? '거래하기' : '포탈 이용';
        if (interact) this.interactWithTown();
    }

    private renderExplorer() {
        this.hero.root.setPosition(this.player.x, this.player.y).setDepth(this.player.y);
        drawAdventurer(this.hero, this.clock, this.moving, this.facing, false);
        updateMiniMap(this.ui, this.player, this.cameras.main);
    }

    private interactWithTown(): void {
        if (this.departing || hudDialogOpen(this.ui)) return;
        const merchant = nearestMerchant(this.player);
        if (merchant) { this.events.emit('open-shop', merchant); return; }
        this.enterField();
    }

    private enterField() {
        if (this.departing || hudDialogOpen(this.ui) || !nearLandmark(this.player, TOWN_PORTAL)) return;
        this.departing = true;
        this.scene.start('Game', { mode: 'field', entry: 'town' });
    }
}
