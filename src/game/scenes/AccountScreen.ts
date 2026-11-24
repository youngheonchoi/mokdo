import { Scene } from 'phaser';
import { endAdventure } from '../adventure';

export abstract class AccountScreen extends Scene {
    protected panel: HTMLElement;
    protected status: HTMLParagraphElement;
    protected abort: AbortController;

    protected mount(title: string, description: string, variant: 'default' | 'login' = 'default'): void {
        for (const key of ['Hub', 'Game', 'BossRoom', 'BossLobby', 'GameOver']) this.scene.stop(key);
        endAdventure();
        this.cameras.main.setBackgroundColor('#10251f');
        this.abort = new AbortController();
        const overlay = document.createElement('section');
        overlay.className = variant === 'login' ? 'account-overlay account-overlay--login' : 'account-overlay';
        this.panel = document.createElement('div');
        this.panel.className = variant === 'login' ? 'account-panel login-panel' : 'account-panel';
        const brand = document.createElement('p');
        brand.className = 'account-brand';
        brand.textContent = 'MOKDO';
        const heading = document.createElement('h1');
        heading.textContent = title;
        const subtitle = document.createElement('p');
        subtitle.className = 'account-description';
        subtitle.textContent = description;
        this.status = document.createElement('p');
        this.status.className = 'account-status';
        if (variant === 'login') this.status.classList.add('visually-hidden');
        this.status.setAttribute('role', 'status');
        this.panel.append(brand);
        if (variant !== 'login') this.panel.append(heading, subtitle);
        this.panel.append(this.status);
        overlay.append(this.panel);
        document.getElementById('app')!.append(overlay);
        this.events.once('shutdown', () => {
            this.abort.abort();
            overlay.remove();
        });
    }

    protected button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `account-button ${className}`;
        button.textContent = label;
        button.addEventListener('click', onClick, { signal: this.abort.signal });
        return button;
    }
}
