export const monsterBehavior = {
    aggroRange: 260,
    speed: 85,
    home: { x: 800, y: 560 }
} as const;

export type MonsterMotion = { x: number; y: number; returning: boolean };

export function moveMonster(current: MonsterMotion, playerX: number, playerY: number, seconds: number): MonsterMotion {
    const { home, aggroRange, speed } = monsterBehavior;
    const dx = playerX - current.x, dy = playerY - current.y;
    const distance = Math.hypot(dx, dy / .6);
    const homeDistance = Math.hypot(home.x - current.x, (home.y - current.y) / .6);
    const returning = current.returning || (distance > aggroRange && homeDistance > .001);
    if (returning) {
        const step = Math.min(speed * Math.max(0, seconds), homeDistance);
        if (homeDistance <= step || homeDistance <= .001) return { ...home, returning: false };
        return { x: current.x + (home.x - current.x) / homeDistance * step,
            y: current.y + (home.y - current.y) / homeDistance * step, returning: true };
    }
    if (distance > 0 && distance <= aggroRange && (Math.abs(dx) > 48 || Math.abs(dy) > 28)) {
        const step = Math.min(speed * Math.max(0, seconds), distance);
        return { x: current.x + dx / distance * step, y: current.y + dy / distance * step, returning: false };
    }
    return { ...current, returning: false };
}
