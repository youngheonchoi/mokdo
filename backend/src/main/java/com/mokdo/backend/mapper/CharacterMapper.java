package com.mokdo.backend.mapper;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mokdo.backend.dto.CharacterSummary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CharacterMapper {
    private final JdbcTemplate jdbc;

    public CharacterMapper(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CharacterSummary> findByAccountId(UUID accountId) {
        return jdbc.query("""
                SELECT id, slot_no, name, appearance_code, intro_completed_at
                FROM game_character WHERE account_id = ? AND status = 'ACTIVE' ORDER BY slot_no
                """, (rs, row) -> new CharacterSummary(rs.getObject("id", UUID.class),
                rs.getInt("slot_no"), rs.getString("name"), rs.getString("appearance_code"),
                rs.getObject("intro_completed_at", OffsetDateTime.class)), accountId);
    }

    public boolean lockActiveAccount(UUID accountId) {
        return !jdbc.query("SELECT id FROM account WHERE id = ? AND status = 'ACTIVE' FOR UPDATE",
                (rs, row) -> rs.getObject("id", UUID.class), accountId).isEmpty();
    }

    public boolean activeNameExists(String name) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM game_character
                WHERE status = 'ACTIVE' AND LOWER(BTRIM(name)) = LOWER(?))
                """, Boolean.class, name));
    }

    public void insert(UUID id, UUID accountId, int slotNo, String name) {
        jdbc.update("""
                INSERT INTO game_character (id, account_id, slot_no, name, appearance_code)
                VALUES (?, ?, ?, ?, 'STICK_FIGURE')
                """, id, accountId, slotNo, name);
    }

    public Optional<CharacterSummary> findActiveOwned(UUID id, UUID accountId) {
        return jdbc.query("""
                SELECT id, slot_no, name, appearance_code, intro_completed_at
                FROM game_character WHERE id = ? AND account_id = ? AND status = 'ACTIVE'
                """, (rs, row) -> new CharacterSummary(rs.getObject("id", UUID.class),
                rs.getInt("slot_no"), rs.getString("name"), rs.getString("appearance_code"),
                rs.getObject("intro_completed_at", OffsetDateTime.class)), id, accountId)
                .stream().findFirst();
    }

    public int markDeleted(UUID id, UUID accountId, String confirmationName) {
        return jdbc.update("""
                UPDATE game_character SET status = 'DELETED', updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND account_id = ? AND status = 'ACTIVE' AND name = ?
                """, id, accountId, confirmationName);
    }

    public void completeIntro(UUID id, UUID accountId) {
        jdbc.update("""
                UPDATE game_character
                SET intro_completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND account_id = ? AND status = 'ACTIVE' AND intro_completed_at IS NULL
                """, id, accountId);
    }
}
