package com.mokdo.backend.auth;

import com.mokdo.backend.service.GoogleOidcUserService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.savedrequest.NullRequestCache;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, GoogleOidcUserService googleUsers,
            @Value("${mokdo.frontend-url}") String frontendUrl) throws Exception {
        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/health", "/oauth2/**", "/login/**", "/error").permitAll()
                        .anyRequest().authenticated())
                .requestCache(cache -> cache.requestCache(new NullRequestCache()))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(info -> info.oidcUserService(googleUsers))
                        .defaultSuccessUrl(frontendUrl, true)
                        .failureUrl(frontendUrl + "?auth=failed"))
                .logout(logout -> logout
                        .logoutUrl("/api/logout")
                        .invalidateHttpSession(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)));
        // Keep the default session CSRF protection. /api/csrf returns the masked token.
        return http.build();
    }
}
