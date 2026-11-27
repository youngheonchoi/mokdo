package com.mokdo.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SpriteMetadataControllerTests {
    @Test void returnsNoStoreMetadataAndLegacyNull() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var api = new SpriteMetadataController(jdbc);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("slime"))).thenReturn(List.of("{\"version\":1}"));
        var response = api.costume("slime");
        assertThat(response.getBody()).isEqualTo("{\"version\":1}");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        UUID id = UUID.randomUUID();
        when(jdbc.query(anyString(), any(RowMapper.class), eq(id))).thenReturn(Collections.singletonList(null));
        assertThat(api.monster(id).getBody()).isEqualTo("null");
    }
    @Test void missingDefinitionsAndInvalidCostumeCodesReturnNotFound() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var api = new SpriteMetadataController(jdbc);
        assertThatThrownBy(() -> api.costume("../bad")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(jdbc);
        when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class))).thenReturn(List.of());
        assertThatThrownBy(() -> api.monster(UUID.randomUUID())).isInstanceOf(ResponseStatusException.class);
    }
}
