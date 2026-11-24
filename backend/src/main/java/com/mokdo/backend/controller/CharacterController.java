package com.mokdo.backend.controller;

import java.util.List;
import java.util.UUID;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.CharacterSummary;
import com.mokdo.backend.service.CharacterService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/characters")
public class CharacterController {
    private final CharacterService characters;

    public CharacterController(CharacterService characters) {
        this.characters = characters;
    }

    public record NameRequest(String name) {}
    public record DeleteRequest(String confirmationName) {}
    public record NameAvailability(boolean available) {}

    @GetMapping
    public List<CharacterSummary> list(@AuthenticationPrincipal MokdoOidcUser user) {
        return characters.findMine(user);
    }

    @GetMapping("/{characterId}")
    public CharacterSummary detail(@AuthenticationPrincipal MokdoOidcUser user, @PathVariable UUID characterId) {
        return characters.findMineById(user, characterId);
    }

    @PostMapping("/{characterId}/intro-completion")
    public CharacterSummary completeIntro(@AuthenticationPrincipal MokdoOidcUser user,
            @PathVariable UUID characterId) {
        return characters.completeIntro(user, characterId);
    }

    @GetMapping("/name-availability")
    public NameAvailability nameAvailability(@AuthenticationPrincipal MokdoOidcUser user,
            @RequestParam String name) {
        return new NameAvailability(characters.isNameAvailable(user, name));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CharacterSummary create(@AuthenticationPrincipal MokdoOidcUser user,
            @RequestBody NameRequest request) {
        return characters.create(user, request.name());
    }

    @DeleteMapping("/{characterId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal MokdoOidcUser user, @PathVariable UUID characterId,
            @RequestBody DeleteRequest request) {
        characters.delete(user, characterId, request.confirmationName());
    }
}
