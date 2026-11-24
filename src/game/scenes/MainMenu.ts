import { ApiError, fetchMe, logout, startGoogleLogin } from '../../api/auth';
import { AccountScreen } from './AccountScreen';

export class MainMenu extends AccountScreen {
    constructor() {
        super('MainMenu');
    }

    create(): void {
        this.mount('', '', 'login');
        const signal = this.abort.signal;
        const login = this.button('Google 계정으로 로그인', startGoogleLogin, 'google-login');
        login.hidden = true;
        const retry = this.button('다시 확인', () => { this.scene.restart(); }, 'secondary');
        retry.hidden = true;
        const signOut = this.button('로그아웃', () => {
            signOut.disabled = true;
            void logout(signal).then(() => {
                if (!signal.aborted) this.scene.restart();
            }).catch(() => {
                if (signal.aborted) return;
                signOut.disabled = false;
                this.status.textContent = '로그아웃하지 못했어요. 다시 시도해주세요.';
            });
        }, 'secondary');
        signOut.hidden = true;
        this.panel.append(login, retry, signOut);
        this.status.textContent = '로그인 상태를 확인하고 있어요.';

        const url = new URL(window.location.href);
        const loginFailed = url.searchParams.get('auth') === 'failed';
        if (url.searchParams.has('auth')) {
            url.searchParams.delete('auth');
            window.history.replaceState(null, '', url);
        }

        void fetchMe(signal).then(() => {
            if (!signal.aborted) this.scene.start('CharacterSelect');
        }).catch((error: unknown) => {
            if (signal.aborted) return;
            if (error instanceof ApiError && error.status === 401) {
                this.status.textContent = loginFailed
                    ? '로그인을 완료하지 못했어요. 다시 시도해주세요.'
                    : '로그인하면 캐릭터 선택 화면으로 이동해요.';
                login.hidden = false;
            } else if (error instanceof ApiError && error.status === 403) {
                this.status.textContent = '이 계정은 현재 이용할 수 없어요. 사용자 지원 이메일로 문의해주세요.';
                signOut.hidden = false;
            } else {
                this.status.textContent = '서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.';
                retry.hidden = false;
            }
        });
    }
}
