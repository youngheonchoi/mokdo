package com.mokdo.backend.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@ConditionalOnProperty(name = "app.assets.path")
public class LocalAssetController {
    private final Path root;

    public LocalAssetController(@Value("${app.assets.path}") String assetPath) {
        this.root = Path.of(assetPath).toAbsolutePath().normalize();
    }

    @GetMapping("/asset-files/characters/costumes/{code}.png")
    public ResponseEntity<Resource> costume(@PathVariable String code) throws IOException {
        return image("characters/costumes", code);
    }

    @GetMapping("/asset-files/weapons/{code}.png")
    public ResponseEntity<Resource> weapon(@PathVariable String code) throws IOException {
        return image("weapons", code);
    }

    private ResponseEntity<Resource> image(String directory, String code) throws IOException {
        if (!code.matches("[a-z0-9][a-z0-9_-]{0,63}")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        Path file = root.resolve(directory).resolve(code + ".png");
        if (!Files.isRegularFile(file) || !file.toRealPath().startsWith(root.toRealPath())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.IMAGE_PNG)
                .body(new FileSystemResource(file.toRealPath()));
    }
}
