import type { BattleEffect, BattleState } from '../battleTypes';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}
export function mountBattleOverlay(shell: HTMLElement) {
    const hud = el('section', 'battle-hud');
    hud.setAttribute('aria-label', '캐릭터 전투 상태');
    const hp = el('progress', 'battle-hp');
    hp.setAttribute('aria-label', '체력');
    const hpLabel = el('span', '');
    const exp = el('progress', 'battle-exp');
    exp.setAttribute('aria-label', '경험치');
    const expLabel = el('span', '');
    const currency = el('strong', 'battle-currency');
    const message = el('p', 'battle-message', '전투에 입장하고 있어요…');
    message.setAttribute('role', 'status');
    hud.append(hpLabel, hp, expLabel, exp, currency, message);
    const enemy = el('div', 'monster-label');
    enemy.hidden = true;
    const enemyName = el('strong', '');
    const enemyHp = el('progress', '');
    enemyHp.setAttribute('aria-label', '몬스터 체력');
    enemy.append(enemyName, enemyHp);
    const layer = el('div', 'battle-floats');
    layer.setAttribute('aria-hidden', 'true');
    shell.append(hud, enemy, layer);
    let state: BattleState | undefined;
    let serverOffset = 0;
    const floats: { node: HTMLElement; event: BattleEffect; born: number; row: number }[] = [];
    function apply(next: BattleState) {
        state = next;
        serverOffset = next.serverTime - Date.now();
        const c = next.character;
        const current = c.currentHp ?? c.maxHp ?? 0;
        hp.max = Math.max(1, c.maxHp ?? 1);
        hp.value = current;
        hpLabel.textContent = `체력 ${current.toLocaleString()} / ${(c.maxHp ?? 0).toLocaleString()}`;
        exp.max = Math.max(1, c.requiredExp ?? c.exp ?? 1);
        exp.value = c.exp ?? 0;
        expLabel.textContent = `경험치 ${(c.exp ?? 0).toLocaleString()}${c.requiredExp == null ? ' · 최고 설정 레벨' : ` / ${c.requiredExp.toLocaleString()}`}`;
        currency.textContent = `재화 ${(c.currency ?? 0).toLocaleString()}`;
        enemy.hidden = next.monster.hp <= 0;
        enemyName.textContent = `${next.monster.definition.name} · Lv.${next.monster.definition.level}`;
        enemyHp.max = next.monster.definition.maxHp;
        enemyHp.value = next.monster.hp;
        let row = 0;
        for (const event of next.effects) {
            let text: string;
            switch (event.kind) {
                case 'EXP': text = `+${event.amount.toLocaleString()} 경험치`; break;
                case 'CURRENCY': text = `+${event.amount.toLocaleString()} 재화`; break;
                case 'ITEM': text = `+${event.label} ×${event.amount.toLocaleString()}`; break;
                case 'LEVEL_UP': text = `레벨 UP! ${event.amount}`; break;
                case 'MONSTER_HIT': case 'PLAYER_HIT': text = `−${event.amount.toLocaleString()}`; break;
                case 'PLAYER_DIED': text = '쓰러졌어요'; break;
                case 'REVIVE': text = '부활'; break;
                default: continue;
            }
            const node = el('span', `battle-float battle-float-${event.kind.toLowerCase()}`, text);
            layer.append(node);
            floats.push({ node, event, born: performance.now(), row: row++ });
        }
    }
    function position(monsterX: number, monsterY: number, scrollX: number, scrollY: number, zoom: number) {
        const now = performance.now();
        enemy.style.left = `${(monsterX - scrollX) * zoom}px`;
        enemy.style.top = `${(monsterY - scrollY - 105) * zoom}px`;
        if (state) {
            const seconds = (at: number) => Math.max(0, Math.ceil((at - Date.now() - serverOffset) / 1000));
            hud.dataset.dead = String((state.character.currentHp ?? 1) === 0);
            if ((state.character.currentHp ?? 1) === 0) message.textContent = `${seconds(state.player.reviveAt ?? 0)}초 후 숲길 초입에서 부활해요.`;
        }
        for (let index = floats.length - 1; index >= 0; index--) {
            const value = floats[index];
            const age = now - value.born;
            if (age > 2000) { value.node.remove(); floats.splice(index, 1); continue; }
            value.node.style.left = `${(value.event.x - scrollX) * zoom}px`;
            value.node.style.top = `${(value.event.y - scrollY - 115) * zoom - value.row * 25 - age / 45}px`;
            value.node.style.opacity = String(Math.min(1, (2000 - age) / 500));
        }
    }
    return {
        apply, position,
        status: (text: string) => { message.textContent = text; hud.classList.toggle('connection-error', !!text); },
        dispose: () => { hud.remove(); enemy.remove(); layer.remove(); }
    };
}
