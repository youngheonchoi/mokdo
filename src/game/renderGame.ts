import { maps } from './portals';
import { mountFullscreenButton } from './ui/fullscreenButton';
import StartGame from './main';
import type { GameCharacter } from './types';
import { weaponTextureUrl } from './characters/weaponAppearance';
import { defaultWeapon } from './characters/defaultWeapon';
import { mountNpcShops } from './ui/npcShops';
import { mountItemWindows } from './ui/itemWindows';
import type { Forest } from './scenes/Forest';
import { connectBattle } from './battleClient';
import { mountBattleOverlay } from './ui/battleOverlay';

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
    location.append(node('span', '', '이끼숲'), node('strong', '', '숲길 초입'));
    const back = node('button', 'game-leave', '캐릭터 선택');
    back.type = 'button';
    back.onclick = leave;
    const actions = node('div', 'game-header-actions');
    actions.append(back);
    const disposeFullscreen = mountFullscreenButton(shell, actions);
    header.append(identity, location, actions);
    const footer = node('div', 'game-footer');
    const equipped = node('div', 'game-equipped');
    function renderWeapon(current: GameCharacter) {
        equipped.replaceChildren();
        const weaponUrl = weaponTextureUrl(current.weapon?.appearanceCode, current.weapon?.itemId);
        if (weaponUrl) {
            const icon = node('img', 'game-weapon-icon');
            icon.alt = '';
            icon.onerror = () => {
                icon.onerror = null;
                if (current.weapon?.appearanceCode === defaultWeapon.key) icon.src = defaultWeapon.textureUrl;
                else icon.remove();
            };
            icon.src = weaponUrl;
            equipped.append(icon);
        }
        const weaponLabel = node('div', '');
        weaponLabel.append(node('span', '', '장착 무기'), node('strong', '', current.weapon?.name ?? '맨손'));
        equipped.append(weaponLabel);
    }
    renderWeapon(character);
    const toolbar = node('nav', 'game-toolbar');
    toolbar.setAttribute('aria-label', '캐릭터 메뉴');
    toolbar.hidden = true;
    footer.append(equipped, node('p', 'game-help', '← → 진행 · ↑ ↓ 앞뒤 이동 · SPACE 점프 · Z 공격 · G 상호작용'), toolbar);
    const loading = node('p', 'game-loading', '숲길을 준비하고 있어요…');
    loading.setAttribute('role', 'status');
    const nameplate = node('span', 'game-nameplate', character.nickname);
    nameplate.hidden = true;
    shell.append(viewport, nameplate, header, footer, loading);
    app.replaceChildren(shell);
    const battleOverlay = mountBattleOverlay(shell);
    let stopBattle: ReturnType<typeof connectBattle> | undefined;
    let npcShops: ReturnType<typeof mountNpcShops> | undefined;
    let itemWindows: ReturnType<typeof mountItemWindows> | undefined;
    const inputBlocks = new Set<string>();
    const setBlocked = (source: string, blocked: boolean) => {
        if (blocked) inputBlocks.add(source); else inputBlocks.delete(source);
        (game.scene.getScene('Forest') as Forest | undefined)?.setUiBlocked(inputBlocks.size > 0);
    };
    const game = StartGame(viewport, character, {
        ready: () => {
            if (!shell.isConnected) return;
            loading.remove();
            shell.dataset.ready = 'true';
            toolbar.hidden = false;
            const scene = game.scene.getScene('Forest') as Forest;
            stopBattle = connectBattle(character.characterId, () => scene.battleInput(), (state, entering, prediction) => {
                scene.applyBattle(state, entering, prediction);
                const mapId = state.mapId ?? 'forest';
                shell.dataset.mapId = mapId;
                location.querySelector('strong')!.textContent = maps[mapId].name;
                npcShops?.setMap(mapId);
                identity.querySelector('.game-level')!.textContent = `레벨 ${state.character.level ?? 1}`;
                if (character.weapon?.characterItemId !== state.character.weapon?.characterItemId) renderWeapon(state.character);
                character = state.character;
                itemWindows?.updateCharacter(character);
                npcShops?.updateCharacter(character);
                if (state.effects.some(effect => effect.kind === 'ITEM')) void itemWindows?.refresh();
            }, message => {
                scene.setBattleAvailable(!message);
                battleOverlay.status(message);
            });
            npcShops = mountNpcShops(shell, character, async () => { await itemWindows?.refresh(); }, blocked => {
                setBlocked('shop', blocked);
                itemWindows?.setExternalBlocked(blocked);
            });
            viewport.querySelector('canvas')?.setAttribute('aria-label', `${character.nickname}의 이끼숲 탐험. 좌우 방향키로 진행, 위아래 방향키로 앞뒤 이동, Space로 점프, Z로 좌우 공격, G로 포탈을 이용합니다.`);
        },
        failed: () => { loading.textContent = '숲길을 불러오지 못했어요. 캐릭터 선택으로 돌아가 다시 입장해 주세요.'; },
        battleView: state => battleOverlay.apply(state),
        action: () => stopBattle?.wake(),
        battlePosition: (...args) => {
            battleOverlay.position(...args);
            npcShops?.position(args[2], args[3], args[4]);
        },
        position: (x, y, screenX, screenY) => {
            shell.dataset.playerX = String(Math.round(x));
            shell.dataset.playerY = String(Math.round(y));
            nameplate.hidden = false;
            nameplate.style.left = `${screenX}px`;
            nameplate.style.top = `${screenY}px`;
        }
    });
    itemWindows = mountItemWindows(shell, toolbar, character, current => {
        character = current;
        npcShops?.updateCharacter(current);
        renderWeapon(current);
        identity.querySelector('.game-level')!.textContent = `레벨 ${current.level ?? 1}`;
        (game.scene.getScene('Forest') as Forest | undefined)?.setCharacter(current);
    }, blocked => setBlocked('items', blocked));
    return () => {
        disposeFullscreen();
        stopBattle?.();
        battleOverlay.dispose();
        npcShops?.dispose();
        itemWindows?.();
        game.destroy(true);
        document.body.classList.remove('in-game');
    };
}
