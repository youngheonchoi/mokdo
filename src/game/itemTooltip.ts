import { ITEMS, itemDetails, type ItemId } from './items';

/** Delegation covers inventory, equipment, shop and quickslot content after rerenders. */
export function mountItemTooltip(root: HTMLElement): { hide: () => void; destroy: () => void } {
    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    tooltip.id = 'game-item-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('popover', 'manual');
    let active: HTMLElement | null = null;
    let activeItem: string | undefined;
    let previousDescription: string | null = null;
    const hide = () => {
        if (tooltip.matches(':popover-open')) tooltip.hidePopover();
        if (active) {
            if (previousDescription === null) active.removeAttribute('aria-describedby');
            else active.setAttribute('aria-describedby', previousDescription);
        }
        active = null;
        activeItem = undefined;
    };
    const position = (x: number, y: number) => {
        const rect = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(x + 14, window.innerWidth - rect.width - 8))}px`;
        tooltip.style.top = `${Math.max(8, y + rect.height + 20 > window.innerHeight ? y - rect.height - 12 : y + 14)}px`;
    };
    const show = (target: HTMLElement, x: number, y: number) => {
        const id = target.dataset.itemId;
        if (!id || !Object.prototype.hasOwnProperty.call(ITEMS, id)) return;
        hide();
        active = target;
        activeItem = id;
        previousDescription = target.getAttribute('aria-describedby');
        target.setAttribute('aria-describedby', tooltip.id);
        target.removeAttribute('title');
        const details = itemDetails(id as ItemId);
        const name = document.createElement('strong'); name.textContent = details.name;
        const fields = document.createElement('dl');
        for (const field of details.fields) {
            const label = document.createElement('dt'); label.textContent = field.label;
            const value = document.createElement('dd'); value.textContent = field.value;
            fields.append(label, value);
        }
        tooltip.replaceChildren(name, fields);
        (target.closest('dialog') ?? root).append(tooltip);
        tooltip.showPopover();
        position(x, y);
    };
    const find = (event: Event) => (event.target as Element).closest<HTMLElement>('[data-item-id]');
    const over = (event: PointerEvent) => { const target = find(event); if (target && target !== active) show(target, event.clientX, event.clientY); };
    const move = (event: PointerEvent) => { if (active) position(event.clientX, event.clientY); };
    const out = (event: PointerEvent) => { if (active && !active.contains(event.relatedTarget as Node | null)) hide(); };
    const focus = (event: FocusEvent) => { const target = find(event); if (target) { const rect = target.getBoundingClientRect(); show(target, rect.right, rect.top); } };
    const blur = (event: FocusEvent) => { if (active && !active.contains(event.relatedTarget as Node | null)) hide(); };
    const observer = new MutationObserver(() => { if (active && (!active.isConnected || active.dataset.itemId !== activeItem)) hide(); });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-item-id'] });
    root.addEventListener('pointerover', over);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerout', out);
    root.addEventListener('focusin', focus);
    root.addEventListener('focusout', blur);
    root.addEventListener('dragstart', hide);
    root.addEventListener('scroll', hide, true);
    root.addEventListener('close', hide, true);
    return { hide, destroy: () => {
        observer.disconnect();
        hide(); tooltip.remove();
        root.removeEventListener('pointerover', over);
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerout', out);
        root.removeEventListener('focusin', focus);
        root.removeEventListener('focusout', blur);
        root.removeEventListener('dragstart', hide);
        root.removeEventListener('scroll', hide, true);
        root.removeEventListener('close', hide, true);
    } };
}
