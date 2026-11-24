import { BOSS_POSITION, type WorldMap } from './maps';
import { CAVE_ENTRANCE, FIELD_RETURN, TOWN_PORTAL } from './navigation';
import { ITEMS, type Bag, type ItemId } from './items';
import { Scene } from 'phaser';

export function mountUI(scene: Scene, html: string): HTMLElement {
    const layer = document.getElementById('game-ui')!;
    const root = document.createElement('div');
    root.className = 'scene-ui';
    root.innerHTML = html;
    layer.replaceChildren(root);
    const sleep = () => root.remove();
    const wake = () => layer.replaceChildren(root);
    scene.events.on('sleep', sleep);
    scene.events.on('wake', wake);
    scene.events.once('shutdown', () => {
        root.remove();
        scene.events.off('sleep', sleep);
        scene.events.off('wake', wake);
    });
    return root;
}

export const controls = `<div class="control-item"><span class="key wide">W A S D</span><span>이동</span></div>
    <div class="control-item"><span class="key">F</span><span>상호작용</span></div>
    <div class="control-item"><span class="key">J</span><span>공격</span></div>
    <div class="control-item"><span class="key wide">SPACE</span><span>회피</span></div>`;

export const help = `<div class="modal-backdrop" id="help-panel" hidden><section class="modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <span class="eyebrow">ADVENTURER’S GUIDE</span><h2 id="help-title">작은 모험을 시작하는 법</h2>
    <p>마을 포탈과 사냥터 동굴에 가까이 가서 F로 상호작용하세요. 동굴 대기실에서 준비 후 보스방에 입장합니다.<br>방향키 또는 WASD로 이동하고, J 또는 필드 클릭으로 검을 휘두르세요. Space로 회피하고 K로 범위 공격을 사용하세요.</p>
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

export function routeTrail(current: 'town' | 'field' | 'lobby' | 'boss') {
    return `<nav class="route-trail" aria-label="모험 이동 경로">${([['town', '마을'], ['field', '사냥터'], ['lobby', '동굴 대기실'], ['boss', '보스 던전']] as const).map(([id, label], i) => `${i ? '<span class="route-divider">/</span>' : ''}<span class="${id === current ? 'current' : ''}" ${id === current ? 'aria-current="step"' : ''}>${label}</span>`).join('')}</nav>`;
}

export function miniMap(map: WorldMap) {
    const markers = map.key === 'town' ? [TOWN_PORTAL] : map.key === 'field' ? [FIELD_RETURN, CAVE_ENTRANCE] : [BOSS_POSITION];
    const radius = map.width / 80;
    const floors = map.rooms ?? [map.bounds];
    return `<aside class="mini-map" aria-label="현재 지역 미니맵"><div><span>${map.key === 'town' ? '이끼 마을' : map.key === 'field' ? '이슬 맺힌 숲길' : '수호자의 지하길'}</span><span>N</span></div><svg viewBox="0 0 ${map.width} ${map.height}" role="img" aria-label="지도와 현재 위치">${floors.map(room => `<rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.height}" fill="#42644a" stroke="#94ad77" stroke-width="12"/>`).join('')}${markers.map(point => `<circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="#dbc78f"/>`).join('')}<rect id="mini-viewport" width="1280" height="800" fill="none" stroke="#dbedbc" stroke-opacity="0.55" stroke-width="12"/><circle id="mini-player-ring" r="${radius * 1.65}" fill="none" stroke="#e1f1ca" stroke-width="10"/><circle id="mini-player" r="${radius}" fill="#c9f5dc"/></svg><small>초록: 나 · 금색: 목적지</small></aside>`;
}
export function updateMiniMap(root: HTMLElement, point: { x: number; y: number }, camera?: { scrollX: number; scrollY: number }) {
    if (camera) {
        root.querySelector('#mini-viewport')?.setAttribute('x', String(camera.scrollX));
        root.querySelector('#mini-viewport')?.setAttribute('y', String(camera.scrollY));
    }
    for (const id of ['mini-player', 'mini-player-ring']) {
        root.querySelector(`#${id}`)?.setAttribute('cx', String(point.x));
        root.querySelector(`#${id}`)?.setAttribute('cy', String(point.y));
    }
}
