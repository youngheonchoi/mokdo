package com.mokdo.backend.auth;

import java.util.UUID;

import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

public class MemberOidcUser extends DefaultOidcUser {
    private static final long serialVersionUID = 1L;
    private final UUID memberId;

    public MemberOidcUser(OidcUser user, UUID memberId) {
        super(user.getAuthorities(), user.getIdToken(), user.getUserInfo());
        this.memberId = memberId;
    }

    public UUID getMemberId() {
        return memberId;
    }
}
