package com.mokdo.backend.controller;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.AccountDto;
import com.mokdo.backend.service.CurrentAccountService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AccountController {
    private final CurrentAccountService currentAccount;

    public AccountController(CurrentAccountService currentAccount) {
        this.currentAccount = currentAccount;
    }

    @GetMapping("/api/me")
    public AccountDto me(@AuthenticationPrincipal MokdoOidcUser user) {
        return currentAccount.requireActive(user);
    }

    public record CsrfResponse(String headerName, String token) {}

    @GetMapping("/api/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }
}
