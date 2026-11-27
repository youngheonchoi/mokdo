package com.mokdo.backend.auth;

import java.sql.SQLException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class GoogleLoginFailureHandlerTests {
    private final GoogleLoginFailureHandler handler = new GoogleLoginFailureHandler("http://localhost:8080/");

    @Test
    void logsOAuthCodeWithoutSensitiveDetailsAndKeepsFailureRedirect(CapturedOutput output) throws Exception {
        var request = new MockHttpServletRequest();
        request.setParameter("code", "secret-authorization-code");
        var response = new MockHttpServletResponse();
        var error = new OAuth2AuthenticationException(new OAuth2Error("invalid_client"), "secret-client-description");
        handler.onAuthenticationFailure(request, response, error);
        assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:8080/?login=failed");
        assertThat(output.getOut()).contains("Google login failed: code=invalid_client")
                .doesNotContain("secret-authorization-code", "secret-client-description");
    }

    @Test
    void logsDatabaseSqlStateWithoutSqlOrPersonalData(CapturedOutput output) throws Exception {
        var error = new OAuth2AuthenticationException(new OAuth2Error("member_storage_error"),
                new SQLException("secret-query-and-google-subject", "42P01"));
        handler.onAuthenticationFailure(new MockHttpServletRequest(), new MockHttpServletResponse(), error);
        assertThat(output.getOut()).contains("code=member_storage_error", "sqlState=42P01")
                .doesNotContain("secret-query-and-google-subject");
    }
}
