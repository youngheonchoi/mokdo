package com.mokdo.backend.controller;

import com.mokdo.backend.character.CostumeImageSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;

@RestController
public class CostumeImageController {
    private final JdbcTemplate jdbc;
    private final CostumeImageSource images;
    private final ObjectProvider<LocalAssetController> localAssets;

    public CostumeImageController(JdbcTemplate jdbc, CostumeImageSource images, ObjectProvider<LocalAssetController> localAssets) {
        this.jdbc = jdbc;
        this.images = images;
        this.localAssets = localAssets;
    }

    @GetMapping("/api/costumes/{code}/image")
    public ResponseEntity<?> image(@PathVariable String code) throws IOException {
        if (!code.matches("[a-z0-9][a-z0-9_-]{0,63}")) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var keys = jdbc.query("SELECT image_key FROM gm_costume WHERE appearance_code = ?", (rs, row) -> rs.getString("image_key"), code);
        if (keys.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (keys.getFirst() != null) {
            return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG)
                    .body(images.fetch(keys.getFirst()));
        }
        var local = localAssets.getIfAvailable();
        if (local == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return local.costume("common-character-01".equals(code) ? "common_character_01" : code);
    }
}
