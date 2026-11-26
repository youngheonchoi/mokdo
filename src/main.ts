import { renderCharacters } from './characters';

const app = document.querySelector<HTMLElement>('#app')!;
const previousLoginKey = 'mokdo.googleLoginCompleted';

window.addEventListener('keydown', event => {
    if (event.key === 'Tab') event.preventDefault();
}, { capture: true });

function rememberLogin(completed: boolean) {
    try {
        if (completed) {
            localStorage.setItem(previousLoginKey, 'true');
        } else {
            localStorage.removeItem(previousLoginKey);
        }
    } catch {
        // Login still works when browser storage is unavailable.
    }
}

function consumePreviousLogin(): boolean {
    try {
        const completed = localStorage.getItem(previousLoginKey) === 'true';
        // Re-arm only after a verified session, preventing automatic redirect loops.
        localStorage.removeItem(previousLoginKey);
        return completed;
    } catch {
        return false;
    }
}

function showLogin(message?: string) {
    document.body.classList.remove('authenticated');
    document.body.classList.add('login');
    app.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'login-panel';
    const button = document.createElement('a');
    button.className = 'google-login';
    button.href = '/oauth2/authorization/google';
    button.textContent = 'Google로 로그인';
    panel.append(button);
    if (message) {
        const error = document.createElement('p');
        error.className = 'login-error';
        error.setAttribute('role', 'alert');
        error.textContent = message;
        panel.append(error);
    }
    app.append(panel);
}

async function initialize() {
    // Keep all game scenes and assets unloaded until character content is ready.
    try {
        const response = await fetch('/api/auth/session', {
            credentials: 'same-origin',
            cache: 'no-store'
        });
        if (response.ok) {
            const session = await response.json();
            if (typeof session.memberId !== 'string' || !session.memberId) {
                throw new Error('Invalid session response');
            }
            rememberLogin(true);
            if (!['/characters', '/characters/create'].includes(window.location.pathname)) {
                window.history.replaceState(null, '', '/characters');
            }
            await renderCharacters();
            return;
        }
        if (response.status !== 401) {
            throw new Error('Session check failed');
        }
        const loginFailed = new URLSearchParams(window.location.search).get('login') === 'failed';
        if (loginFailed) {
            rememberLogin(false);
        } else if (consumePreviousLogin()) {
            window.location.replace('/oauth2/authorization/google?auto=1');
            return;
        }
        window.history.replaceState(null, '', '/');
        showLogin(loginFailed ? '로그인을 완료하지 못했어요. 다시 시도해 주세요.' : undefined);
    } catch {
        showLogin('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
}

void initialize();
