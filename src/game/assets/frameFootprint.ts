export type FrameFootprint = { centerX: number; bottom: number };

// Coordinates are relative to the frame, excluding transparent PNG padding.
export function frameFootprint(source: CanvasImageSource, frame: { cutX: number; cutY: number; cutWidth: number; cutHeight: number }): FrameFootprint {
    const fallback = { centerX: frame.cutWidth / 2, bottom: frame.cutHeight };
    try {
        const canvas = document.createElement('canvas');
        canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return fallback;
        context.drawImage(source, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width, right = -1, bottom = -1;
        for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] <= 32) continue;
            left = Math.min(left, x); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        return bottom < 0 ? fallback : { centerX: (left + right + 1) / 2, bottom: bottom + 1 };
    } catch { return fallback; }
}
