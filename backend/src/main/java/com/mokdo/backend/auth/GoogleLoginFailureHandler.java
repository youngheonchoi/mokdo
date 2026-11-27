package com.mokdo.backend.auth;

import java.io.IOException;
import java.sql.SQLException;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

@Component
public class GoogleLoginFailureHandler implements AuthenticationFailureHandler {
    private static final Logger log = LoggerFactory.getLogger(GoogleLoginFailureHandler.class);
    private final SimpleUrlAuthenticationFailureHandler delegate;

    public GoogleLoginFailureHandler(@Value("${app.frontend-url}") String frontendUrl) {
        delegate = new SimpleUrlAuthenticationFailureHandler(frontendUrl.replaceAll("/+$", "") + "/?login=failed");
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        String code = exception instanceof OAuth2AuthenticationException oauth
                ? oauth.getError().getErrorCode() : "authentication_failed";
        if (code == null || !code.matches("[a-zA-Z0-9_-]{1,80}")) code = "authentication_failed";
        Throwable cause = exception;
        String sqlState = "none";
        for (int depth = 0; depth < 20; depth++) {
            if (cause instanceof SQLException sql) sqlState = sql.getSQLState();
            if (cause.getCause() == null || cause.getCause() == cause) break;
            cause = cause.getCause();
        }
        // Exception messages and request parameters can contain codes, tokens or personal data.
        log.warn("Google login failed: code={}, cause={}, sqlState={}", code, cause.getClass().getSimpleName(), sqlState);
        delegate.onAuthenticationFailure(request, response, exception);
    }
}
