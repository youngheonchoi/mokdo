import { Scene } from 'phaser';
import { ApiError, fetchCharacter } from '../../api/auth';
import { startAdventure } from '../adventure';

/** Validate ownership and intro completion before starting the playable village. */
export class Village extends Scene {
    private characterId: string;

    constructor() { super('Village'); }

    init(data: { characterId?: string }): void {
        this.characterId = data.characterId || '';
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#91b87a');
        const abort = new AbortController();
        const hud = document.createElement('section');
        hud.className = 'account-overlay';
        const panel = document.createElement('div');
        panel.className = 'account-panel';
        hud.append(panel);
        const heading = document.createElement('h1');
        heading.textContent = 'MOKDO 마을';
        const message = document.createElement('p');
        message.textContent = '캐릭터를 확인하고 있어요.';
        message.setAttribute('role', 'status');
        const back = document.createElement('button');
        back.className = 'account-button secondary';
        back.textContent = '캐릭터 선택으로';
        back.addEventListener('click', () => { this.scene.start('CharacterSelect'); }, { signal: abort.signal });
        const retry = document.createElement('button');
        retry.className = 'account-button';
        retry.textContent = '다시 연결';
        retry.hidden = true;
        retry.addEventListener('click', () => { this.scene.restart({ characterId: this.characterId }); }, { signal: abort.signal });
        panel.append(heading, message, retry, back);
        document.getElementById('app')!.append(hud);
        this.events.once('shutdown', () => { abort.abort(); hud.remove(); });
        if (!this.characterId) { this.scene.start('CharacterSelect'); return; }
        void fetchCharacter(this.characterId, abort.signal).then(character => {
            if (abort.signal.aborted) return;
            if (!character.introCompletedAt) {
                this.scene.start('IntroStory', { characterId: this.characterId });
                return;
            }
            startAdventure(character);
            this.scene.start('Hub');
        }).catch((error: unknown) => {
            if (abort.signal.aborted) return;
            if (error instanceof ApiError && error.status === 401) { this.scene.start('MainMenu'); return; }
            if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
                this.scene.start('CharacterSelect'); return;
            }
            message.textContent = '캐릭터 정보를 확인하지 못했어요. 다시 연결해주세요.';
            retry.hidden = false;
        });
    }
}
