import { ApiError, checkCharacterName, createCharacter, isValidCharacterName, normalizeCharacterName } from '../../api/auth';
import { stickFigure } from '../ui/stickFigure';
import { AccountScreen } from './AccountScreen';

export class CharacterCreate extends AccountScreen {
    constructor() {
        super('CharacterCreate');
    }

    create(): void {
        this.mount('캐릭터 생성', '새로운 이야기를 함께할 캐릭터의 이름을 지어주세요.');
        const signal = this.abort.signal;
        this.panel.classList.add('character-create-panel');
        this.status.classList.add('visually-hidden');
        const preview = document.createElement('div');
        preview.className = 'character-preview';
        preview.append(stickFigure());
        const form = document.createElement('form');
        const label = document.createElement('label');
        label.htmlFor = 'character-name';
        label.textContent = '닉네임';
        const row = document.createElement('div');
        row.className = 'nickname-row';
        const input = document.createElement('input');
        input.id = 'character-name';
        input.name = 'nickname';
        input.className = 'account-input';
        input.placeholder = '닉네임을 입력해주세요';
        input.maxLength = 12;
        input.autocomplete = 'off';
        input.required = true;
        input.setAttribute('aria-describedby', 'nickname-hint nickname-result');
        const hint = document.createElement('p');
        hint.id = 'nickname-hint';
        hint.className = 'field-hint';
        hint.textContent = '한글·영문·숫자 2~12자 · 영문 대소문자는 구분하지 않아요.';
        const feedback = document.createElement('p');
        feedback.id = 'nickname-result';
        feedback.className = 'field-feedback';
        feedback.setAttribute('role', 'status');
        let checkedName: string | null = null;
        let revision = 0;
        let checking = false;
        let saving = false;
        const refresh = (): void => {
            check.disabled = checking || saving || !isValidCharacterName(input.value);
            submit.disabled = saving || checking || checkedName !== normalizeCharacterName(input.value);
        };
        const handleError = (error: unknown): void => {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status === 401) {
                this.scene.start('MainMenu');
                return;
            }
            const messages: Record<string, string> = {
                nickname_taken: '이미 사용 중인 닉네임이에요. 다른 이름을 입력해주세요.',
                nickname_invalid: '한글·영문·숫자로 2~12자를 입력해주세요.',
                character_slots_full: '더 이상 캐릭터를 생성할 수 없어요.'
            };
            feedback.textContent = error instanceof ApiError && error.status === 403
                ? '요청을 진행할 수 없어요. 로그인 상태를 확인해주세요.'
                : error instanceof ApiError && messages[error.code]
                    ? messages[error.code] : '서버에 연결하지 못했어요. 다시 시도해주세요.';
            feedback.dataset.state = 'error';
        };
        const check = this.button('중복 확인', () => {
            const name = normalizeCharacterName(input.value);
            const currentRevision = revision;
            checking = true;
            checkedName = null;
            feedback.textContent = '닉네임을 확인하고 있어요.';
            feedback.dataset.state = '';
            refresh();
            void checkCharacterName(name, signal).then(available => {
                if (signal.aborted || revision !== currentRevision) return;
                checkedName = available ? name : null;
                feedback.textContent = available ? '사용할 수 있는 닉네임이에요.' : '이미 사용 중인 닉네임이에요.';
                feedback.dataset.state = available ? 'success' : 'error';
            }).catch(error => {
                if (revision === currentRevision) handleError(error);
            }).finally(() => {
                if (signal.aborted) return;
                checking = false;
                refresh();
            });
        }, 'secondary');
        const submit = this.button('캐릭터 생성', () => {});
        submit.type = 'submit';
        const back = this.button('돌아가기', () => { this.scene.start('CharacterSelect'); }, 'secondary');
        input.addEventListener('input', () => {
            revision++;
            checkedName = null;
            feedback.textContent = '';
            feedback.dataset.state = '';
            refresh();
        }, { signal });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const name = normalizeCharacterName(input.value);
            if (saving || checking || checkedName !== name || !isValidCharacterName(name)) return;
            saving = true;
            input.disabled = true;
            back.disabled = true;
            submit.textContent = '생성 중…';
            refresh();
            void createCharacter(name, signal).then(() => {
                if (!signal.aborted) this.scene.start('CharacterSelect');
            }).catch(error => {
                checkedName = null;
                handleError(error);
            }).finally(() => {
                if (signal.aborted) return;
                saving = false;
                input.disabled = false;
                back.disabled = false;
                submit.textContent = '캐릭터 생성';
                refresh();
            });
        }, { signal });
        row.append(input, check);
        form.append(label, row, hint, feedback, submit);
        this.panel.append(preview, form, back);
        refresh();
    }
}
