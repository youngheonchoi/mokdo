package com.mokdo.backend.character;

import java.util.List;
import java.util.UUID;
import java.sql.ResultSet;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CharacterServiceTests {
    private JdbcTemplate jdbc;
    private CharacterService characters;
    private ItemService items;
    private final UUID memberId = UUID.randomUUID();
    private final UUID defaultCostumeId = UUID.fromString("10000000-0000-4000-8000-000000000001");

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        items = mock(ItemService.class);
        characters = new CharacterService(jdbc, items);
    }

    @Test
    void rejectsInvalidNicknameWithoutQueryingDatabase() {
        for (String nickname : List.of("", "가", "a", "abcdefghijklm", " 이름", "이 름", "이름 ", "name!", "😀😀", "ㄱㄴ")) {
            var exception = assertThrows(ResponseStatusException.class, () -> characters.available(nickname), nickname);
            assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        }
        assertThrows(ResponseStatusException.class, () -> characters.available(null));
        verifyNoInteractions(jdbc);
    }

    @Test
    void acceptsHangulEnglishAndNumbersAndNormalizesHangul() {
        assertEquals("모험가12", CharacterService.validateNickname("모험가12"));
        assertEquals("Adventurer12", CharacterService.validateNickname("Adventurer12"));
        assertEquals("가나", CharacterService.validateNickname("가나"));
    }

    @Test
    void checksCaseInsensitiveNicknameAvailability() {
        when(jdbc.queryForObject(contains("LOWER(nickname) = LOWER(?)"), eq(Boolean.class), eq("Hero")))
                .thenReturn(true);
        assertFalse(characters.available("Hero"));
    }

    @Test
    void rejectsSlotsOutsideThreeSlotsBeforeDatabaseAccess() {
        for (int slot : List.of(0, -1, 4, 100)) {
            var exception = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, slot, "모험가"));
            assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        }
        verifyNoInteractions(jdbc);
    }

    @Test
    void rejectsBannedMember() {
        stubMember("BAN");
        var exception = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, 1, "모험가"));
        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsOccupiedSlot() {
        stubMember("ACT");
        when(jdbc.query(contains("SELECT g.character_id"), any(RowMapper.class), eq(memberId)))
                .thenReturn(List.of(new CharacterService.CharacterResponse(UUID.randomUUID(), 2, "기존캐릭터", defaultCostumeId, "common-character-01", null, 1, 0, 100, 10, 2, null)));
        var exception = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, 2, "새캐릭터"));
        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rechecksDuplicateNicknameWhenCreating() {
        stubMember("ACT");
        when(jdbc.queryForObject(contains("LOWER(nickname)"), eq(Boolean.class), eq("모험가"))).thenReturn(true);
        var exception = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, 1, "모험가"));
        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void createsCharacterForAuthenticatedMemberAndRequestedSlot() {
        stubMember("ACT");
        var result = characters.create(memberId, 3, "모험가");
        assertEquals(3, result.slotNo());
        assertEquals("모험가", result.nickname());
        assertEquals(defaultCostumeId, result.equippedCostumeId());
        assertEquals("common-character-01", result.appearanceCode());
        assertEquals(1, result.level());
        assertEquals(0, result.exp());
        assertEquals(100, result.maxHp());
        assertEquals(10, result.attack());
        assertEquals(2, result.defense());
        var order = inOrder(jdbc);
        order.verify(jdbc).update(contains("INSERT INTO mb_member_costume"), any(UUID.class), eq(memberId), eq(defaultCostumeId));
        order.verify(jdbc).update(contains("INSERT INTO gm_character"), eq(result.characterId()), eq(memberId), eq(3), eq("모험가"), eq(defaultCostumeId));
        verify(items).grantDefaultWeapon(result.characterId());
    }

    @Test
    void characterUsesCurrentlySelectedDefaultInsteadOfLegacyCode() {
        stubMember("ACT");
        UUID selectedId = UUID.randomUUID();
        when(jdbc.query(contains("WHERE is_default = TRUE"), any(RowMapper.class)))
                .thenReturn(List.of(new CharacterService.CostumeResponse(selectedId, "새 기본", "new-default")));
        var result = characters.create(memberId, 1, "새캐릭터");
        assertEquals(selectedId, result.equippedCostumeId());
        assertEquals("new-default", result.appearanceCode());
        verify(jdbc).update(contains("INSERT INTO mb_member_costume"), any(UUID.class), eq(memberId), eq(selectedId));
    }

    @Test
    void missingDefaultPreventsCreation() {
        stubMember("ACT");
        when(jdbc.query(contains("WHERE is_default = TRUE"), any(RowMapper.class))).thenReturn(List.of());
        var exception = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, 1, "새캐릭터"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void returnsConflictWhenNicknameIsClaimedConcurrently() {
        stubMember("ACT");
        when(jdbc.update(contains("INSERT INTO gm_character"), any(UUID.class), eq(memberId), eq(1), eq("모험가"), eq(defaultCostumeId)))
                .thenThrow(new DuplicateKeyException("nickname race"));
        var exception = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, 1, "모험가"));
        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void deletesOnlyOwnedCharacterWithExactNickname() {
        UUID characterId = UUID.randomUUID();
        when(jdbc.query(contains("AND nickname = ? FOR UPDATE"), any(RowMapper.class),
                eq(characterId), eq(memberId), eq("Hero"))).thenReturn(List.of(characterId));
        characters.delete(memberId, characterId, "Hero");
        var order = inOrder(jdbc);
        order.verify(jdbc).update(contains("DELETE FROM gm_character_equipment"), eq(characterId));
        order.verify(jdbc).update(contains("DELETE FROM gm_character_item"), eq(characterId));
        order.verify(jdbc).update(contains("DELETE FROM gm_character WHERE"),
                eq(characterId), eq(memberId), eq("Hero"));
    }

    @Test
    void refusesDeletionWhenOwnerOrExactNicknameDoesNotMatch() {
        UUID characterId = UUID.randomUUID();
        for (String nickname : List.of("hero", "Hero ", " Hero")) {
            var exception = assertThrows(ResponseStatusException.class,
                    () -> characters.delete(memberId, characterId, nickname));
            assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
            verify(jdbc).query(contains("AND member_id = ? AND nickname = ?"), any(RowMapper.class),
                    eq(characterId), eq(memberId), eq(nickname));
        }
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsMissingDeletionNicknameBeforeDatabaseAccess() {
        for (String nickname : new String[] { null, "" }) {
            var exception = assertThrows(ResponseStatusException.class,
                    () -> characters.delete(memberId, UUID.randomUUID(), nickname));
            assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        }
        verifyNoInteractions(jdbc);
    }

    @Test
    void equipsOnlyOwnedCostumeOnOwnedCharacter() {
        UUID characterId = UUID.randomUUID();
        UUID costumeId = UUID.randomUUID();
        when(jdbc.update(contains("AND EXISTS"), eq(costumeId), eq(characterId),
                eq(memberId), eq(memberId), eq(costumeId))).thenReturn(1);
        characters.equipCostume(memberId, characterId, costumeId);
        verify(jdbc).update(contains("FROM mb_member_costume WHERE member_id = ? AND costume_id = ?"),
                eq(costumeId), eq(characterId), eq(memberId), eq(memberId), eq(costumeId));
    }

    @Test
    void rejectsUnownedCostumeOrAnotherMembersCharacter() {
        var exception = assertThrows(ResponseStatusException.class,
                () -> characters.equipCostume(memberId, UUID.randomUUID(), UUID.randomUUID()));
        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void switchesBackToOwnedDefaultCostume() {
        UUID characterId = UUID.randomUUID();
        when(jdbc.update(contains("AND EXISTS"), eq(defaultCostumeId), eq(characterId),
                eq(memberId), eq(memberId), eq(defaultCostumeId))).thenReturn(1);
        characters.equipCostume(memberId, characterId, defaultCostumeId);
        verify(jdbc).update(contains("AND EXISTS"), eq(defaultCostumeId), eq(characterId),
                eq(memberId), eq(memberId), eq(defaultCostumeId));
    }

    @Test
    void refusesNullCostumeWithoutDatabaseAccess() {
        var exception = assertThrows(ResponseStatusException.class,
                () -> characters.equipCostume(memberId, UUID.randomUUID(), null));
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        verifyNoInteractions(jdbc);
    }

    @Test
    void listsCostumesForAuthenticatedOwner() {
        characters.ownedCostumes(memberId);
        verify(jdbc).query(contains("WHERE mc.member_id = ?"), any(RowMapper.class), eq(memberId));
    }

    @Test
    void characterListMapsEquippedCostumeAndResolvedAppearance() throws Exception {
        UUID characterId = UUID.randomUUID();
        UUID costumeId = UUID.randomUUID();
        ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("character_id", UUID.class)).thenReturn(characterId);
        when(rs.getInt("slot_no")).thenReturn(1);
        when(rs.getString("nickname")).thenReturn("모험가");
        when(rs.getObject("equipped_costume_id", UUID.class)).thenReturn(costumeId);
        when(rs.getString("appearance_code")).thenReturn("forest-ranger");
        when(rs.getInt("level")).thenReturn(3);
        when(rs.getLong("exp")).thenReturn(50L);
        when(rs.getInt("max_hp")).thenReturn(120);
        when(rs.getInt("attack")).thenReturn(14);
        when(rs.getInt("defense")).thenReturn(4);
        when(rs.getObject("required_exp", Long.class)).thenReturn(300L);
        when(jdbc.query(contains("JOIN gm_costume"), any(RowMapper.class), eq(memberId)))
                .thenAnswer(invocation -> {
                    RowMapper<CharacterService.CharacterResponse> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(rs, 0));
                });
        var character = characters.list(memberId).getFirst();
        assertEquals(costumeId, character.equippedCostumeId());
        assertEquals("forest-ranger", character.appearanceCode());
        assertEquals(characterId, character.characterId());
        assertNull(character.weapon());
        assertEquals(3, character.level());
        assertEquals(50L, character.exp());
        assertEquals(120, character.maxHp());
        assertEquals(14, character.attack());
        assertEquals(4, character.defense());
        assertEquals(300L, character.requiredExp());
        UUID characterItemId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        when(rs.getObject("weapon_character_item_id", UUID.class)).thenReturn(characterItemId);
        when(rs.getObject("weapon_item_id", UUID.class)).thenReturn(itemId);
        when(rs.getString("weapon_item_code")).thenReturn("wooden-club");
        when(rs.getString("weapon_name")).thenReturn("몽둥이");
        when(rs.getString("weapon_appearance_code")).thenReturn("wooden-club");
        var weapon = characters.list(memberId).getFirst().weapon();
        assertEquals(characterItemId, weapon.characterItemId());
        assertEquals(itemId, weapon.itemId());
        assertEquals("몽둥이", weapon.name());
        assertEquals("wooden-club", weapon.appearanceCode());
    }

    @Test
    void refusesCreationWhenInitialLevelSettingsAreMissing() {
        stubMember("ACT");
        when(jdbc.query(contains("FROM gm_character_level WHERE level = 1"), any(RowMapper.class))).thenReturn(List.of());
        var error = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, 1, "모험가"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        verify(jdbc, never()).update(contains("INSERT INTO gm_character"), any(Object[].class));
        verifyNoInteractions(items);
    }

    private void stubMember(String status) {
        when(jdbc.query(contains("FROM gm_character_level WHERE level = 1"), any(RowMapper.class)))
                .thenReturn(List.of(new CharacterService.LevelStats(100, 10, 2, null)));
        when(jdbc.query(contains("FOR UPDATE"), any(RowMapper.class), eq(memberId))).thenReturn(List.of(status));
        when(jdbc.query(contains("WHERE is_default = TRUE"), any(RowMapper.class)))
                .thenReturn(List.of(new CharacterService.CostumeResponse(defaultCostumeId, "기본 코스튬", "common-character-01")));
    }
}
