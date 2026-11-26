const app = document.querySelector<HTMLElement>('#app')!;

function showLogin(message?: string) {
    document.body.classList.remove('authenticated');
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
            window.history.replaceState(null, '', '/characters');
            app.replaceChildren();
            document.body.classList.add('authenticated');
            return;
        }
        if (response.status !== 401) {
            throw new Error('Session check failed');
        }
        const loginFailed = new URLSearchParams(window.location.search).get('login') === 'failed';
        window.history.replaceState(null, '', '/');
        showLogin(loginFailed ? '로그인을 완료하지 못했어요. 다시 시도해 주세요.' : undefined);
    } catch {
        showLogin('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
}

void initialize();
