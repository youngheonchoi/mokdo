import { installKeyboardGuard } from './keyboardGuard';
import { applyCheat, type Merchant } from './commerce';
import { createShop } from './shop';
import type { Scene } from 'phaser';
import { adventurerName } from './adventure';
import { createInventory } from './inventory';
import { ITEMS } from './items';
import { progress, quickslots, statsFor, xpProgress, LEVEL_XP, type Profile } from './progression';

import { QUICKSLOT_KEYS } from './quickslots';
import { renderConsumableSlots } from './quickslotView';

export function focusGameCanvas(scene: Scene): void {
    const canvas = scene.game.canvas;
    canvas.tabIndex = -1;
    canvas.classList.add('gameplay-canvas');
    canvas.focus({ preventScroll: true });
}

/** One layout for town, field, dungeon and the cave waiting room. */
export function mountInGameHud(scene: Scene, root: HTMLElement): void {
    const screen = root.querySelector<HTMLElement>('.game-screen, .lobby-screen');
    if (!screen) return;
    screen.classList.add('in-game');
    const focusCanvas = () => focusGameCanvas(scene);
    scene.game.canvas.addEventListener('pointerdown', focusCanvas);
    scene.events.once('shutdown', () => {
        removeKeyboardGuard();
        scene.game.canvas.removeEventListener('pointerdown', focusCanvas);
    });
    // Mouse activation should not leave a HUD button holding gameplay focus.
    // Dialogs and keyboard navigation retain their usual focus behavior.
    root.addEventListener('pointerdown', event => {
        const target = event.target as Element;
        if (event.button === 0 && target.closest('button') && !target.closest('dialog, .modal-backdrop')) {
            event.preventDefault();
            focusGameCanvas(scene);
        }
    });
    const profile = progress.read();
    const stats = statsFor(profile.xp);
    const xp = xpProgress(profile.xp);
    const footer = document.createElement('footer');
    footer.className = 'in-game-dock';
    footer.setAttribute('aria-label', '인게임 공통 UI');
    footer.innerHTML = `
        <div class="dock-content">
        <section class="dock-character" aria-label="캐릭터 정보"><strong data-character-name></strong><span id="player-level">Lv. ${stats.level}</span></section>
        <section class="dock-vitals" aria-label="캐릭터 상태">
            <div class="dock-meter"><span>HP</span><div class="dock-track"><div id="player-hp-bar" style="width:100%"></div><span id="player-hp-text">${stats.maxHp} / ${stats.maxHp}</span></div></div>
            <div class="dock-meter xp-meter"><span>EXP</span><div class="dock-track"><div id="player-xp-bar" style="width:${xp.percent}%"></div><span id="player-xp-text">${stats.level === 5 ? `${profile.xp} / ${LEVEL_XP[4]}` : `${xp.current} / ${xp.required}`}</span></div></div>
        </section>
        <section class="dock-quickslots" aria-label="퀵슬롯 10칸">
            ${QUICKSLOT_KEYS.map((_, i) => `<button type="button" class="quickslot empty-quickslot" data-consumable-slot="${i}" aria-label="빈 퀵슬롯 ${i + 1}"></button>`).join('')}
        </section>
        <nav class="dock-tools" aria-label="인게임 메뉴"><button class="dock-button" id="open-profile" aria-haspopup="dialog" title="가방 (I)" aria-keyshortcuts="I">가방</button><button class="dock-button" id="hud-open-menu" aria-haspopup="dialog" title="메뉴 (Esc)" aria-keyshortcuts="Escape">메뉴</button></nav></div>`;
    const bindings = quickslots;
    const renderBindings = () => renderConsumableSlots(footer, bindings, progress.read().bag);
    renderBindings();
    const unsubscribe = bindings.subscribe(renderBindings);
    scene.events.once('shutdown', unsubscribe);
    footer.querySelector('[data-character-name]')!.textContent = adventurerName();
    const cheats = document.createElement('aside');
    cheats.className = 'cheat-panel';
    cheats.setAttribute('aria-label', '치트');
    cheats.innerHTML = '<span>치트</span><button type="button" id="cheat-level">레벨업 +1</button><button type="button" id="cheat-gold">돈 +10000</button><p class="cheat-status" role="status"></p>';
    screen.append(cheats);
    const refreshHud = (current: Profile) => {
        const stats = statsFor(current.xp);
        const xp = xpProgress(current.xp);
        footer.querySelector('#player-level')!.textContent = `Lv. ${stats.level}`;
        footer.querySelector<HTMLElement>('#player-xp-bar')!.style.width = `${xp.percent}%`;
        footer.querySelector('#player-xp-text')!.textContent = stats.level === LEVEL_XP.length ? `${current.xp} / ${LEVEL_XP[LEVEL_XP.length - 1]}` : `${xp.current} / ${xp.required}`;
        if (screen.classList.contains('town-screen') || screen.classList.contains('lobby-screen')) {
            footer.querySelector('#player-hp-text')!.textContent = `${stats.maxHp} / ${stats.maxHp}`;
            footer.querySelector<HTMLElement>('#player-hp-bar')!.style.width = '100%';
        }
        root.querySelectorAll('[data-profile-level]').forEach(node => { node.textContent = `Lv. ${stats.level}`; });
        root.querySelectorAll('[data-profile-stats]').forEach(node => { node.textContent = `체력 ${stats.maxHp} · 공격력 ${stats.attack}`; });
        cheats.querySelector<HTMLButtonElement>('#cheat-level')!.disabled = stats.level >= LEVEL_XP.length;
        cheats.querySelector('#cheat-level')!.setAttribute('title', stats.level >= LEVEL_XP.length ? '현재 최고 레벨입니다.' : '레벨을 1 올립니다.');
        cheats.querySelector('.cheat-status')!.textContent = `Lv. ${stats.level} · ${current.bag.gold.toLocaleString()} 골드`;
        renderBindings();
    };
    const commitProfile = (next: Profile): string => {
        progress.commit(next);
        refreshHud(next);
        scene.events.emit('profile-updated', next);
        return progress.message;
    };
    cheats.querySelector<HTMLButtonElement>('#cheat-level')!.onclick = () => { commitProfile(applyCheat(progress.read(), 'level')); };
    cheats.querySelector<HTMLButtonElement>('#cheat-gold')!.onclick = () => { commitProfile(applyCheat(progress.read(), 'gold')); };
    refreshHud(profile);
    const bag = footer.querySelector<HTMLButtonElement>('#open-profile')!;
    const menuActions = document.createElement('div');
    menuActions.className = 'hud-menu-actions';
    menuActions.hidden = true;
    root.querySelectorAll('.game-header button:not(#town-home):not(#open-profile)').forEach(button => menuActions.append(button));
    const timer = root.querySelector('#run-time');
    if (timer) menuActions.prepend(timer);
    root.append(menuActions);
    screen.querySelector('.game-footer, .exploration-footer')?.remove();
    screen.querySelector('.game-header')?.remove();
    screen.querySelector('.route-trail')?.remove();
    screen.append(footer);
    if (screen.classList.contains('town-screen')) {
        const save = document.createElement('p');
        save.id = 'town-save';
        save.className = 'hud-save-message save-warning';
        save.textContent = progress.message;
        screen.append(save);
    }
    const mapTitle = screen.querySelector('.mini-map > div > span:first-child');
    if (mapTitle) {
        const heading = document.createElement('h1');
        heading.textContent = mapTitle.textContent;
        mapTitle.replaceWith(heading);
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'hud-dialog';
    dialog.setAttribute('aria-labelledby', 'hud-dialog-title');
    dialog.innerHTML = '<header><h2 id="hud-dialog-title"></h2><button class="icon-button" aria-label="닫기">×</button></header><div class="hud-dialog-content"></div>';
    root.append(dialog);
    const close = dialog.querySelector<HTMLButtonElement>('button')!;
    const content = dialog.querySelector<HTMLElement>('.hud-dialog-content')!;
    const resetKeys = () => scene.input.keyboard?.resetKeys();
    const open = (title: string) => {
        dialog.classList.toggle('inventory-dialog', title === '가방');
        dialog.classList.toggle('shop-dialog', title.endsWith('상인'));
        dialog.querySelector('h2')!.textContent = title;
        resetKeys();
        if (!dialog.open) dialog.showModal();
        close.focus();
    };
    const returnToGame = () => {
        dialog.close();
        focusGameCanvas(scene);
    };
    close.onclick = returnToGame;
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        returnToGame();
    });
    dialog.addEventListener('keydown', event => {
        handleShortcut(event);
        event.stopPropagation();
    });
    dialog.addEventListener('keyup', event => event.stopPropagation());
    footer.querySelector<HTMLButtonElement>('#hud-open-menu')!.onclick = () => {
        menuActions.hidden = true;
        root.append(menuActions);
        content.innerHTML = '<p>방향키로 이동하고, Space로 포탈과 동굴을 이용하세요.</p><dl class="hud-controls"><dt>Ctrl</dt><dd>일반 공격</dd><dt>Space</dt><dd>상호작용</dd><dt>Q W E R T<br>A S D F G</dt><dd>퀵슬롯 1~10</dd><dt>I</dt><dd>가방 열기 · 닫기</dd><dt>Esc</dt><dd>메뉴 열기 · 열린 창 닫기</dd></dl><p>바닥 전리품은 가까이 가면 자동으로 획득해요.</p><p class="hud-storage-note"></p>';
        content.querySelector('.hud-storage-note')!.textContent = progress.message || '이 캐릭터의 성장과 전리품은 현재 브라우저에 자동 저장돼요.';
        menuActions.hidden = false;
        content.prepend(menuActions);
        open('메뉴');
    };
    menuActions.addEventListener('click', event => {
        if ((event.target as Element).closest('button')) returnToGame();
    }, { capture: true });
    bag.onclick = () => {
        const saved = progress.read();
        menuActions.hidden = true;
        root.append(menuActions);
        content.replaceChildren();
        content.append(createInventory(saved, adventurerName(), bindings, commitProfile));
        open('가방');
    };
    const openShop = (merchant: Merchant) => {
        menuActions.hidden = true;
        root.append(menuActions);
        content.replaceChildren(createShop(merchant, () => progress.read(), commitProfile));
        open(merchant.name);
    };
    scene.events.on('open-shop', openShop);
    scene.events.once('shutdown', () => scene.events.off('open-shop', openShop));
    const shortcutFeedback = document.createElement('p');
    shortcutFeedback.className = 'hud-shortcut-feedback';
    shortcutFeedback.setAttribute('role', 'status');
    screen.append(shortcutFeedback);
    let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
    const activateSlot = (index: number) => {
        const id = bindings.read()[index];
        const button = footer.querySelector<HTMLElement>(`[data-consumable-slot="${index}"]`)!;
        button.classList.remove('quickslot-activated');
        void button.offsetWidth;
        button.classList.add('quickslot-activated');
        shortcutFeedback.textContent = id
            ? `${QUICKSLOT_KEYS[index]} · ${ITEMS[id].name}${progress.read().bag[id] > 0 ? ' 사용 효과는 아직 준비 중이에요.' : '이(가) 없어요.'}`
            : `${QUICKSLOT_KEYS[index]} · 등록된 아이템이 없어요.`;
        scene.events.emit('quickslot-use', { index, itemId: id });
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => { shortcutFeedback.textContent = ''; }, 2200);
    };
    footer.querySelectorAll<HTMLButtonElement>('[data-consumable-slot]').forEach(button => {
        button.onclick = () => { activateSlot(Number(button.dataset.consumableSlot)); focusGameCanvas(scene); };
    });
    function handleShortcut(event: KeyboardEvent): void {
        if (event.defaultPrevented || !scene.sys.isActive() || !root.isConnected || event.repeat || event.altKey || event.metaKey) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
        const code = event.code;
        const buttonId = code === 'KeyI' ? 'open-profile' : code === 'Escape' ? 'hud-open-menu' : null;
        if (buttonId) {
            event.preventDefault();
            const title = dialog.querySelector('h2')!.textContent;
            if (dialog.open && (code === 'Escape' || code === 'KeyI' && title === '가방')) returnToGame();
            else footer.querySelector<HTMLButtonElement>(`#${buttonId}`)!.click();
            return;
        }
        if (dialog.open) return;
        const index = QUICKSLOT_KEYS.findIndex(key => code === `Key${key}`);
        if (index >= 0) { event.preventDefault(); activateSlot(index); }
    }
    window.addEventListener('keydown', handleShortcut);
    const removeKeyboardGuard = installKeyboardGuard(scene, root);
    scene.events.once('shutdown', () => {
        window.removeEventListener('keydown', handleShortcut);
        clearTimeout(feedbackTimer);
    });
    const closeDialog = () => { if (dialog.open) dialog.close(); };
    scene.events.on('sleep', closeDialog);
    scene.events.once('shutdown', () => {
        closeDialog();
        scene.events.off('sleep', closeDialog);
        dialog.remove();
    });
}

export function hudDialogOpen(root: HTMLElement): boolean {
    return !!root.querySelector('.hud-dialog[open]');
}
