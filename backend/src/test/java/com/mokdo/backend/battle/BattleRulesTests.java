package com.mokdo.backend.battle;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static com.mokdo.backend.battle.BattleRules.*;
class BattleRulesTests {
    @Test void growsAcrossSeveralConfiguredLevelsAndKeepsRemainder() {
        assertEquals(new Growth(3,55),grow(1,5,350,List.of(new Level(1,100),new Level(2,200),new Level(3,0))));
    }
    @Test void highestLevelKeepsExperienceWithoutInventingLevelsOrOverflow() {
        assertEquals(new Growth(1,Long.MAX_VALUE),grow(1,20,Long.MAX_VALUE,List.of(new Level(1,0))));
        assertEquals(new Growth(1,500),grow(1,0,500,List.of(new Level(1,100),new Level(3,0))));
        assertEquals(Long.MAX_VALUE,addCapped(5,Long.MAX_VALUE));
    }
    @Test void attacksUseFacingAndFloorLaneAndAlwaysDealAtLeastOneDamage() {
        assertTrue(inRange(100,500,200,530,"east"));
        assertFalse(inRange(100,500,200,530,"west"));
        assertFalse(inRange(100,500,200,540,"east"));
        assertFalse(inRange(100,500,220,500,"east"));
        assertEquals(1,damage(0,100));
        assertEquals(7,damage(10,3));
    }
    @Test void smallerAggroRadiusAndReturnHomeDoNotHealOrTeleport() {
        assertEquals(new MonsterMotion(800,560,false),moveMonster(800,560,false,400,560,1));
        var chasing=moveMonster(800,560,false,600,560,1);
        assertEquals(715,chasing.x());assertFalse(chasing.returning());
        var returning=moveMonster(600,500,false,100,500,.5);
        assertTrue(returning.returning());assertTrue(returning.x()>600);assertTrue(returning.x()<800);
        assertTrue(returning.y()>500);
    }
    @Test void returningMonsterReachesHomeBeforeReacquiringEvenIfPlayerComesNear() {
        var returning=moveMonster(700,560,true,690,560,.5);
        assertTrue(returning.returning());assertEquals(742.5,returning.x());
        var home=moveMonster(799,560,true,700,560,1);
        assertEquals(new MonsterMotion(800,560,false),home);
        assertTrue(moveMonster(home.x(),home.y(),home.returning(),600,560,.1).x()<800);
    }
}
