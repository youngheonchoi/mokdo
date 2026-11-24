import { ApiError, fetchCharacters, logout } from '../../api/auth';
import { AccountScreen } from './AccountScreen';

export class CharacterSelect extends AccountScreen {
    constructor() {
        super('CharacterSelect');
    }

    create(): void {
        this.mount('캐릭터 선택', '함께 이야기를 이어갈 캐릭터를 선택하세요.');
        const signal = this.abort.signal;
        const list = document.createElement('div');
        list.className = 'character-list';
        list.setAttribute('aria-label', '내 캐릭터');
        const next = this.button('캐릭터를 선택해주세요', () => {});
        next.disabled = true;
        next.hidden = true;
        const retry = this.button('다시 불러오기', () => { this.scene.restart(); }, 'secondary');
        retry.hidden = true;
        const signOut = this.button('로그아웃', () => {
            signOut.disabled = true;
            void logout(signal).then(() => {
                if (!signal.aborted) this.scene.start('MainMenu');
            }).catch((error: unknown) => {
                if (signal.aborted) return;
                if (error instanceof ApiError && error.status === 401) {
                    this.scene.start('MainMenu');
                    return;
                }
                signOut.disabled = false;
                this.status.textContent = '로그아웃하지 못했어요. 다시 시도해주세요.';
            });
        }, 'secondary');
        this.panel.append(list, next, retry, signOut);
        this.status.textContent = '캐릭터를 불러오고 있어요.';

        void fetchCharacters(signal).then(characters => {
            if (signal.aborted) return;
            this.status.textContent = characters.length === 0
                ? '아직 캐릭터가 없어요. 캐릭터 생성 기능은 준비 중이에요.'
                : `${characters.length}명의 캐릭터가 기다리고 있어요.`;
            for (const character of characters) {
                const card = this.button('', () => {
                    list.querySelectorAll('[aria-pressed]').forEach(item => item.setAttribute('aria-pressed', 'false'));
                    card.setAttribute('aria-pressed', 'true');
                    this.status.textContent = `${character.name} 캐릭터를 선택했어요.`;
                    next.textContent = character.introCompletedAt
                        ? '마을 입장 · 준비 중' : '첫 이야기 보기 · 준비 중';
                    next.hidden = false;
                }, 'character-card');
                card.setAttribute('aria-pressed', 'false');
                const slot = document.createElement('span');
                slot.className = 'character-slot';
                slot.textContent = `슬롯 ${character.slotNo}`;
                const name = document.createElement('strong');
                name.textContent = character.name;
                const progress = document.createElement('span');
                progress.textContent = character.introCompletedAt ? '마을에서 이어질 이야기' : '첫 이야기를 시작해보세요';
                card.append(slot, name, progress);
                list.append(card);
            }
            // The slot limit and character creation are defined in the next milestone.
            const empty = this.button('＋ 캐릭터 생성 · 준비 중', () => {}, 'empty-slot');
            empty.disabled = true;
            list.append(empty);
        }).catch((error: unknown) => {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status === 401) {
                this.scene.start('MainMenu');
            } else if (error instanceof ApiError && error.status === 403) {
                this.status.textContent = '이 계정은 현재 이용할 수 없어요. 사용자 지원 이메일로 문의해주세요.';
            } else {
                this.status.textContent = '캐릭터를 불러오지 못했어요. 다시 시도해주세요.';
                retry.hidden = false;
            }
        });
    }
}
