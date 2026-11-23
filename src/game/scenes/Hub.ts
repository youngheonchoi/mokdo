import { Input, Scene } from 'phaser';
import { createActor, drawAdventurer, drawPortal, drawVillage, followExplorer, type Actor } from '../world';
import { lootSlots, mountUI, routeTrail, miniMap, updateMiniMap } from '../ui';
import { progress, statsFor, xpProgress } from '../progression';
import { TOWN_MAP } from '../maps';
import { nearLandmark, TOWN_PORTAL, walkExplorer } from '../navigation';

type TownKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'interact' | 'escape', Input.Keyboard.Key>;

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
        this.scene.stop('Game');
        this.scene.stop('BossRoom');
        this.player = data.fromField ? { x: TOWN_PORTAL.x - 135, y: TOWN_PORTAL.y } : { ...TOWN_MAP.spawn };
        this.clock = 0; this.interactRequested = false; this.departing = false; this.moving = false; this.facing = 0;
        drawVillage(this);
        drawPortal(this, TOWN_PORTAL.x, TOWN_PORTAL.y, '숲길 포탈 · 사냥터');
        this.hero = createActor(this);
        this.add.text(620, 780, '여행자의 쉼터', { fontFamily: 'Arial', fontSize: 14, color: '#e3d7ad', stroke: '#14382b', strokeThickness: 5 }).setOrigin(0.5).setDepth(10000);
        const profile = progress.read();
        const stats = statsFor(profile.xp);
        const xp = xpProgress(profile.xp);
        this.ui = mountUI(this, `<main class="town-screen game-screen">
            <header class="game-header"><div class="location"><span class="brand-mark">✦</span><div><span class="eyebrow">MOKDO · 여행자의 쉼터</span><h1>이끼 마을 <span>SAFE ZONE</span></h1></div></div><div class="session-info"><button class="return-button" id="open-profile">여행자·보관함</button><button class="return-button" id="town-home">메인 화면</button></div></header>
            ${routeTrail('town')}${miniMap(TOWN_MAP)}
            <aside class="quest"><span class="eyebrow">모험을 떠나는 길</span><strong>동쪽의 숲길 포탈을 찾아가세요</strong><p>포탈 가까이에서 F를 누르면 사냥터로 이동합니다.<br>사냥터의 동굴을 통해 보스방에 입장할 수 있어요.</p></aside>
            <div class="map-distance" id="town-distance"></div>
            <div class="interaction-prompt" id="town-interaction" hidden><span class="key">F</span><div><strong>숲길 포탈</strong><span>이슬 맺힌 숲길로 이동</span></div><button class="button primary" id="use-town-portal">포탈 이용</button></div>
            <footer class="exploration-footer"><div><b>여행자 <span>Lv. ${stats.level}</span></b><span>체력 ${stats.maxHp} · 공격력 ${stats.attack} · 평화로운 마을</span></div><div class="control-strip"><span class="key wide">W A S D</span><span>이동</span><span class="key">F</span><span>상호작용</span></div><span id="town-save" class="${progress.message ? 'save-warning' : ''}">${progress.message || '성장과 전리품은 이 브라우저에 자동 저장됩니다.'}</span></footer>
            <div class="modal-backdrop" id="profile-panel" hidden><section class="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div class="profile-heading"><div><span class="eyebrow">YOUR ADVENTURER</span><h2 id="profile-title">여행자 · Lv. ${stats.level}</h2></div><button class="icon-button" id="close-profile" aria-label="보관함 닫기">×</button></div><div class="profile-stats"><span>최대 체력 <b>${stats.maxHp}</b></span><span>공격력 <b>${stats.attack}</b></span><span>처치 <b>${profile.kills}</b></span><span>보스 클리어 <b>${profile.bossClears}</b></span></div><div class="xp-caption"><span>${stats.level === 5 ? '최고 레벨 달성' : '다음 레벨까지'}</span><b>${stats.level === 5 ? 'MAX' : `${xp.current} / ${xp.required} XP`}</b></div><div class="xp-track"><div style="width:${xp.percent}%"></div></div><h3>모아 온 전리품 ${profile.bossClears ? '<span class="clear-badge">BOSS CLEAR</span>' : ''}</h3><div class="stash-grid">${lootSlots(profile.bag)}</div><p class="profile-note">장착하지 않는 수집 재료입니다. 레벨·경험치·전리품은 계속 유지됩니다.</p><button class="text-button" id="reset-progress">성장 기록 초기화</button></section></div>
            <div class="modal-backdrop reset-overlay" id="reset-panel" hidden><section class="modal pause-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><span class="eyebrow">A FRESH START</span><h2 id="reset-title">새 여행자로 시작할까요?</h2><p>레벨, 경험치, 모든 전리품과 보스 클리어 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p><button class="button secondary" id="cancel-reset">기록 유지하기</button><button class="button danger-button" id="confirm-reset">모든 성장 기록 삭제</button></section></div>
        </main>`);
        const get = (id: string) => this.ui.querySelector<HTMLElement>(`#${id}`)!;
        const profilePanel = get('profile-panel');
        const resetPanel = get('reset-panel');
        const closeProfile = () => { profilePanel.hidden = true; this.input.keyboard!.resetKeys(); get('open-profile').focus(); };
        get('open-profile').onclick = () => { profilePanel.hidden = false; this.input.keyboard!.resetKeys(); get('close-profile').focus(); };
        get('close-profile').onclick = closeProfile;
        get('town-home').onclick = () => this.scene.start('MainMenu');
        get('use-town-portal').onclick = () => this.enterField();
        const closeReset = () => { resetPanel.hidden = true; get('reset-progress').focus(); };
        get('reset-progress').onclick = () => { resetPanel.hidden = false; get('cancel-reset').focus(); };
        get('cancel-reset').onclick = closeReset;
        get('confirm-reset').onclick = () => {
            if (progress.reset()) this.scene.restart();
            else { closeReset(); get('town-save').textContent = progress.message; get('town-save').classList.add('save-warning'); }
        };
        resetPanel.onkeydown = event => {
            if (event.key === 'Escape') { event.stopPropagation(); closeReset(); }
            if (event.key === 'Tab') { event.preventDefault(); get(document.activeElement?.id === 'cancel-reset' ? 'confirm-reset' : 'cancel-reset').focus(); }
        };
        profilePanel.onkeydown = event => {
            if (event.key === 'Escape') closeProfile();
            if (event.key === 'Tab') { event.preventDefault(); get(document.activeElement?.id === 'close-profile' ? 'reset-progress' : 'close-profile').focus(); }
        };
        this.keys = this.input.keyboard!.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', interact: 'F', escape: 'ESC' }) as TownKeys;
        this.input.keyboard!.resetKeys();
        const interact = (event: KeyboardEvent) => { if (!event.repeat) this.interactRequested = true; };
        this.input.keyboard!.on('keydown-F', interact);
        this.events.once('shutdown', () => this.input.keyboard!.off('keydown-F', interact));
        this.input.keyboard!.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']);
        this.events.once('shutdown', () => { this.input.keyboard!.removeCapture(['UP', 'DOWN', 'LEFT', 'RIGHT']); this.input.keyboard!.resetKeys(); });
        this.cameras.main.fadeIn(300, 9, 26, 24);
        this.renderExplorer();
        followExplorer(this, this.hero.root, TOWN_MAP);
    }

    update(_time: number, delta: number) {
        const interact = this.interactRequested;
        this.interactRequested = false;
        if (this.departing || !this.ui.querySelector<HTMLElement>('#profile-panel')!.hidden) return;
        const dt = Math.min(delta / 1000, 0.05);
        this.clock += dt;
        const input = {
            x: Number(this.keys.right.isDown || this.keys.d.isDown) - Number(this.keys.left.isDown || this.keys.a.isDown),
            y: Number(this.keys.down.isDown || this.keys.s.isDown) - Number(this.keys.up.isDown || this.keys.w.isDown)
        };
        this.moving = input.x !== 0 || input.y !== 0;
        if (this.moving) this.facing = Math.atan2(input.y, input.x);
        walkExplorer(this.player, input, dt, TOWN_MAP.obstacles);
        this.renderExplorer();
        const nearby = nearLandmark(this.player, TOWN_PORTAL);
        this.ui.querySelector<HTMLElement>('#town-interaction')!.hidden = !nearby;
        if (interact) this.enterField();
    }

    private renderExplorer() {
        this.hero.root.setPosition(this.player.x, this.player.y).setDepth(this.player.y);
        drawAdventurer(this.hero, this.clock, this.moving, this.facing, false);
        updateMiniMap(this.ui, this.player, this.cameras.main);
        this.ui.querySelector('#town-distance')!.textContent = `동쪽 포탈까지 ${Math.round(Math.hypot(this.player.x - TOWN_PORTAL.x, this.player.y - TOWN_PORTAL.y) / 10)}m · 지도를 확인하세요`;
    }

    private enterField() {
        if (this.departing || !nearLandmark(this.player, TOWN_PORTAL) || !this.ui.querySelector<HTMLElement>('#profile-panel')!.hidden) return;
        this.departing = true;
        this.scene.start('Game', { mode: 'field', entry: 'town' });
    }
}
