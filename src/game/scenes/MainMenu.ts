import { Scene } from 'phaser';
import { createActor, drawAdventurer, drawForest, drawGuardian, type Actor } from '../world';
import { controls, help, mountUI, wireHelp } from '../ui';

export class MainMenu extends Scene {
    private hero: Actor;
    private guardian: Actor;

    constructor() { super('MainMenu'); }

    create() {
        this.scene.stop('Game');
        this.scene.stop('BossRoom');
        this.scene.stop('BossLobby');
        drawForest(this);
        this.guardian = createActor(this);
        this.guardian.root.setPosition(937, 423).setDepth(423).setScale(1.3);
        this.hero = createActor(this);
        this.hero.root.setPosition(745, 534).setDepth(534).setScale(1.15);
        const root = mountUI(this, `<main class="menu-screen">
            <header class="menu-nav"><a class="brand" href="#" aria-label="MOKDO 메인">✦ <span>MOKDO</span></a><div class="nav-right"><span class="version-tag">SOLO PLAYTEST · v0.2</span><button class="text-button" id="open-help">플레이 가이드 <span>?</span></button></div></header>
            <section class="menu-copy"><span class="eyebrow"><i></i> 작지만, 새로운 모험</span>
                <h1>MOKDO<span>잠들어 있던 숲이<br>당신을 기다립니다.</span></h1>
                <p class="menu-description">발걸음이 닿는 곳에 이야기가 시작됩니다.<br>잊힌 숲을 거닐고, 깨어난 수호자와 마주하세요.</p>
                <div class="menu-actions"><button class="button primary start-button" id="start-game">모험 시작 <span>ENTER</span></button><span class="offline-note">계정 없이 바로 떠나는 솔로 모험</span></div>
                <div class="feature-chips"><span>사냥과 성장</span><span>전리품 수집</span><span>보스 기믹</span></div>
            </section>
            <div class="world-caption"><span class="location-glyph">⌖</span><div><span class="eyebrow">THE WHISPERING WOODS</span><strong>속삭이는 숲</strong><p>오래된 약속이 잠든 곳</p></div></div>
            <div class="map-note"><span class="small-diamond"></span> 숲의 수호자 · 그루</div>
            <footer class="menu-footer"><div class="control-strip">${controls}</div><span>한 걸음부터 시작되는 당신의 이야기.</span></footer>
        </main>${help}`);
        wireHelp(root);
        root.querySelector('#start-game')!.addEventListener('click', () => this.scene.start('Hub'));
        root.querySelector('.brand')!.addEventListener('click', event => event.preventDefault());
        const enter = () => {
            if (root.querySelector<HTMLElement>('#help-panel')!.hidden) this.scene.start('Hub');
        };
        this.input.keyboard?.on('keydown-ENTER', enter);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ENTER', enter));
        this.cameras.main.fadeIn(450, 9, 26, 24);
    }

    update(time: number) {
        drawAdventurer(this.hero, time / 1000, false, -0.5, false);
        drawGuardian(this.guardian, time / 1000, 1, false);
    }
}
