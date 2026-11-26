package com.mokdo.backend.character;

import java.util.List;
import java.util.UUID;

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
    private final UUID memberId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        characters = new CharacterService(jdbc);
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
        when(jdbc.query(contains("SELECT character_id"), any(RowMapper.class), eq(memberId)))
                .thenReturn(List.of(new CharacterService.CharacterResponse(UUID.randomUUID(), 2, "기존캐릭터")));
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
        verify(jdbc).update(contains("INSERT INTO gm_character"), eq(result.characterId()), eq(memberId), eq(3), eq("모험가"));
    }

    @Test
    void returnsConflictWhenNicknameIsClaimedConcurrently() {
        stubMember("ACT");
        when(jdbc.update(contains("INSERT INTO gm_character"), any(UUID.class), eq(memberId), eq(1), eq("모험가")))
                .thenThrow(new DuplicateKeyException("nickname race"));
        var exception = assertThrows(ResponseStatusException.class, () -> characters.create(memberId, 1, "모험가"));
        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void deletesOnlyOwnedCharacterWithExactNickname() {
        UUID characterId = UUID.randomUUID();
        when(jdbc.update(contains("DELETE FROM gm_character"), eq(characterId), eq(memberId), eq("Hero")))
                .thenReturn(1);
        characters.delete(memberId, characterId, "Hero");
        verify(jdbc).update(contains("WHERE character_id = ? AND member_id = ? AND nickname = ?"),
                eq(characterId), eq(memberId), eq("Hero"));
    }

    @Test
    void refusesDeletionWhenOwnerOrExactNicknameDoesNotMatch() {
        UUID characterId = UUID.randomUUID();
        for (String nickname : List.of("hero", "Hero ", " Hero")) {
            var exception = assertThrows(ResponseStatusException.class,
                    () -> characters.delete(memberId, characterId, nickname));
            assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
            verify(jdbc).update(contains("AND member_id = ? AND nickname = ?"),
                    eq(characterId), eq(memberId), eq(nickname));
        }
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

    private void stubMember(String status) {
        when(jdbc.query(contains("FOR UPDATE"), any(RowMapper.class), eq(memberId))).thenReturn(List.of(status));
    }
}
