import { ITEMS, type ItemId } from './items';
import { canSell, trade, type Merchant, type TradeMode } from './commerce';
import type { Profile } from './progression';

export function createShop(merchant: Merchant, read: () => Profile, commit: (profile: Profile) => string): HTMLElement {
    const root = document.createElement('section');
    root.className = 'shop-view';
    root.innerHTML = '<div class="shop-summary"><p></p><span>보유 골드 <strong></strong></span></div><div class="shop-tabs" role="tablist" aria-label="거래 종류"><button type="button" role="tab" id="shop-buy-tab" aria-controls="shop-panel">구매</button><button type="button" role="tab" id="shop-sell-tab" aria-controls="shop-panel">판매</button></div><div class="shop-list" id="shop-panel" role="tabpanel" tabindex="0"></div><p class="shop-feedback" role="status"></p>';
    root.querySelector('.shop-summary p')!.textContent = merchant.general ? '체력 물약 구매 · 기타·소모품 판매' : '장비 구매 · 해당 부위 장비 판매';
    const list = root.querySelector('.shop-list')!;
    const feedback = root.querySelector('.shop-feedback')!;
    let mode: TradeMode = 'buy';
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const render = () => {
        const profile = read();
        root.querySelector('.shop-summary strong')!.textContent = profile.bag.gold.toLocaleString();
        tabs.forEach((tab, index) => { const selected = (index === 0) === (mode === 'buy'); tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
        list.setAttribute('aria-labelledby', mode === 'buy' ? 'shop-buy-tab' : 'shop-sell-tab');
        list.replaceChildren();
        const ids = mode === 'buy' ? merchant.stock : (Object.keys(ITEMS) as ItemId[]).filter(id => profile.bag[id] > 0 && canSell(merchant, id));
        if (!ids.length) { const empty = document.createElement('p'); empty.className = 'shop-empty'; empty.textContent = '판매할 아이템이 없어요.'; list.append(empty); }
        for (const id of ids) {
            const item = ITEMS[id];
            const price = mode === 'buy' ? item.buyPrice : item.sellPrice;
            const row = document.createElement('div'); row.className = 'shop-row'; row.dataset.shopItem = id; row.dataset.itemId = id; row.tabIndex = 0;
            const icon = document.createElement('span'); icon.className = 'shop-icon'; icon.textContent = item.icon; icon.style.color = item.color;
            const description = document.createElement('div'); description.className = 'shop-description';
            const name = document.createElement('strong'); name.textContent = item.name;
            const details = document.createElement('span'); details.textContent = `${price.toLocaleString()} 골드 / 개 · 보유 ${profile.bag[id].toLocaleString()}개`;
            description.append(name, details);
            const quantity = document.createElement('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = String(mode === 'buy' ? 9999 : Math.min(9999, profile.bag[id])); quantity.step = '1'; quantity.value = '1'; quantity.setAttribute('aria-label', `${item.name} 수량`);
            const button = document.createElement('button'); button.type = 'button'; button.className = 'shop-trade-button'; button.setAttribute('aria-label', `${item.name} ${mode === 'buy' ? '구매' : '판매'}`);
            const updatePrice = () => { const count = Number(quantity.value); button.textContent = `${mode === 'buy' ? '구매' : '판매'} · ${(price * (Number.isSafeInteger(count) && count > 0 ? count : 0)).toLocaleString()}`; };
            quantity.oninput = updatePrice; updatePrice();
            button.onclick = () => {
                const result = trade(read(), merchant.id, mode, id, Number(quantity.value));
                let warning = '';
                if (result.profile) { warning = commit(result.profile); render(); }
                feedback.textContent = [result.message, warning].filter(Boolean).join(' ');
            };
            row.append(icon, description, quantity, button); list.append(row);
        }
    };
    tabs.forEach((tab, index) => {
        tab.onclick = () => { mode = index === 0 ? 'buy' : 'sell'; feedback.textContent = ''; render(); };
        tab.onkeydown = event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
            tabs[next].click(); tabs[next].focus();
        };
    });
    render();
    return root;
}
