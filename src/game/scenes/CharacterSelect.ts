import { ApiError, deleteCharacter, fetchCharacters, logout, type CharacterSummary } from '../../api/auth';
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
        this.panel.append(list, retry, signOut);
        this.status.textContent = '캐릭터를 불러오고 있어요.';

        void fetchCharacters(signal).then(characters => {
            if (signal.aborted) return;
            this.status.textContent = characters.length === 0
                ? '아직 캐릭터가 없어요. 첫 캐릭터를 만들어보세요.'
                : `${characters.length}명의 캐릭터가 기다리고 있어요.`;
            for (const character of characters) {
                const card = this.button('', () => {
                    this.scene.start(character.introCompletedAt ? 'Village' : 'IntroStory', {
                        characterId: character.id
                    });
                }, 'character-card');
                const slot = document.createElement('span');
                slot.className = 'character-slot';
                slot.textContent = `슬롯 ${character.slotNo}`;
                const name = document.createElement('strong');
                name.textContent = character.name;
                const progress = document.createElement('span');
                progress.textContent = character.introCompletedAt ? '마을에서 이어질 이야기' : '첫 이야기를 시작해보세요';
                const details = document.createElement('div');
                details.append(slot, name, progress);
                card.append(details);
                const row = document.createElement('div');
                row.className = 'character-row';
                const remove = this.button('삭제', () => { this.confirmDelete(character); }, 'character-delete secondary');
                remove.setAttribute('aria-label', `${character.name} 캐릭터 삭제`);
                row.append(card, remove);
                list.append(row);
            }
            const empty = this.button('＋ 캐릭터 생성', () => { this.scene.start('CharacterCreate'); }, 'empty-slot');
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

    private confirmDelete(character: CharacterSummary): void {
        const signal = this.abort.signal;
        const dialog = document.createElement('dialog');
        dialog.className = 'character-delete-dialog';
        dialog.setAttribute('aria-labelledby', 'delete-character-title');
        dialog.setAttribute('aria-describedby', 'delete-character-description');
        const title = document.createElement('h2');
        title.id = 'delete-character-title';
        title.textContent = '캐릭터를 삭제할까요?';
        const description = document.createElement('p');
        description.id = 'delete-character-description';
        description.textContent = `${character.name} 캐릭터가 목록에서 사라져요. 삭제 후에는 되돌릴 수 없어요.`;
        const form = document.createElement('form');
        const label = document.createElement('label');
        label.htmlFor = 'delete-character-name';
        label.textContent = `확인을 위해 “${character.name}”을 입력해주세요.`;
        const input = document.createElement('input');
        input.id = 'delete-character-name';
        input.className = 'account-input';
        input.autocomplete = 'off';
        input.required = true;
        const feedback = document.createElement('p');
        feedback.className = 'field-feedback';
        feedback.setAttribute('role', 'status');
        let saving = false;
        const cancel = this.button('취소', () => { dialog.close(); }, 'secondary');
        const confirm = this.button('캐릭터 삭제', () => {}, 'danger');
        confirm.type = 'submit';
        confirm.disabled = true;
        const reload = this.button('목록 새로고침', () => { this.scene.restart(); }, 'secondary');
        reload.hidden = true;
        input.addEventListener('input', () => {
            confirm.disabled = saving || input.value !== character.name;
        }, { signal });
        dialog.addEventListener('cancel', event => {
            if (saving) event.preventDefault();
        }, { signal });
        dialog.addEventListener('close', () => { dialog.remove(); }, { once: true });
        signal.addEventListener('abort', () => { dialog.close(); dialog.remove(); }, { once: true });
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (saving || input.value !== character.name) return;
            saving = true;
            input.disabled = true;
            confirm.disabled = true;
            cancel.disabled = true;
            confirm.textContent = '삭제 중…';
            void deleteCharacter(character.id, input.value, signal).then(() => {
                if (!signal.aborted) this.scene.restart();
            }).catch((error: unknown) => {
                if (signal.aborted) return;
                if (error instanceof ApiError && error.status === 401) {
                    this.scene.start('MainMenu');
                    return;
                }
                feedback.dataset.state = 'error';
                feedback.textContent = error instanceof ApiError && error.code === 'confirmation_mismatch'
                    ? '캐릭터명을 정확하게 입력해주세요.'
                    : error instanceof ApiError && error.status === 404
                        ? '캐릭터를 찾을 수 없어요. 목록을 새로고침해주세요.'
                        : '삭제하지 못했어요. 로그인 상태와 연결을 확인한 뒤 다시 시도해주세요.';
                reload.hidden = !(error instanceof ApiError && error.status === 404);
            }).finally(() => {
                if (signal.aborted) return;
                saving = false;
                input.disabled = false;
                cancel.disabled = false;
                confirm.disabled = input.value !== character.name;
                confirm.textContent = '캐릭터 삭제';
            });
        }, { signal });
        const actions = document.createElement('div');
        actions.className = 'dialog-actions';
        actions.append(cancel, confirm);
        form.append(label, input, feedback, actions, reload);
        dialog.append(title, description, form);
        this.panel.append(dialog);
        dialog.showModal();
        input.focus();
    }
}
