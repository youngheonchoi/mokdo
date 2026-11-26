import { defaultCharacter } from './game/characters/defaultCharacter';

type Character = { characterId: string; slotNo: number; nickname: string; level?: number };
const app = document.querySelector<HTMLElement>('#app')!;
const nicknameHelp = '한글, 영문, 숫자 2~12자 · 공백과 특수문자 제외';
let renderVersion = 0;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
    if (response.status === 401) {
        window.location.assign('/');
        throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.message || (response.status === 403
            ? '요청을 완료하지 못했어요. 새로고침 후 다시 시도해 주세요.'
            : '서버 요청에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    }
    return data as T;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}

function navigate(path: string) {
    window.history.pushState(null, '', path);
    void renderCharacters();
}

export async function renderCharacters() {
    const version = ++renderVersion;
    document.body.classList.remove('login');
    document.body.classList.add('authenticated');
    const panel = element('section', 'character-panel');
    panel.setAttribute('aria-label', '캐릭터');
    const loading = element('p', 'screen-message', '캐릭터를 불러오고 있어요…');
    loading.setAttribute('role', 'status');
    panel.append(loading);
    app.replaceChildren(panel);
    try {
        const characters = await request<Character[]>('/api/characters');
        if (version !== renderVersion) return;
        panel.replaceChildren();
        const slot = Number(new URLSearchParams(window.location.search).get('slot'));
        if (window.location.pathname === '/characters/create' && [1, 2, 3].includes(slot)) {
            if (characters.some(character => character.slotNo === slot)) {
                showSelection(panel, characters, '이미 사용 중인 슬롯이에요. 다른 빈 슬롯을 선택해 주세요.');
            } else {
                showCreation(panel, slot);
            }
        } else {
            if (window.location.pathname !== '/characters') {
                window.history.replaceState(null, '', '/characters');
            }
            showSelection(panel, characters);
        }
    } catch (error) {
        if (version !== renderVersion) return;
        const message = element('p', 'form-message error', errorMessage(error));
        message.setAttribute('role', 'alert');
        const retry = element('button', 'primary-button', '다시 불러오기');
        retry.onclick = () => void renderCharacters();
        panel.replaceChildren(message, retry);
    }
}

function showSelection(panel: HTMLElement, characters: Character[], notice?: string) {
    panel.append(element('h1', '', '캐릭터 선택'),
        element('p', 'screen-description', '함께 모험할 캐릭터를 선택해 주세요.'));
    const slots = element('div', 'character-slots');
    const status = element('p', 'selection-status', notice);
    status.setAttribute('role', 'status');
    for (let slotNo = 1; slotNo <= 3; slotNo++) {
        const character = characters.find(item => item.slotNo === slotNo);
        const slot = element('div', 'character-slot-wrapper');
        const card = element('button', `character-slot ${character ? 'occupied' : 'empty'}`);
        const emblem = element('span', character ? 'character-portrait' : 'slot-plus', character ? undefined : '+');
        if (character) {
            const frame = defaultCharacter.frames['south-idle'];
            const walk = defaultCharacter.animations['walk-south'];
            const position = (name: typeof walk.frames[number]) => {
                const rect = defaultCharacter.frames[name];
                return `${rect.x / (defaultCharacter.sheetWidth - rect.w) * 100}% ${rect.y / (defaultCharacter.sheetHeight - rect.h) * 100}%`;
            };
            emblem.style.backgroundImage = `url('${defaultCharacter.textureUrl}')`;
            emblem.style.backgroundSize = `${defaultCharacter.sheetWidth / frame.w * 100}% ${defaultCharacter.sheetHeight / frame.h * 100}%`;
            emblem.style.backgroundPosition = position('south-idle');
            walk.frames.forEach((name, index) => emblem.style.setProperty(`--walk-frame-${index}`, position(name)));
            emblem.style.setProperty('--walk-duration', `${walk.frames.length / walk.frameRate}s`);
        }
        emblem.setAttribute('aria-hidden', 'true');
        card.append(emblem, element('span', 'slot-name', character?.nickname ?? '캐릭터 생성'));
        if (character) {
            card.append(element('span', 'slot-level', `레벨 ${character.level ?? 1}`));
            const remove = element('button', 'character-delete', '×');
            remove.type = 'button';
            remove.setAttribute('aria-label', `${character.nickname} 캐릭터 삭제`);
            remove.onclick = () => showDeletion(character, remove);
            slot.append(remove);
            card.setAttribute('aria-pressed', 'false');
            card.onclick = () => {
                slots.querySelectorAll('[aria-pressed]').forEach(node => node.setAttribute('aria-pressed', 'false'));
                card.setAttribute('aria-pressed', 'true');
                status.textContent = `${character.nickname} 캐릭터를 선택했어요.`;
            };
        } else {
            card.onclick = () => navigate(`/characters/create?slot=${slotNo}`);
        }
        slot.prepend(card);
        slots.append(slot);
    }
    panel.append(slots, status);
}

function showDeletion(character: Character, trigger: HTMLButtonElement) {
    const dialog = element('dialog', 'character-delete-dialog');
    dialog.setAttribute('aria-labelledby', 'delete-title');
    dialog.setAttribute('aria-describedby', 'delete-description');
    const title = element('h2', '', '캐릭터 삭제');
    title.id = 'delete-title';
    const description = element('p', '', `삭제하면 복구할 수 없어요. 닉네임 ‘${character.nickname}’을 그대로 입력해 주세요.`);
    description.id = 'delete-description';
    const form = element('form', 'character-form');
    const label = element('label', 'nickname-label', '삭제할 캐릭터 닉네임');
    label.htmlFor = 'delete-nickname';
    const input = element('input', 'nickname-input');
    input.id = 'delete-nickname';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.required = true;
    const status = element('p', 'form-message');
    status.setAttribute('role', 'status');
    const actions = element('div', 'delete-actions');
    const cancel = element('button', 'secondary-button', '취소');
    cancel.type = 'button';
    cancel.onclick = () => dialog.close();
    const submit = element('button', 'primary-button danger-button', '캐릭터 삭제');
    submit.type = 'submit';
    submit.disabled = true;
    let submitting = false;
    input.oninput = () => {
        submit.disabled = submitting || input.value !== character.nickname;
        status.textContent = '';
    };
    dialog.oncancel = event => { if (submitting) event.preventDefault(); };
    dialog.onclose = () => {
        dialog.remove();
        if (trigger.isConnected) trigger.focus();
    };
    form.onsubmit = async event => {
        event.preventDefault();
        if (submitting || input.value !== character.nickname) return;
        submitting = true;
        input.disabled = cancel.disabled = submit.disabled = true;
        submit.textContent = '삭제하고 있어요…';
        try {
            const csrf = await request<{ headerName: string; token: string }>('/api/auth/csrf');
            await request(`/api/characters/${encodeURIComponent(character.characterId)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                body: JSON.stringify({ nickname: input.value })
            });
            dialog.close();
            await renderCharacters();
        } catch (error) {
            status.textContent = errorMessage(error);
            status.classList.add('error');
        } finally {
            submitting = false;
            input.disabled = cancel.disabled = false;
            submit.disabled = input.value !== character.nickname;
            submit.textContent = '캐릭터 삭제';
        }
    };
    actions.append(cancel, submit);
    form.append(label, input, status, actions);
    dialog.append(title, description, form);
    app.append(dialog);
    dialog.showModal();
    input.focus();
}

function showCreation(panel: HTMLElement, slotNo: number) {
    const back = element('button', 'back-button', '캐릭터 선택으로');
    back.type = 'button';
    back.onclick = () => navigate('/characters');
    panel.classList.add('creation-panel');
    panel.append(back, element('h1', '', '캐릭터 생성'),
        element('p', 'screen-description', '모험에서 사용할 닉네임을 정해 주세요.'));
    const form = element('form', 'character-form');
    const label = element('label', 'nickname-label', '닉네임');
    label.htmlFor = 'nickname';
    const row = element('div', 'nickname-row');
    const input = element('input', 'nickname-input');
    input.id = 'nickname';
    input.name = 'nickname';
    input.type = 'text';
    input.required = true;
    input.maxLength = 12;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = '닉네임 입력';
    input.setAttribute('aria-describedby', 'nickname-help nickname-status');
    const check = element('button', 'secondary-button', '중복 확인');
    check.type = 'button';
    check.disabled = true;
    const help = element('p', 'field-help', nicknameHelp);
    help.id = 'nickname-help';
    const status = element('p', 'form-message');
    status.id = 'nickname-status';
    status.setAttribute('role', 'status');
    const submit = element('button', 'primary-button', '캐릭터 생성');
    submit.type = 'submit';
    submit.disabled = true;
    let checkedNickname = '';
    let checking = false;
    let submitting = false;
    const normalized = () => input.value.normalize('NFC');
    const valid = () => /^[가-힣a-zA-Z0-9]{2,12}$/.test(normalized());
    function updateButtons() {
        check.disabled = !valid() || checking || submitting;
        submit.disabled = !valid() || checkedNickname !== normalized() || submitting;
    }
    function setStatus(message: string, error = false) {
        status.textContent = message;
        status.classList.toggle('error', error);
        input.setAttribute('aria-invalid', String(error));
    }
    input.oninput = () => {
        checkedNickname = '';
        setStatus(input.value ? (valid() ? '중복 확인을 진행해 주세요.' : nicknameHelp) : '', !!input.value && !valid());
        updateButtons();
    };
    check.onclick = async () => {
        if (!valid() || checking) return;
        const nickname = normalized();
        checking = true;
        updateButtons();
        setStatus('닉네임을 확인하고 있어요…');
        try {
            const result = await request<{ available: boolean }>(
                `/api/characters/nickname-check?nickname=${encodeURIComponent(nickname)}`);
            if (normalized() !== nickname) return;
            checkedNickname = result.available ? nickname : '';
            setStatus(result.available ? '사용할 수 있는 닉네임이에요.' : '이미 사용 중인 닉네임이에요.', !result.available);
        } catch (error) {
            if (normalized() === nickname) setStatus(errorMessage(error), true);
        } finally {
            checking = false;
            updateButtons();
        }
    };
    form.onsubmit = async event => {
        event.preventDefault();
        if (!valid() || checkedNickname !== normalized() || submitting) return;
        submitting = true;
        input.disabled = true;
        back.disabled = true;
        updateButtons();
        submit.textContent = '생성하고 있어요…';
        try {
            const csrf = await request<{ headerName: string; token: string }>('/api/auth/csrf');
            await request<Character>('/api/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
                body: JSON.stringify({ slotNo, nickname: normalized() })
            });
            navigate('/characters');
        } catch (error) {
            checkedNickname = '';
            setStatus(errorMessage(error), true);
        } finally {
            submitting = false;
            input.disabled = false;
            back.disabled = false;
            submit.textContent = '캐릭터 생성';
            updateButtons();
        }
    };
    row.append(input, check);
    form.append(label, row, help, status, submit);
    panel.append(form);
    input.focus();
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

window.addEventListener('popstate', () => {
    if (document.body.classList.contains('authenticated')) void renderCharacters();
});
