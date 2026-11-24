package com.mokdo.backend;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.mokdo.backend.service.AccountLoginService;
import com.mokdo.backend.mapper.AccountMapper;
import com.mokdo.backend.auth.MokdoOidcUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.security.oauth2.client.registration.google.client-id=test-client",
        "spring.security.oauth2.client.registration.google.client-secret=test-secret",
        "mokdo.frontend-url=http://localhost:8080"
})
@Testcontainers
class BackendApplicationTests {
    // A disposable database: never run these tests against the developer's database.
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired WebApplicationContext context;
    @Autowired AccountLoginService accounts;
    @Autowired AccountMapper mapper;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;

    @BeforeEach
    void prepare() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        jdbc.execute("TRUNCATE TABLE account CASCADE");
    }

    @Test
    void firstLoginCreatesAccountAndIdentityButNoCharacter() {
        UUID id = accounts.login("google-sub", "player@example.com", "127.0.0.1");
        assertThat(mapper.findByGoogleSubject("google-sub").orElseThrow().id()).isEqualTo(id);
        assertThat(jdbc.queryForObject("SELECT email FROM account_identity", String.class))
                .isEqualTo("player@example.com");
        assertThat(jdbc.queryForObject("SELECT host(create_ip) FROM account", String.class))
                .isEqualTo("127.0.0.1");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM game_character", Integer.class)).isZero();
    }

    @Test
    void repeatedLoginUsesSubjectAndDoesNotMergeByEmail() {
        UUID first = accounts.login("subject-one", "shared@example.com", "::1");
        assertThat(accounts.login("subject-one", "changed@example.com", "::1")).isEqualTo(first);
        assertThat(accounts.login("subject-two", "shared@example.com", "::1")).isNotEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account", Integer.class)).isEqualTo(2);
    }

    @Test
    void concurrentFirstLoginsProduceOneAccountWithoutOrphans() throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(8)) {
            var results = java.util.stream.IntStream.range(0, 8).mapToObj(index -> executor.submit(() -> {
                start.await();
                return accounts.login("concurrent-sub", "player@example.com", "127.0.0.1");
            })).toList();
            start.countDown();
            UUID first = results.getFirst().get(20, TimeUnit.SECONDS);
            for (var result : results) assertThat(result.get(20, TimeUnit.SECONDS)).isEqualTo(first);
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_identity", Integer.class)).isEqualTo(1);
    }

    @Test
    void failedIdentityInsertRollsBackAccountInsert() {
        accounts.login("duplicate-sub", null, "127.0.0.1");
        assertThatThrownBy(() -> transactions.execute(status -> {
            UUID accountId = UUID.randomUUID();
            mapper.insertAccount(accountId, "127.0.0.1");
            mapper.insertGoogleIdentity(UUID.randomUUID(), accountId, "duplicate-sub", null);
            return null;
        }))
                .isInstanceOf(DuplicateKeyException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account", Integer.class)).isEqualTo(1);
    }

    @Test
    void unavailableAccountsCannotLoginOrReadPrivateApis() throws Exception {
        UUID id = accounts.login("blocked-sub", null, "127.0.0.1");
        for (String state : List.of("BAN", "DELETED")) {
            jdbc.update("UPDATE account SET status = ? WHERE id = ?", state, id);
            assertThatThrownBy(() -> accounts.login("blocked-sub", null, "127.0.0.1"))
                    .isInstanceOf(OAuth2AuthenticationException.class);
            mvc.perform(get("/api/me").with(oidcLogin().oidcUser(principal(id))))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/characters").with(oidcLogin().oidcUser(principal(id))))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void healthIsPublicAndPrivateApisReturn401InsteadOfRedirecting() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk());
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/characters")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/csrf")).andExpect(status().isUnauthorized());
    }

    @Test
    void characterListIsScopedToSessionAccountAndOrderedBySlot() throws Exception {
        UUID mine = accounts.login("mine", null, "127.0.0.1");
        UUID other = accounts.login("other", null, "127.0.0.1");
        mvc.perform(get("/api/characters").with(oidcLogin().oidcUser(principal(mine))))
                .andExpect(content().json("[]"));
        insertCharacter(mine, 2, "두 번째");
        insertCharacter(mine, 1, "첫 번째");
        insertCharacter(other, 1, "다른 사용자");
        mvc.perform(get("/api/characters").param("accountId", other.toString())
                        .with(oidcLogin().oidcUser(principal(mine))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("첫 번째"))
                .andExpect(jsonPath("$[1].slotNo").value(2))
                .andExpect(jsonPath("$[0].introCompletedAt").isEmpty());
        mvc.perform(get("/api/me").with(oidcLogin().oidcUser(principal(mine))))
                .andExpect(content().json("{\"id\":\"" + mine + "\",\"status\":\"ACTIVE\"}"))
                .andExpect(jsonPath("$.idToken").doesNotExist());
    }

    @Test
    void sessionSurvivesRequestsAndLogoutRequiresRealCsrfToken() throws Exception {
        UUID id = accounts.login("session-sub", null, "127.0.0.1");
        var result = mvc.perform(get("/api/me").with(oidcLogin().oidcUser(principal(id))))
                .andExpect(status().isOk()).andReturn();
        var session = (MockHttpSession) result.getRequest().getSession(false);
        mvc.perform(get("/api/me").session(session)).andExpect(status().isOk());
        mvc.perform(post("/api/logout").session(session)).andExpect(status().isForbidden());
        var csrf = mvc.perform(get("/api/csrf").session(session))
                .andExpect(status().isOk()).andReturn();
        // Use the actual masked token returned by the endpoint, not a test bypass.
        var token = (org.springframework.security.web.csrf.CsrfToken)
                csrf.getRequest().getAttribute(org.springframework.security.web.csrf.CsrfToken.class.getName());
        mvc.perform(post("/api/logout").session(session).header(token.getHeaderName(), token.getToken()))
                .andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginRedirectsToGoogleWithConfiguredCallbackAndMinimalScopes() throws Exception {
        mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", containsString("https://accounts.google.com/")))
                .andExpect(header().string("Location", containsString("scope=openid%20email")))
                .andExpect(header().string("Location", containsString("state=")))
                .andExpect(header().string("Location", containsString(
                        "redirect_uri=http://localhost:8081/login/oauth2/code/google")));
        mvc.perform(get("/login/oauth2/code/google").param("code", "invalid").param("state", "invalid"))
                .andExpect(redirectedUrl("http://localhost:8080?auth=failed"));
    }

    private MokdoOidcUser principal(UUID accountId) {
        var token = new OidcIdToken("test-id-token", Instant.now(), Instant.now().plusSeconds(300),
                Map.of("sub", "test-google-sub", "iss", "https://accounts.google.com"));
        return new MokdoOidcUser(accountId, new DefaultOidcUser(
                List.of(new SimpleGrantedAuthority("ROLE_USER")), token));
    }

    private void insertCharacter(UUID accountId, int slot, String name) {
        jdbc.update("INSERT INTO game_character (id, account_id, slot_no, name) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), accountId, slot, name);
    }
}
