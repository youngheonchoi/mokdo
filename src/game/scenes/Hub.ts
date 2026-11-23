import { Scene } from 'phaser';
import { createActor, drawAdventurer, drawForest, type Actor } from '../world';
import { mountUI, lootSlots } from '../ui';
import { progress, statsFor, xpProgress } from '../progression';

export class Hub extends Scene {
    private hero: Actor;
    constructor() { super('Hub'); }

    create() {
        drawForest(this);
        this.hero = createActor(this);
        this.hero.root.setPosition(232, 361).setDepth(361).setScale(1.25);
        const profile = progress.read();
        const stats = statsFor(profile.xp);
        const xp = xpProgress(profile.xp);
        const root = mountUI(this, `<main class="hub-screen">
            <header class="hub-header"><a class="brand" href="#" id="hub-home">✦ <span>MOKDO</span></a><span class="hub-location">속삭이는 숲 · 여행자의 쉼터</span><span class="version-tag">SOLO ADVENTURE · v0.2</span></header>
            <section class="hub-title"><span class="eyebrow">A PLACE TO RETURN TO</span><h1>다시, 모험을 떠날 시간.</h1><p>숲에서 조금씩 강해지고, 수호자에게 도전하세요.</p></section>
            <section class="character-card"><div class="character-heading"><div><span class="eyebrow">YOUR ADVENTURER</span><h2>여행자</h2></div><strong>Lv. ${stats.level}<small> / 5</small></strong></div><div class="character-space"></div><div class="stat-pair"><span>최대 체력 <b>${stats.maxHp}</b></span><span>공격력 <b>${stats.attack}</b></span></div><div class="xp-caption"><span>${stats.level === 5 ? '최고 레벨 달성' : '다음 레벨까지'}</span><b>${stats.level === 5 ? 'MAX' : `${xp.current} / ${xp.required} XP`}</b></div><div class="xp-track"><div style="width:${xp.percent}%"></div></div><p class="character-note">레벨업 시 체력·공격력이 증가하고 체력이 회복됩니다.</p></section>
            <section class="destinations" aria-label="모험 목적지"><article class="destination field-destination"><div class="destination-emblem">❧</div><div><span class="eyebrow">HUNTING GROUND · Lv. 1–5</span><h2>이슬 맺힌 숲길</h2><p>새싹 슬라임과 포자 버섯을 만나 보세요.<br>경험치와 전리품을 모으는 작은 사냥터.</p></div><button class="button primary" id="enter-field">사냥하러 가기</button></article><article class="destination boss-destination"><div class="destination-emblem">✧</div><div><span class="eyebrow">GUARDIAN’S RUINS · 권장 Lv. 3</span><h2>수호자의 유적 ${profile.bossClears ? '<span class="clear-badge">CLEAR</span>' : ''}</h2><p>그루의 기믹을 넘으면 풍성한 보상이 기다려요.<br>골드 · 빛나는 결정 · 수호자의 심장 확정 획득.</p></div><button class="button secondary" id="enter-boss">보스 도전</button></article></section>
            <section class="stash-panel"><div class="stash-heading"><h2>모아 온 전리품</h2><span>자동 보관 · 장착하지 않는 수집 재료</span></div><div class="stash-grid">${lootSlots(profile.bag)}</div></section>
            <footer class="hub-footer"><span id="save-message" class="${progress.message ? 'save-warning' : ''}" role="status">${progress.message || '이 브라우저에 자동 저장됩니다 · 다른 기기와 공유되지 않습니다.'}</span><span>처치 ${profile.kills}회 · 보스 클리어 ${profile.bossClears}회</span><button class="text-button" id="reset-progress">성장 기록 초기화</button></footer>
            <div class="modal-backdrop" id="reset-panel" hidden><section class="modal pause-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><span class="eyebrow">A FRESH START</span><h2 id="reset-title">새 여행자로 시작할까요?</h2><p>레벨, 경험치, 모든 전리품과 보스 클리어 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p><button class="button secondary" id="cancel-reset">기록 유지하기</button><button class="button danger-button" id="confirm-reset">모든 성장 기록 삭제</button></section></div>
        </main>`);
        root.querySelector('#hub-home')!.addEventListener('click', event => { event.preventDefault(); this.scene.start('MainMenu'); });
        root.querySelector('#enter-field')!.addEventListener('click', () => this.scene.start('Game', { mode: 'field' }));
        root.querySelector('#enter-boss')!.addEventListener('click', () => this.scene.start('Game', { mode: 'boss' }));
        const panel = root.querySelector<HTMLElement>('#reset-panel')!;
        const close = () => { panel.hidden = true; root.querySelector<HTMLButtonElement>('#reset-progress')!.focus(); };
        root.querySelector('#reset-progress')!.addEventListener('click', () => { panel.hidden = false; root.querySelector<HTMLButtonElement>('#cancel-reset')!.focus(); });
        root.querySelector('#cancel-reset')!.addEventListener('click', close);
        panel.onkeydown = event => {
            if (event.key === 'Escape') close();
            if (event.key === 'Tab') {
                event.preventDefault();
                const next = document.activeElement?.id === 'cancel-reset' ? '#confirm-reset' : '#cancel-reset';
                root.querySelector<HTMLButtonElement>(next)!.focus();
            }
        };
        root.querySelector('#confirm-reset')!.addEventListener('click', () => {
            if (progress.reset()) this.scene.restart();
            else { close(); root.querySelector('#save-message')!.textContent = progress.message; root.querySelector('#save-message')!.classList.add('save-warning'); }
        });
        this.cameras.main.fadeIn(300, 9, 26, 24);
    }

    update(time: number) { drawAdventurer(this.hero, time / 1000, false, 0.3, false); }
}
