package com.mokdo.backend.auth;

import java.util.UUID;

import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

public class MokdoOidcUser extends DefaultOidcUser {
    private static final long serialVersionUID = 1L;
    private final UUID accountId;

    public MokdoOidcUser(UUID accountId, OidcUser googleUser) {
        super(googleUser.getAuthorities(), googleUser.getIdToken(), googleUser.getUserInfo());
        this.accountId = accountId;
    }

    public UUID getAccountId() {
        return accountId;
    }

    @Override
    public String getName() {
        return accountId.toString();
    }
}
