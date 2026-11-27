package com.mokdo.backend.controller;

import com.mokdo.backend.battle.BattleService;
import com.mokdo.backend.character.CostumeImageSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BattleControllerTests {
    @Test void monsterImageUsesAuthenticatedEndpointAndStoredKey() {
        var jdbc=mock(JdbcTemplate.class);
        var images=mock(CostumeImageSource.class);
        var controller=new BattleController(mock(BattleService.class),jdbc,images);
        UUID id=UUID.randomUUID();String key="monsters/"+id+"/"+UUID.randomUUID()+".png";
        when(jdbc.query(anyString(),any(RowMapper.class),eq(id))).thenReturn(List.of(key));
        when(images.fetch(key)).thenReturn(new byte[]{1,2,3});
        var response=controller.image(id);
        assertArrayEquals(new byte[]{1,2,3},response.getBody());
        assertEquals("image/png",response.getHeaders().getContentType().toString());
        assertEquals("no-store",response.getHeaders().getCacheControl());
        verify(images).fetch(key);
        when(jdbc.query(anyString(),any(RowMapper.class),eq(id))).thenReturn(Collections.singletonList(null));
        assertThrows(ResponseStatusException.class,()->controller.image(id));
    }
}
