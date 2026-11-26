package com.mokdo.backend.auth;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, GoogleOidcUserService users,
            GoogleAuthorizationRequestResolver authorizationRequests,
            @Value("${spring.security.oauth2.client.registration.google.redirect-uri}") String redirectUri,
            @Value("${app.frontend-url}") String frontendUrl) throws Exception {
        String frontend = frontendUrl.replaceAll("/+$", "");
        String callbackPath = URI.create(redirectUri).getPath();

        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/health", "/oauth2/authorization/google", callbackPath, "/error")
                        .permitAll()
                        .anyRequest().authenticated())
                .requestCache(cache -> cache.disable())
                .exceptionHandling(errors -> errors.authenticationEntryPoint(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .oauth2Login(oauth -> oauth
                        .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(authorizationRequests))
                        .redirectionEndpoint(endpoint -> endpoint.baseUri(callbackPath))
                        .userInfoEndpoint(info -> info.oidcUserService(users))
                        .defaultSuccessUrl(frontend + "/characters", true)
                        .failureUrl(frontend + "/?login=failed"));

        return http.build();
    }
}
