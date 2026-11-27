package com.mokdo.backend.controller;

import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;

@RestController
public class SpriteMetadataController {
    private final JdbcTemplate jdbc;
    public SpriteMetadataController(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @GetMapping("/api/costumes/{code}/sprite")
    public ResponseEntity<String> costume(@PathVariable String code) {
        if (!code.matches("[a-z0-9][a-z0-9_-]{0,63}")) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return read("SELECT sprite_json FROM gm_costume WHERE appearance_code = ?", code);
    }
    @GetMapping("/api/monsters/{id}/sprite")
    public ResponseEntity<String> monster(@PathVariable UUID id) {
        return read("SELECT sprite_json FROM gm_monster WHERE monster_id = ? AND status = 'ACT'", id);
    }
    private ResponseEntity<String> read(String sql, Object value) {
        var rows = jdbc.query(sql, (rs, n) -> rs.getString(1), value);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_JSON)
                .body(rows.getFirst() == null ? "null" : rows.getFirst());
    }
}
