type FullscreenDocument = Document & {
    webkitFullscreenElement?: Element;
    webkitFullscreenEnabled?: boolean;
    webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function mountFullscreenButton(shell: HTMLElement, actions: HTMLElement) {
    const doc = document as FullscreenDocument;
    const target = shell as FullscreenElement;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-fullscreen';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    svg.append(path); button.append(svg);
    const message = document.createElement('span');
    message.className = 'game-fullscreen-message';
    message.setAttribute('role', 'status');
    message.hidden = true;
    actions.prepend(button); actions.append(message);
    const current = () => doc.fullscreenElement ?? doc.webkitFullscreenElement;
    const standard = Boolean(doc.fullscreenEnabled && target.requestFullscreen);
    const supported = standard || Boolean(doc.webkitFullscreenEnabled && target.webkitRequestFullscreen);
    let disposed = false;
    let pending = false;
    const exit = () => doc.fullscreenElement ? doc.exitFullscreen() : doc.webkitExitFullscreen?.();
    const sync = () => {
        const active = current() === shell;
        const label = !supported ? '전체화면 지원 안 됨' : active ? '전체화면 종료' : '전체화면';
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', String(active));
        button.title = supported ? label : '이 브라우저에서는 전체화면을 지원하지 않습니다.';
        button.disabled = pending || !supported;
        path.setAttribute('d', active
            ? 'M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6'
            : 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6');
    };
    button.onclick = async () => {
        if (pending || !supported) return;
        message.hidden = true;
        pending = true; sync();
        try {
            if (current() === shell) await exit();
            else if (standard) await target.requestFullscreen();
            else await target.webkitRequestFullscreen?.();
            if (disposed && current() === shell) await exit();
        } catch {
            if (!disposed) {
                message.textContent = '전체화면을 전환하지 못했어요. 다시 눌러주세요.';
                message.hidden = false;
            }
        } finally {
            pending = false;
            if (!disposed) { sync(); button.blur(); }
        }
    };
    doc.addEventListener('fullscreenchange', sync);
    doc.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
        disposed = true;
        doc.removeEventListener('fullscreenchange', sync);
        doc.removeEventListener('webkitfullscreenchange', sync);
        button.onclick = null;
        button.remove(); message.remove();
        if (current() === shell) void Promise.resolve(exit()).catch(() => {});
    };
}
