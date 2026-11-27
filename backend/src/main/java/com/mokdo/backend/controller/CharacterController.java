package com.mokdo.backend.controller;

import java.util.List;
import java.util.UUID;

import com.mokdo.backend.auth.MemberOidcUser;
import com.mokdo.backend.character.CharacterService;
import com.mokdo.backend.character.CharacterService.CharacterResponse;
import com.mokdo.backend.character.CharacterService.CostumeResponse;
import com.mokdo.backend.character.ItemService;
import com.mokdo.backend.character.ItemService.InventoryItemResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class CharacterController {
    private final CharacterService characters;
    private final ItemService items;

    public CharacterController(CharacterService characters, ItemService items) {
        this.characters = characters;
        this.items = items;
    }

    @GetMapping("/api/characters")
    public ResponseEntity<List<CharacterResponse>> list(@AuthenticationPrincipal MemberOidcUser user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(characters.list(user.getMemberId()));
    }

    @GetMapping("/api/characters/nickname-check")
    public ResponseEntity<NicknameResponse> check(@RequestParam String nickname) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new NicknameResponse(characters.available(nickname)));
    }

    @PostMapping("/api/characters")
    public ResponseEntity<CharacterResponse> create(@AuthenticationPrincipal MemberOidcUser user,
            @RequestBody CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
                .body(characters.create(user.getMemberId(), request.slotNo(), request.nickname()));
    }

    @DeleteMapping("/api/characters/{characterId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal MemberOidcUser user,
            @PathVariable UUID characterId, @RequestBody DeleteRequest request) {
        characters.delete(user.getMemberId(), characterId, request.nickname());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/api/costumes")
    public ResponseEntity<List<CostumeResponse>> ownedCostumes(@AuthenticationPrincipal MemberOidcUser user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(characters.ownedCostumes(user.getMemberId()));
    }

    @PutMapping("/api/characters/{characterId}/costume")
    public ResponseEntity<Void> equipCostume(@AuthenticationPrincipal MemberOidcUser user,
            @PathVariable UUID characterId, @RequestBody EquipCostumeRequest request) {
        characters.equipCostume(user.getMemberId(), characterId, request.costumeId());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/api/characters/{characterId}/items")
    public ResponseEntity<List<InventoryItemResponse>> inventory(@AuthenticationPrincipal MemberOidcUser user,
            @PathVariable UUID characterId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(items.inventory(user.getMemberId(), characterId));
    }

    @PutMapping("/api/characters/{characterId}/weapon")
    public ResponseEntity<Void> equipWeapon(@AuthenticationPrincipal MemberOidcUser user,
            @PathVariable UUID characterId, @RequestBody EquipWeaponRequest request) {
        items.equipWeapon(user.getMemberId(), characterId, request.characterItemId());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> error(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).cacheControl(CacheControl.noStore())
                .body(new ErrorResponse(exception.getReason()));
    }

    @PutMapping("/api/characters/{characterId}/hat")
    public ResponseEntity<Void> equipHat(@AuthenticationPrincipal MemberOidcUser user,
            @PathVariable UUID characterId, @RequestBody EquipWeaponRequest request) {
        items.equipHat(user.getMemberId(), characterId, request.characterItemId());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }


    public record CreateRequest(int slotNo, String nickname) { }
    public record DeleteRequest(String nickname) { }
    public record EquipCostumeRequest(UUID costumeId) { }
    public record EquipWeaponRequest(UUID characterItemId) { }
    public record NicknameResponse(boolean available) { }
    public record ErrorResponse(String message) { }
}
