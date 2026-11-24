/** Temporary model drawn as SVG so the thick strokes stay crisp at any size. */
export function stickFigure(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 160 200');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '굵은 선으로 그린 임시 캐릭터');
    svg.classList.add('stick-figure');
    const head = document.createElementNS(ns, 'circle');
    head.setAttribute('cx', '80');
    head.setAttribute('cy', '40');
    head.setAttribute('r', '24');
    const body = document.createElementNS(ns, 'path');
    body.setAttribute('d', 'M80 64 V120 M80 82 L38 110 M80 82 L122 110 M80 120 L45 174 M80 120 L115 174');
    svg.append(head, body);
    return svg;
}
