package com.mokdo.backend.controller;

import java.util.UUID;

import com.mokdo.backend.auth.MemberOidcUser;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {
    @GetMapping("/api/auth/csrf")
    public ResponseEntity<CsrfResponse> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new CsrfResponse(token.getHeaderName(), token.getToken()));
    }

    public record CsrfResponse(String headerName, String token) { }

    @GetMapping("/api/auth/session")
    public ResponseEntity<SessionResponse> session(@AuthenticationPrincipal MemberOidcUser user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new SessionResponse(user.getMemberId()));
    }

    public record SessionResponse(UUID memberId) { }
}
