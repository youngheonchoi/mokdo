package com.mokdo.backend.controller;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LocalAssetControllerTests {
    @TempDir
    Path directory;
    private Path root;
    private MockMvc mvc;
    private final byte[] png = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=");

    @BeforeEach
    void setUp() throws Exception {
        root = Files.createDirectory(directory.resolve("assets"));
        Files.createDirectories(root.resolve("characters/costumes"));
        Files.createDirectories(root.resolve("weapons"));
        mvc = MockMvcBuilders.standaloneSetup(new LocalAssetController(root.toString())).build();
    }

    @Test
    void servesCostumeAddedAfterStartupWithoutCaching() throws Exception {
        String url = "/asset-files/characters/costumes/forest-ranger.png";
        mvc.perform(get(url)).andExpect(status().isNotFound());
        Files.write(root.resolve("characters/costumes/forest-ranger.png"), png);
        mvc.perform(get(url)).andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().bytes(png));
        Files.delete(root.resolve("characters/costumes/forest-ranger.png"));
        mvc.perform(get(url)).andExpect(status().isNotFound());
    }

    @Test
    void servesWeaponFromSameConfiguredRoot() throws Exception {
        Files.write(root.resolve("weapons/wooden-club.png"), png);
        mvc.perform(get("/asset-files/weapons/wooden-club.png"))
                .andExpect(status().isOk()).andExpect(content().bytes(png));
    }

    @Test
    void doesNotExposeOtherFilesOrDirectories() throws Exception {
        Files.writeString(root.resolve("private.txt"), "private");
        for (String url : new String[] { "/asset-files/private.txt", "/asset-files/characters/costumes/",
                "/asset-files/weapons/private.txt", "/asset-files/weapons/Invalid.png",
                "/asset-files/weapons/..private.png" }) {
            mvc.perform(get(url)).andExpect(status().isNotFound());
        }
    }

    @Test
    void rejectsSymlinksOutsideAssetRoot() throws Exception {
        Path outside = Files.write(directory.resolve("outside.png"), png);
        Files.createSymbolicLink(root.resolve("weapons/outside.png"), outside);
        mvc.perform(get("/asset-files/weapons/outside.png")).andExpect(status().isNotFound());
    }

    @Test
    void missingAssetRootReturnsNotFound() throws Exception {
        MockMvc missing = MockMvcBuilders.standaloneSetup(
                new LocalAssetController(directory.resolve("missing").toString())).build();
        missing.perform(get("/asset-files/weapons/club.png")).andExpect(status().isNotFound());
    }
}
