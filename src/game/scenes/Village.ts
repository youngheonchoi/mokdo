import { Scene } from 'phaser';
import { ApiError, fetchCharacter } from '../../api/auth';
import { stickFigure } from '../ui/stickFigure';

/** Temporary destination for checking the intro-to-village flow. */
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
        hud.className = 'village-placeholder';
        const heading = document.createElement('h1');
        heading.textContent = 'MOKDO 마을';
        const message = document.createElement('p');
        message.textContent = '캐릭터를 확인하고 있어요.';
        message.setAttribute('role', 'status');
        const back = document.createElement('button');
        back.className = 'account-button secondary';
        back.textContent = '캐릭터 선택으로';
        back.addEventListener('click', () => { this.scene.start('CharacterSelect'); }, { signal: abort.signal });
        hud.append(heading, message, back);
        document.getElementById('app')!.append(hud);
        this.events.once('shutdown', () => { abort.abort(); hud.remove(); });
        if (!this.characterId) { this.scene.start('CharacterSelect'); return; }
        void fetchCharacter(this.characterId, abort.signal).then(character => {
            if (abort.signal.aborted) return;
            if (!character.introCompletedAt) {
                this.scene.start('IntroStory', { characterId: this.characterId });
                return;
            }
            const ground = this.add.graphics();
            ground.fillStyle(0xc9c69a).fillRect(450, 0, 124, 768).fillRect(0, 340, 1024, 88);
            for (const [x, y] of [[190, 200], [760, 190], [210, 560], [770, 540]]) {
                ground.fillStyle(0xeed9ad).fillRoundedRect(x - 70, y - 50, 140, 110, 8);
                ground.fillStyle(0xa35e43).fillTriangle(x - 88, y - 48, x, y - 120, x + 88, y - 48);
                ground.fillStyle(0x62543e).fillRoundedRect(x - 16, y + 15, 32, 45, 4);
                ground.fillStyle(0x99cbda).fillRect(x - 48, y - 22, 28, 28).fillRect(x + 20, y - 22, 28, 28);
            }
            for (const [x, y] of [[90, 80], [900, 80], [80, 680], [920, 670]]) {
                ground.fillStyle(0x79543a).fillRect(x - 8, y, 16, 45);
                ground.fillStyle(0x426e43).fillCircle(x, y - 16, 42);
                ground.fillStyle(0x638d50).fillCircle(x - 16, y - 30, 25);
            }
            const avatar = document.createElement('div');
            avatar.className = 'village-avatar';
            avatar.append(stickFigure());
            hud.append(avatar);
            message.textContent = `${character.name}님, 마을에 도착했어요. 현재는 임시 마을 화면이에요.`;
        }).catch((error: unknown) => {
            if (abort.signal.aborted) return;
            if (error instanceof ApiError && error.status === 401) { this.scene.start('MainMenu'); return; }
            if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
                this.scene.start('CharacterSelect'); return;
            }
            message.textContent = '캐릭터 정보를 확인하지 못했어요. 캐릭터 선택 화면에서 다시 시도해주세요.';
        });
    }
}
