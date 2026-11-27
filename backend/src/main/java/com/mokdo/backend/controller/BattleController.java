package com.mokdo.backend.controller;

import com.mokdo.backend.auth.MemberOidcUser;
import com.mokdo.backend.battle.BattleService;
import com.mokdo.backend.character.CostumeImageSource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;

@RestController
public class BattleController {
    private final BattleService battles;
    private final JdbcTemplate jdbc;
    private final CostumeImageSource images;
    public BattleController(BattleService battles,JdbcTemplate jdbc,CostumeImageSource images) {this.battles=battles;this.jdbc=jdbc;this.images=images;}
    @PostMapping("/api/characters/{id}/battle")
    public ResponseEntity<BattleService.State> enter(@AuthenticationPrincipal MemberOidcUser user,@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(battles.enter(user.getMemberId(),id));
    }
    @PostMapping("/api/characters/{id}/battle/tick")
    public ResponseEntity<BattleService.State> tick(@AuthenticationPrincipal MemberOidcUser user,@PathVariable UUID id,@RequestBody BattleService.Command command) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(battles.tick(user.getMemberId(),id,command));
    }
    @GetMapping("/api/monsters/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable UUID id) {
        var rows=jdbc.query("SELECT image_key FROM gm_monster WHERE monster_id=? AND status='ACT'",(rs,row)->rs.getString(1),id);
        if(rows.isEmpty() || rows.getFirst()==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"몬스터 이미지를 등록해 주세요.");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG).body(images.fetch(rows.getFirst()));
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<CharacterController.ErrorResponse> error(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).cacheControl(CacheControl.noStore()).body(new CharacterController.ErrorResponse(e.getReason()));
    }
}
