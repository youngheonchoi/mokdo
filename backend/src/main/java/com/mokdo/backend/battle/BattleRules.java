package com.mokdo.backend.battle;

import java.math.BigInteger;
import java.util.List;

public final class BattleRules {
    private BattleRules() { }
    public static final double MONSTER_AGGRO_RANGE = 260;
    public record MonsterMotion(double x, double y, boolean returning) { }
    public static MonsterMotion moveMonster(double x, double y, boolean returning, double playerX, double playerY, double seconds) {
        double dx = playerX - x, dy = playerY - y;
        double distance = Math.hypot(dx, dy / .6);
        double homeDistance = Math.hypot(800 - x, (560 - y) / .6);
        returning = returning || (distance > MONSTER_AGGRO_RANGE && homeDistance > .001);
        if (returning) {
            double step = Math.min(85 * Math.max(0, seconds), homeDistance);
            if (homeDistance <= step || homeDistance <= .001) return new MonsterMotion(800, 560, false);
            return new MonsterMotion(x + (800 - x) / homeDistance * step, y + (560 - y) / homeDistance * step, true);
        }
        if (distance > 0 && distance <= MONSTER_AGGRO_RANGE && (Math.abs(dx) > 48 || Math.abs(dy) > 28)) {
            double step = Math.min(85 * Math.max(0, seconds), distance);
            return new MonsterMotion(x + dx / distance * step, y + dy / distance * step, false);
        }
        return new MonsterMotion(x, y, false);
    }
    public static long damage(long attack, long defense) { return Math.max(1, attack - defense); }
    public static boolean inRange(double px, double py, double mx, double my, String facing) {
        double forward = (mx - px) * ("west".equals(facing) ? -1 : 1);
        return forward >= -18 && forward <= 110 && Math.abs(my - py) <= 38;
    }
    public static double clamp(double value, double min, double max) { return Math.max(min, Math.min(max, value)); }
    public static long addCapped(long value, long amount) { return value > Long.MAX_VALUE - amount ? Long.MAX_VALUE : value + amount; }
    public record Level(int level, long requiredExp) { }
    public record Growth(int level, long exp) { }
    // A zero threshold represents the highest configured level. Never invent levels.
    public static Growth grow(int level, long exp, long reward, List<Level> levels) {
        BigInteger remaining = BigInteger.valueOf(exp).add(BigInteger.valueOf(reward));
        for (int index = 0; index < levels.size(); index++) {
            Level current = levels.get(index);
            if (current.level() != level || current.requiredExp() <= 0 || index + 1 >= levels.size()) continue;
            if (levels.get(index + 1).level() != level + 1 || remaining.compareTo(BigInteger.valueOf(current.requiredExp())) < 0) break;
            remaining = remaining.subtract(BigInteger.valueOf(current.requiredExp()));
            level++;
        }
        return new Growth(level, remaining.min(BigInteger.valueOf(Long.MAX_VALUE)).longValueExact());
    }
}
