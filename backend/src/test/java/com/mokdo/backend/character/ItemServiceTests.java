package com.mokdo.backend.character;

import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ItemServiceTests {
    private JdbcTemplate jdbc;
    private ItemService items;
    private final UUID memberId = UUID.randomUUID();
    private final UUID characterId = UUID.randomUUID();
    private final UUID characterItemId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        items = new ItemService(jdbc);
    }

    @Test
    void grantsAndEquipsDefaultWeaponAsSeparateOwnedInstance() {
        UUID itemId = UUID.randomUUID();
        when(jdbc.query(contains("SELECT item_id, item_code"), any(RowMapper.class), eq("wooden-club")))
                .thenReturn(List.of(new ItemService.WeaponResponse(null, itemId, "wooden-club", "몽둥이", "wooden-club", 0, 0, 0)));
        var result = items.grantDefaultWeapon(characterId);
        assertNotNull(result.characterItemId());
        assertEquals(itemId, result.itemId());
        assertEquals("wooden-club", result.appearanceCode());
        var order = inOrder(jdbc);
        order.verify(jdbc).update(contains("INSERT INTO gm_character_item"), eq(result.characterItemId()), eq(characterId), eq(itemId));
        order.verify(jdbc).update(contains("ON CONFLICT (character_id, slot_code)"), any(UUID.class), eq(characterId), eq(result.characterItemId()));
    }

    @Test
    void failsCreationWhenDefaultWeaponDefinitionIsMissing() {
        var error = assertThrows(ResponseStatusException.class, () -> items.grantDefaultWeapon(characterId));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, error.getStatusCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsEquipmentChangesOnAnotherMembersCharacter() {
        for (UUID id : new UUID[] { characterItemId, null }) {
            var error = assertThrows(ResponseStatusException.class, () -> items.equipWeapon(memberId, characterId, id));
            assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
        }
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsUnownedInactiveStackedOrNonWeaponItem() {
        ownCharacter();
        var error = assertThrows(ResponseStatusException.class, () -> items.equipWeapon(memberId, characterId, characterItemId));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(jdbc).query(contains("ci.quantity = 1"), any(RowMapper.class), eq(characterItemId), eq(characterId));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void equipsOwnedWeaponAndReplacesSameSlot() {
        ownCharacter();
        when(jdbc.query(contains("SELECT ci.character_item_id"), any(RowMapper.class), eq(characterItemId), eq(characterId)))
                .thenReturn(List.of(characterItemId));
        items.equipWeapon(memberId, characterId, characterItemId);
        verify(jdbc).update(contains("DO UPDATE SET character_item_id = EXCLUDED.character_item_id"),
                any(UUID.class), eq(characterId), eq(characterItemId));
    }

    @Test
    void unequipsWithoutDeletingOwnedWeapon() {
        ownCharacter();
        items.equipWeapon(memberId, characterId, null);
        verify(jdbc).update(contains("DELETE FROM gm_character_equipment"), eq(characterId));
        verify(jdbc, never()).update(contains("DELETE FROM gm_character_item"), any(UUID.class));
    }

    @Test
    void inventoryUsesAuthenticatedMemberAndMapsEquippedFlag() throws Exception {
        ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("character_item_id", UUID.class)).thenReturn(characterItemId);
        when(rs.getObject("item_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getString("item_code")).thenReturn("wooden-club");
        when(rs.getString("name")).thenReturn("몽둥이");
        when(rs.getString("item_type")).thenReturn("WEAPON");
        when(rs.getString("appearance_code")).thenReturn("wooden-club");
        when(rs.getInt("quantity")).thenReturn(1);
        when(rs.getInt("required_level")).thenReturn(10);
        when(rs.getBoolean("equipped")).thenReturn(true);
        when(jdbc.query(contains("WHERE g.member_id = ? AND g.character_id = ?"), any(RowMapper.class), eq(memberId), eq(characterId)))
                .thenAnswer(invocation -> {
                    RowMapper<ItemService.InventoryItemResponse> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(rs, 0));
                });
        var item = items.inventory(memberId, characterId).getFirst();
        assertTrue(item.equipped());
        assertEquals(characterItemId, item.characterItemId());
        assertEquals("몽둥이", item.name());
        assertEquals(10, item.requiredLevel());
    }

    private void ownCharacter() {
        when(jdbc.query(contains("FROM gm_character WHERE"), any(RowMapper.class), eq(characterId), eq(memberId)))
                .thenReturn(List.of(characterId));
    }
}
