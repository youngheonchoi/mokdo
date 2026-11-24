package com.mokdo.backend.serviceImpl;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.service.AccountLoginService;
import com.mokdo.backend.service.GoogleOidcUserService;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Service
public class GoogleOidcUserServiceImpl implements GoogleOidcUserService {
    private final OidcUserService delegate = new OidcUserService();
    private final AccountLoginService accounts;
    private final HttpServletRequest request;

    public GoogleOidcUserServiceImpl(AccountLoginService accounts, HttpServletRequest request) {
        this.accounts = accounts;
        this.request = request;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) {
        // Spring Security validates the OIDC ID token before invoking this service.
        OidcUser google = delegate.loadUser(userRequest);
        var accountId = accounts.login(google.getSubject(), google.getEmail(), request.getRemoteAddr());
        return new MokdoOidcUser(accountId, google);
    }
}
