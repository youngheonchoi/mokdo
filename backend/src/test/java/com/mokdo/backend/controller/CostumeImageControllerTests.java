package com.mokdo.backend.controller;

import com.mokdo.backend.character.CostumeImageSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import java.util.Arrays;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CostumeImageControllerTests {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CostumeImageSource images = mock(CostumeImageSource.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<LocalAssetController> local = mock(ObjectProvider.class);
    private final CostumeImageController controller = new CostumeImageController(jdbc, images, local);

    @Test
    void resolvesUploadedImageByCodeWithoutExposingStorageCredentials() throws Exception {
        String key = "costumes/10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002.png";
        when(jdbc.query(anyString(), any(RowMapper.class), eq("forest-ranger"))).thenReturn(List.of(key));
        byte[] bytes = {1, 2, 3};
        when(images.fetch(key)).thenReturn(bytes);
        var response = controller.image("forest-ranger");
        assertThat(response.getBody()).isEqualTo(bytes);
        assertThat(response.getHeaders().getContentType().toString()).isEqualTo("image/png");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    void supportsExistingLocalDefaultUntilImageIsUploaded() throws Exception {
        when(jdbc.query(anyString(), any(RowMapper.class), eq("common-character-01"))).thenReturn(Arrays.asList((String) null));
        var files = mock(LocalAssetController.class);
        when(local.getIfAvailable()).thenReturn(files);
        controller.image("common-character-01");
        verify(files).costume("common_character_01");
        verifyNoInteractions(images);
    }

    @Test
    void rejectsUnknownCodeAndUnsafePath() {
        assertThatThrownBy(() -> controller.image("unknown")).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> controller.image("../secret")).isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(images);
    }
}
