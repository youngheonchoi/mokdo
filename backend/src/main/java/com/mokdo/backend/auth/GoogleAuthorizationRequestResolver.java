package com.mokdo.backend.auth;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

@Component
public class GoogleAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {
    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    public GoogleAuthorizationRequestResolver(ClientRegistrationRepository registrations) {
        delegate = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return customize(delegate.resolve(request), request);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
        return customize(delegate.resolve(request, registrationId), request);
    }

    private OAuth2AuthorizationRequest customize(OAuth2AuthorizationRequest authorization,
            HttpServletRequest request) {
        if (authorization == null || !"1".equals(request.getParameter("auto"))) {
            return authorization;
        }
        // Google returns an error rather than showing account/consent UI if silent login is unavailable.
        return OAuth2AuthorizationRequest.from(authorization)
                .additionalParameters(parameters -> parameters.put("prompt", "none"))
                .build();
    }
}
