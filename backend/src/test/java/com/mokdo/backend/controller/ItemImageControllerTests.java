package com.mokdo.backend.controller;

import com.mokdo.backend.character.CostumeImageSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import java.sql.ResultSet;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ItemImageControllerTests {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CostumeImageSource source = mock(CostumeImageSource.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<LocalAssetController> local = mock(ObjectProvider.class);
    private final ItemImageController controller = new ItemImageController(jdbc, source, local);
    private final UUID id = UUID.randomUUID();

    private void item(String key, String type, String code) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getString("image_key")).thenReturn(key);
        when(row.getString("item_type")).thenReturn(type);
        when(row.getString("appearance_code")).thenReturn(code);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(id)))
                .thenAnswer(call -> List.of(((RowMapper<?>) call.getArgument(1)).mapRow(row, 0)));
    }
    @Test void fetchesUploadedItemImageByStableId() throws Exception {
        String key = "items/" + id + "/" + UUID.randomUUID() + ".png";
        item(key, "WEAPON", "wooden-club");
        byte[] bytes = {1, 2, 3};
        when(source.fetch(key)).thenReturn(bytes);
        var response = controller.image(id);
        assertThat(response.getBody()).isEqualTo(bytes);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(response.getHeaders().getContentType().toString()).isEqualTo("image/png");
        verifyNoInteractions(local);
    }
    @Test void keepsExistingLocalWeaponUntilAnImageIsUploaded() throws Exception {
        item(null, "WEAPON", "wooden-club");
        var files = mock(LocalAssetController.class);
        when(local.getIfAvailable()).thenReturn(files);
        controller.image(id);
        verify(files).weapon("wooden-club");
        verifyNoInteractions(source);
    }
    @Test void returnsNotFoundForUnknownOrMissingGeneralItemImage() throws Exception {
        assertThatThrownBy(() -> controller.image(id)).isInstanceOf(ResponseStatusException.class);
        item(null, "CONSUMABLE", "potion");
        assertThatThrownBy(() -> controller.image(id)).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(source);
    }
}
