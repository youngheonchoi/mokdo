package com.mokdo.backend.controller;

import com.mokdo.backend.character.CostumeImageSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.util.UUID;

@RestController
public class ItemImageController {
    private final JdbcTemplate jdbc;
    private final CostumeImageSource images;
    private final ObjectProvider<LocalAssetController> local;
    public ItemImageController(JdbcTemplate jdbc, CostumeImageSource images, ObjectProvider<LocalAssetController> local) {
        this.jdbc = jdbc; this.images = images; this.local = local;
    }
    @GetMapping("/api/items/{id}/image")
    public ResponseEntity<?> image(@PathVariable UUID id) throws IOException {
        var rows = jdbc.query("SELECT image_key, appearance_code, item_type FROM gm_item WHERE item_id = ?",
                (rs, row) -> new Image(rs.getString("image_key"), rs.getString("appearance_code"), rs.getString("item_type")), id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var image = rows.getFirst();
        if (image.key() != null) return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.IMAGE_PNG).body(images.fetch(image.key()));
        var files = local.getIfAvailable();
        if (files == null || !"WEAPON".equals(image.type()) || image.code() == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return files.weapon(image.code());
    }
    private record Image(String key, String code, String type) { }
}
