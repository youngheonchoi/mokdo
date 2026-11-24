import { adventureCharacter, adventurerName } from '../adventure';
import { Scene } from 'phaser';
import { createActor, drawAdventurer, drawCave, drawForest, type Actor } from '../world';
import { mountUI, routeTrail } from '../ui';
import { progress, statsFor } from '../progression';

export class BossLobby extends Scene {
    private hero: Actor;
    private ready = false;
    private entering = false;
    private countdown?: Phaser.Time.TimerEvent;

    constructor() { super('BossLobby'); }

    create() {
        if (!adventureCharacter()) { this.scene.start('CharacterSelect'); return; }
        this.ready = false; this.entering = false; this.countdown = undefined;
        drawForest(this);
        drawCave(this, 930, 455);
        this.hero = createActor(this);
        this.hero.root.setPosition(820, 525).setDepth(525).setScale(1.2);
        const stats = statsFor(progress.read().xp);
        const root = mountUI(this, `<main class="lobby-screen">
            <header class="game-header"><div class="location"><span class="brand-mark">✧</span><div><span class="eyebrow">GUARDIAN’S CAVE · SAFE ROOM</span><h1>동굴 대기실 <span>SOLO</span></h1></div></div><button class="return-button" id="leave-lobby">사냥터로 나가기</button></header>
            ${routeTrail('lobby')}
            <aside class="mini-map lobby-map" aria-label="현재 지역 미니맵"><div><span>동굴 대기실</span><span>SAFE</span></div><svg viewBox="0 0 160 120" role="img" aria-label="대기실 입구와 던전 입구"><path d="M16 100V20h128v80Z" fill="#42644a" stroke="#94ad77"/><path d="M80 100V60h50" fill="none" stroke="#94ad77" stroke-dasharray="4 4"/><circle cx="80" cy="85" r="4" fill="#c9f5dc"/><rect x="126" y="48" width="8" height="24" fill="#dbc78f"/></svg><small>초록: 나 · 금색: 던전 입구</small></aside>
            <section class="lobby-card"><span class="eyebrow">BEFORE THE GUARDIAN AWAKENS</span><h2>수호자와 마주할 준비가 됐나요?</h2><p>문 너머에는 잡몹과 가시 통로가 이어집니다.<br>준비를 마친 뒤 보스방에 입장하세요.</p><div class="boss-brief"><span>✧</span><div><strong>숲의 수호자, 그루</strong><span>잡몹 전투 → 가시 통로 → 최종 수호자 · 권장 Lv. 3</span></div></div><div class="lobby-player"><span class="portrait">✦</span><div><strong><span data-character-name></span> <small data-profile-level>Lv. ${stats.level}</small></strong><span data-profile-stats>체력 ${stats.maxHp} · 공격력 ${stats.attack}</span></div><span id="ready-status" class="ready-status" role="status">준비 중</span></div><div class="lobby-actions"><button class="button secondary" id="toggle-ready">준비 완료</button><button class="button primary" id="enter-boss-room" disabled>던전 입장</button></div><p id="entry-message" class="lobby-note" role="status">준비 완료를 누르면 입장할 수 있습니다. 실제 매칭 없이 혼자 입장합니다.</p><button class="text-button" id="cancel-entry" hidden>입장 취소</button></section>
            <div class="lobby-caption"><span class="eyebrow">GUARDIAN’S RUINS</span><strong>수호자의 유적</strong><span>골드 · 희귀 결정 · 수호자의 심장</span></div>
        </main>`);
        root.querySelector('[data-character-name]')!.textContent = adventurerName();
        const readyButton = root.querySelector<HTMLButtonElement>('#toggle-ready')!;
        const enterButton = root.querySelector<HTMLButtonElement>('#enter-boss-room')!;
        const cancelButton = root.querySelector<HTMLButtonElement>('#cancel-entry')!;
        const status = root.querySelector<HTMLElement>('#ready-status')!;
        const message = root.querySelector<HTMLElement>('#entry-message')!;
        const cancel = () => {
            this.countdown?.remove(false); this.countdown = undefined; this.entering = false;
            cancelButton.hidden = true; readyButton.disabled = false; enterButton.disabled = !this.ready;
            enterButton.textContent = '던전 입장'; message.textContent = '입장을 취소했습니다. 준비가 되면 다시 입장하세요.';
        };
        root.querySelector('#leave-lobby')!.addEventListener('click', () => {
            this.countdown?.remove(false);
            if (this.scene.isSleeping('Game')) { this.scene.wake('Game'); this.scene.stop(); }
            else this.scene.start('Game', { mode: 'field', entry: 'cave' });
        });
        readyButton.onclick = () => {
            if (this.entering) return;
            this.ready = !this.ready;
            status.textContent = this.ready ? '준비 완료' : '준비 중';
            status.classList.toggle('is-ready', this.ready);
            readyButton.textContent = this.ready ? '준비 취소' : '준비 완료';
            enterButton.disabled = !this.ready;
            message.textContent = this.ready ? '입장할 준비가 됐어요. 던전 입장을 눌러주세요.' : '준비 완료를 누르면 입장할 수 있습니다. 실제 매칭 없이 혼자 입장합니다.';
        };
        cancelButton.onclick = cancel;
        enterButton.onclick = () => {
            if (!this.ready || this.entering) return;
            this.entering = true; readyButton.disabled = true; enterButton.disabled = true; cancelButton.hidden = false;
            let seconds = 3;
            const update = () => { enterButton.textContent = `${seconds}초 후 입장`; message.textContent = '수호자의 지하길로 이동합니다. 입장 전까지 취소할 수 있습니다.'; };
            update();
            this.countdown = this.time.addEvent({ delay: 1000, repeat: 2, callback: () => {
                seconds--;
                if (seconds === 0) this.scene.start('BossRoom', { mode: 'boss' });
                else update();
            } });
        };
        this.events.once('shutdown', () => this.countdown?.remove(false));
        this.cameras.main.fadeIn(300, 9, 26, 24);
    }

    update(time: number) { if (!this.hero || !adventureCharacter()) return; drawAdventurer(this.hero, time / 1000, false, -0.45, false); }
}
