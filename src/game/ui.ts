import { ITEMS, type Bag, type ItemId } from './items';
import { Scene } from 'phaser';

export function mountUI(scene: Scene, html: string): HTMLElement {
    const layer = document.getElementById('game-ui')!;
    layer.innerHTML = html;
    scene.events.once('shutdown', () => layer.replaceChildren());
    return layer;
}

export const controls = `<div class="control-item"><span class="key wide">W A S D</span><span>이동</span></div>
    <div class="control-item"><span class="key">J</span><span>공격</span></div>
    <div class="control-item"><span class="key wide">SPACE</span><span>회피</span></div>`;

export const help = `<div class="modal-backdrop" id="help-panel" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <span class="eyebrow">ADVENTURER’S GUIDE</span><h2 id="help-title">작은 모험을 시작하는 법</h2>
    <p>방향키 또는 WASD로 이동하고, J 또는 필드 클릭으로 검을 휘두르세요. Space로 회피하고 K로 범위 공격을 사용하세요.</p>
    <div class="guide-row"><i class="guide-mark danger"></i><div><b>붉은 표식을 피하세요</b><p>직선과 원형 표식이 가득 차면 공격이 들어옵니다.</p></div></div>
    <div class="guide-row"><i class="guide-mark safe"></i><div><b>초록빛 안으로 모이세요</b><p>수호자의 체력이 절반이 되면 안전지대가 나타납니다. 회피만으로는 피할 수 없어요.</p></div></div>
    <p class="muted">몬스터를 잡아 레벨을 올리고 전리품을 모으세요. 바닥 전리품은 가까이 가면 자동으로 줍습니다. E로 주변을 회수할 수도 있어요.<br>공격은 가까이에서만 적중합니다. 회피 재사용 대기시간은 1.6초입니다.<br>Esc로 일시정지할 수 있습니다. 키보드와 마우스 플레이를 권장합니다.</p>
    <button class="button primary" id="close-help">확인했어요</button></section></div>`;

export function wireHelp(root: HTMLElement) {
    const panel = root.querySelector<HTMLElement>('#help-panel')!;
    const open = root.querySelector<HTMLButtonElement>('#open-help')!;
    const close = root.querySelector<HTMLButtonElement>('#close-help')!;
    open.onclick = () => { panel.hidden = false; close.focus(); };
    close.onclick = () => { panel.hidden = true; open.focus(); };
    panel.onkeydown = event => {
        if (event.key === 'Escape') close.click();
        if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
    };
}

export function timeLabel(seconds: number) {
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function lootSlots(bag: Bag) {
    return (Object.keys(ITEMS) as ItemId[]).map(id => `<div class="loot-slot" data-item="${id}"><span class="loot-icon" style="color:${ITEMS[id].color}">${ITEMS[id].icon}</span><div><span>${ITEMS[id].name}</span><small>${ITEMS[id].rarity}</small></div><b>${bag[id].toLocaleString()}</b></div>`).join('');
}
