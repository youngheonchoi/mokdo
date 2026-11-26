import StartGame from './main';
import type { GameCharacter } from './types';
import { weaponTextureUrl } from './characters/weaponAppearance';
import { defaultWeapon } from './characters/defaultWeapon';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
}

export function mountGame(app: HTMLElement, character: GameCharacter, leave: () => void): () => void {
    document.body.classList.add('in-game');
    const shell = node('section', 'game-shell');
    shell.setAttribute('aria-label', '이끼숲 탐험');
    const viewport = node('div', 'game-viewport');
    viewport.id = 'game-container';
    const header = node('header', 'game-header');
    const identity = node('div', 'game-identity');
    identity.append(node('span', 'game-avatar-mark', '모험가'), node('strong', '', character.nickname), node('span', 'game-level', `레벨 ${character.level ?? 1}`));
    const location = node('div', 'game-location');
    location.append(node('span', '', '이끼숲'), node('strong', '', '시작의 쉼터'));
    const back = node('button', 'game-leave', '캐릭터 선택');
    back.type = 'button';
    back.onclick = leave;
    header.append(identity, location, back);
    const footer = node('div', 'game-footer');
    const equipped = node('div', 'game-equipped');
    const weaponUrl = weaponTextureUrl(character.weapon?.appearanceCode);
    if (weaponUrl) {
        const icon = node('img', 'game-weapon-icon');
        icon.alt = '';
        icon.onerror = () => {
            icon.onerror = null;
            if (character.weapon?.appearanceCode === defaultWeapon.key) icon.src = defaultWeapon.textureUrl;
            else icon.remove();
        };
        icon.src = weaponUrl;
        equipped.append(icon);
    }
    const weaponLabel = node('div', '');
    weaponLabel.append(node('span', '', '장착 무기'), node('strong', '', character.weapon?.name ?? '맨손'));
    equipped.append(weaponLabel);
    footer.append(equipped, node('p', 'game-help', '방향키 이동 · SPACE 점프 · Z 공격'));
    const loading = node('p', 'game-loading', '숲길을 준비하고 있어요…');
    loading.setAttribute('role', 'status');
    const nameplate = node('span', 'game-nameplate', character.nickname);
    nameplate.hidden = true;
    shell.append(viewport, nameplate, header, footer, loading);
    app.replaceChildren(shell);
    const game = StartGame(viewport, character, {
        ready: () => {
            if (!shell.isConnected) return;
            loading.remove();
            shell.dataset.ready = 'true';
            viewport.querySelector('canvas')?.setAttribute('aria-label', `${character.nickname}의 이끼숲 탐험. 방향키로 이동, Space로 점프, Z로 공격합니다.`);
        },
        failed: () => { loading.textContent = '숲길을 불러오지 못했어요. 캐릭터 선택으로 돌아가 다시 입장해 주세요.'; },
        position: (x, y, screenX, screenY) => {
            shell.dataset.playerX = String(Math.round(x));
            shell.dataset.playerY = String(Math.round(y));
            nameplate.hidden = false;
            nameplate.style.left = `${screenX}px`;
            nameplate.style.top = `${screenY}px`;
        }
    });
    return () => {
        game.destroy(true);
        document.body.classList.remove('in-game');
    };
}
