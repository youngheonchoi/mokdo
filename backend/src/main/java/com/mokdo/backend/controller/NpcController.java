package com.mokdo.backend.controller;

import java.util.List;
import java.util.UUID;
import com.mokdo.backend.auth.MemberOidcUser;
import com.mokdo.backend.character.CostumeImageSource;
import com.mokdo.backend.npc.NpcShopService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class NpcController {
    private final NpcShopService shops;
    private final JdbcTemplate jdbc;
    private final CostumeImageSource images;
    public NpcController(NpcShopService shops, JdbcTemplate jdbc, CostumeImageSource images) {
        this.shops = shops; this.jdbc = jdbc; this.images = images;
    }
    @GetMapping("/api/npcs")
    public ResponseEntity<List<NpcShopService.Npc>> npcs() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(shops.npcs());
    }
    @GetMapping("/api/npcs/{npcId}/shop")
    public ResponseEntity<NpcShopService.Shop> shop(@PathVariable UUID npcId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(shops.shop(npcId));
    }
    @PostMapping("/api/characters/{characterId}/npcs/{npcId}/purchases")
    public ResponseEntity<NpcShopService.Purchase> purchase(@AuthenticationPrincipal MemberOidcUser user,
            @PathVariable UUID characterId, @PathVariable UUID npcId, @Valid @RequestBody PurchaseRequest body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
                shops.purchase(user.getMemberId(), characterId, npcId, body.shopItemId(), body.quantity(), body.unitPrice()));
    }
    @GetMapping("/api/npcs/{npcId}/image")
    public ResponseEntity<byte[]> image(@PathVariable UUID npcId) {
        var keys = jdbc.query("SELECT image_key FROM gm_npc WHERE npc_id = ? AND status = 'ACT'",
                (rs, row) -> rs.getString("image_key"), npcId);
        if (keys.isEmpty() || keys.getFirst() == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG).body(images.fetch(keys.getFirst()));
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<CharacterController.ErrorResponse> error(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).cacheControl(CacheControl.noStore())
                .body(new CharacterController.ErrorResponse(exception.getReason()));
    }
    public record PurchaseRequest(@NotNull UUID shopItemId, @Min(1) @Max(99) int quantity,
            @NotNull @Pattern(regexp = "0|[1-9][0-9]{0,18}") String unitPrice) { }
}
