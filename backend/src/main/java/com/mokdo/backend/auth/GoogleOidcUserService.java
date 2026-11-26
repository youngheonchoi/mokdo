package com.mokdo.backend.auth;

import org.springframework.dao.DataAccessException;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Service
public class GoogleOidcUserService extends OidcUserService {
    private final GoogleMemberService members;

    public GoogleOidcUserService(GoogleMemberService members) {
        this.members = members;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest request) {
        OidcUser user = super.loadUser(request);
        try {
            return new MemberOidcUser(user, members.login(user.getSubject()));
        } catch (DataAccessException exception) {
            throw new OAuth2AuthenticationException(new OAuth2Error("member_storage_error"), exception);
        }
    }
}
