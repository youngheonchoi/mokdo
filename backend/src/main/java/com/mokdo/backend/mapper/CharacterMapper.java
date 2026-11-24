package com.mokdo.backend.mapper;

import java.time.OffsetDateTime;
import java.util.List;
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
                FROM game_character WHERE account_id = ? ORDER BY slot_no
                """, (rs, row) -> new CharacterSummary(rs.getObject("id", UUID.class),
                rs.getInt("slot_no"), rs.getString("name"), rs.getString("appearance_code"),
                rs.getObject("intro_completed_at", OffsetDateTime.class)), accountId);
    }
}
