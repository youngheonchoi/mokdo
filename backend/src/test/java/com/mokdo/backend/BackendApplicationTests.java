package com.mokdo.backend;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.mokdo.backend.auth.MemberOidcUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("local")
@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
                + "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration",
        "spring.security.oauth2.client.registration.google.client-id=test-client",
        "spring.security.oauth2.client.registration.google.client-secret=test-secret",
        "spring.security.oauth2.client.registration.google.redirect-uri=http://localhost:8081/login/oauth2/code/google",
        "app.frontend-url=http://localhost:8080"
})
class BackendApplicationTests {
    @Autowired
    private WebApplicationContext context;

    @MockitoBean
    private JdbcTemplate jdbc;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void sessionRequiresLoginWithoutRedirectingToGoogle() throws Exception {
        mvc.perform(get("/api/auth/session"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist("Location"));
    }

    @Test
    void healthRemainsPublic() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }

    @Test
    void loginStartsGoogleOidcWithStateAndConfiguredCallback() throws Exception {
        mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", startsWith("https://accounts.google.com/")))
                .andExpect(header().string("Location", containsString("state=")))
                .andExpect(header().string("Location", containsString("nonce=")))
                .andExpect(header().string("Location", containsString("scope=openid")))
                .andExpect(header().string("Location", not(containsString("prompt=none"))))
                .andExpect(header().string("Location", containsString(
                        "redirect_uri=http://localhost:8081/login/oauth2/code/google")));
    }

    @Test
    void automaticLoginRequestsGoogleWithoutAccountOrConsentUi() throws Exception {
        mvc.perform(get("/oauth2/authorization/google").param("auto", "1"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", containsString("prompt=none")))
                .andExpect(header().string("Location", containsString("state=")))
                .andExpect(header().string("Location", containsString("nonce=")));
    }

    @Test
    void callbackWithoutAuthorizationRequestReturnsToLoginWithError() throws Exception {
        mvc.perform(get("/login/oauth2/code/google").param("code", "fake-code").param("state", "invalid"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("http://localhost:8080/?login=failed"));
    }

    @Test
    void googleCancellationReturnsToLoginWithError() throws Exception {
        MockHttpSession session = new MockHttpSession();
        String location = mvc.perform(get("/oauth2/authorization/google").session(session))
                .andReturn().getResponse().getRedirectedUrl();
        String state = org.springframework.web.util.UriComponentsBuilder.fromUriString(location)
                .build().getQueryParams().getFirst("state");
        mvc.perform(get("/login/oauth2/code/google").session(session)
                        .param("error", "access_denied").param("state", state))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("http://localhost:8080/?login=failed"));
        mvc.perform(get("/api/auth/session").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedSessionReturnsInternalMemberIdWithoutTokens() throws Exception {
        UUID memberId = UUID.randomUUID();
        OidcIdToken token = OidcIdToken.withTokenValue("test-id-token")
                .subject("google-subject").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                .build();
        MemberOidcUser user = new MemberOidcUser(new DefaultOidcUser(
                List.of(new SimpleGrantedAuthority("ROLE_USER")), token), memberId);
        mvc.perform(get("/api/auth/session").with(oidcLogin().oidcUser(user)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("{\"memberId\":\"" + memberId + "\"}",
                        org.springframework.test.json.JsonCompareMode.STRICT));
    }
}
