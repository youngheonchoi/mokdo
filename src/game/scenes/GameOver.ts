import { Scene } from 'phaser';
import { type RunResult } from '../combat';
import { drawForest } from '../world';
import { lootSlots, mountUI, timeLabel } from '../ui';
import { progress, statsFor } from '../progression';

export class GameOver extends Scene {
    constructor() { super('GameOver'); }

    create(result: RunResult) {
        drawForest(this);
        const bossWin = result.mode === 'boss' && result.won;
        const title = bossWin ? '숲이 풍성한 선물을 남겼습니다.' : result.retreated ? '다음 도전을 준비하며.' : result.won ? '가방도, 마음도 조금 더 풍성하게.' : '다음 모험은 더 강한 모습으로.';
        const description = bossWin ? '수호자 그루가 다시 깊은 잠에 빠졌어요. 모아 온 전리품은 쉼터에 보관됩니다.' : result.won || result.retreated ? '모아 온 전리품을 모두 회수했습니다. 쉼터에서 성장한 모습을 확인하세요.' : '얻은 경험치와 주운 전리품은 유지됩니다. 바닥에 남은 전리품은 회수하지 못했어요.';
        const root = mountUI(this, `<main class="result-screen"><a class="brand result-brand" href="#">✦ <span>MOKDO</span></a><section class="result-card rewards-result"><span class="result-symbol">${bossWin ? '✧' : '❧'}</span><span class="eyebrow">${bossWin ? 'THE FOREST REMEMBERS YOU' : 'EVERY JOURNEY MAKES YOU STRONGER'}</span><h1>${title}</h1><p>${description}</p>${result.firstClear ? '<span class="first-clear">첫 수호자 격파 · CLEAR 기록 달성</span>' : ''}<div class="run-stats"><div><span>모험 시간</span><strong>${timeLabel(result.seconds)}</strong></div><div><span>획득 경험치</span><strong>+${result.xp}<small>XP</small></strong></div><div><span>처치 수</span><strong>${result.kills}<small>회</small></strong></div></div><div class="result-loot"><span class="eyebrow">이번 모험에서 모은 전리품</span><div class="stash-grid">${lootSlots(result.loot)}</div></div><div class="result-actions"><button class="button primary" id="back-hub">${result.mode === 'boss' ? '동굴 입구로 돌아가기' : '마을로 돌아가기'}</button><button class="button secondary" id="retry-game">${result.mode === 'field' ? '다시 사냥하기' : '다시 도전 준비'}</button></div><button class="text-button result-town-link" id="result-town">마을에서 쉬어 가기</button><span class="result-note ${progress.message ? 'save-warning' : ''}">${progress.message || `여행자 Lv. ${statsFor(progress.read().xp).level} · 성장과 전리품이 이 브라우저에 저장되었습니다.`}</span></section></main>`);
        root.querySelector('#retry-game')!.addEventListener('click', () => this.scene.start(result.mode === 'boss' ? 'BossLobby' : 'Game', { mode: result.mode }));
        root.querySelector('#back-hub')!.addEventListener('click', () => {
            if (result.mode === 'boss') {
                if (this.scene.isSleeping('Game')) { this.scene.wake('Game'); this.scene.stop(); }
                else this.scene.start('Game', { mode: 'field', entry: 'cave' });
            } else this.scene.start('Hub', { fromField: true });
        });
        root.querySelector('#result-town')!.addEventListener('click', () => this.scene.start('Hub', { fromField: true }));
        root.querySelector('.brand')!.addEventListener('click', event => { event.preventDefault(); this.scene.start('MainMenu'); });
        this.cameras.main.fadeIn(400, 10, 30, 24);
    }
}
