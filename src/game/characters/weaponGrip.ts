export type WeaponGrip = { originX: number; originY: number; axisAngle: number };

// Assets point upward (or diagonally upward), with the handle at the bottom.
// Read the opaque pixels so both vertical and diagonal PNGs pivot at the handle.
export function inferWeaponGrip(source: CanvasImageSource, width: number, height: number): WeaponGrip {
    const fallback = { originX: .5, originY: .85, axisAngle: -Math.PI / 2 };
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return fallback;
        context.drawImage(source, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let top = height, bottom = -1;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (pixels[(y * width + x) * 4 + 3] > 32) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
        }
        if (bottom <= top) return fallback;
        const span = bottom - top;
        let gripX = 0, gripY = 0, gripCount = 0, tipX = 0, tipY = 0, tipCount = 0;
        for (let y = top; y <= bottom; y++) for (let x = 0; x < width; x++) {
            if (pixels[(y * width + x) * 4 + 3] <= 32) continue;
            if (y >= bottom - span * .2 && y <= bottom - span * .05) { gripX += x + .5; gripY += y + .5; gripCount++; }
            if (y <= top + span * .15) { tipX += x + .5; tipY += y + .5; tipCount++; }
        }
        if (!gripCount || !tipCount) return fallback;
        gripX /= gripCount; gripY /= gripCount; tipX /= tipCount; tipY /= tipCount;
        return { originX: gripX / width, originY: gripY / height, axisAngle: Math.atan2(tipY - gripY, tipX - gripX) };
    } catch { return fallback; }
}

export function weaponPose(time: number, facing: 'east' | 'west', progress: number, jumpY: number, walking: boolean) {
    const sign = facing === 'east' ? 1 : -1;
    let angle = -Math.PI * .31;
    let reach = 0, lift = 0, lean = 0;
    if (progress >= 0 && progress < 1) {
        if (progress < .18) {
            const t = progress / .18;
            angle += (-Math.PI * .75 - angle) * t;
            reach = -5 * t; lift = -6 * t; lean = -2 * t;
        } else if (progress < .42) {
            const t = 1 - (1 - (progress - .18) / .24) ** 2;
            angle = -Math.PI * .75 + Math.PI * 1.05 * t;
            reach = -5 + 15 * t; lift = -6 + 9 * t; lean = -2 + 6 * t;
        } else {
            const t = (progress - .42) / .58;
            angle = Math.PI * .3 + (-Math.PI * .31 - Math.PI * .3) * t;
            reach = 10 * (1 - t); lift = 3 * (1 - t); lean = 4 * (1 - t);
        }
    }
    const bob = walking ? Math.sin(time / 80) : 0;
    return { x: sign * (34 + reach), y: jumpY - 23 + lift + bob,
        angle: facing === 'east' ? angle : Math.PI - angle, lean: lean * sign };
}
