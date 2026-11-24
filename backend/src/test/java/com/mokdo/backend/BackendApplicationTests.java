package com.mokdo.backend;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import com.mokdo.backend.service.AccountLoginService;
import com.mokdo.backend.service.CharacterService;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.MediaType;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
    @Autowired CharacterService characters;
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

    @Test
    void nameAvailabilityAndCreationEnforceGlobalCaseInsensitiveUniqueness() throws Exception {
        UUID mine = accounts.login("creator", null, "127.0.0.1");
        UUID other = accounts.login("another-creator", null, "127.0.0.1");
        mvc.perform(get("/api/characters/name-availability").param("name", "Alpha")
                        .with(oidcLogin().oidcUser(principal(mine))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(true));
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(principal(mine))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Alpha\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Alpha"))
                .andExpect(jsonPath("$.slotNo").value(1))
                .andExpect(jsonPath("$.appearanceCode").value("STICK_FIGURE"))
                .andExpect(jsonPath("$.introCompletedAt").isEmpty());
        mvc.perform(get("/api/characters/name-availability").param("name", "alpha")
                        .with(oidcLogin().oidcUser(principal(other))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false));
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(principal(other))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"alpha\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("nickname_taken"));
    }

    @Test
    void invalidNamesAreRejectedForBothCheckAndCreate() throws Exception {
        var user = principal(accounts.login("invalid-name-user", null, "127.0.0.1"));
        for (String name : List.of("a", "abcdefghijklm", "공 백", "bad!", "😀😀", "ㄱㄴ", "")) {
            mvc.perform(get("/api/characters/name-availability").param("name", name)
                            .with(oidcLogin().oidcUser(user)))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("nickname_invalid"));
        }
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"bad!\"}"))
                .andExpect(status().isBadRequest());
        var created = characters.create(user, "  숲속친구12  ");
        assertThat(created.name()).isEqualTo("숲속친구12");
    }

    @Test
    void deleteRequiresOwnershipAndExactNameAndRetainsDeletedRow() throws Exception {
        var owner = principal(accounts.login("delete-owner", null, "127.0.0.1"));
        var other = principal(accounts.login("delete-other", null, "127.0.0.1"));
        var character = characters.create(owner, "MyHero");
        String path = "/api/characters/" + character.id();
        mvc.perform(delete(path).with(oidcLogin().oidcUser(other)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"MyHero\"}"))
                .andExpect(status().isNotFound());
        for (String confirmation : List.of("myhero", "MyHero ", "", "다른이름")) {
            mvc.perform(delete(path).with(oidcLogin().oidcUser(owner)).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"confirmationName\":\"" + confirmation + "\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("confirmation_mismatch"));
        }
        assertThat(characters.findMine(owner)).hasSize(1);
        mvc.perform(delete(path).with(oidcLogin().oidcUser(owner)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"MyHero\"}"))
                .andExpect(status().isNoContent());
        assertThat(characters.findMine(owner)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT status FROM game_character WHERE id = ?", String.class, character.id()))
                .isEqualTo("DELETED");
        assertThat(characters.isNameAvailable(other, "myhero")).isTrue();
        var replacement = characters.create(owner, "MyHero");
        assertThat(replacement.id()).isNotEqualTo(character.id());
        assertThat(replacement.slotNo()).isEqualTo(character.slotNo());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM game_character", Integer.class)).isEqualTo(2);
        mvc.perform(delete(path).with(oidcLogin().oidcUser(owner)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"MyHero\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void characterMutationsRequireCsrfAndAuthenticatedActiveAccount() throws Exception {
        var user = principal(accounts.login("csrf-creator", null, "127.0.0.1"));
        var character = characters.create(user, "토끼친구");
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(user))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"고양이\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/characters/" + character.id()).with(oidcLogin().oidcUser(user))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"토끼친구\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/characters").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"고양이\"}"))
                .andExpect(status().isUnauthorized());
        jdbc.update("UPDATE account SET status = 'BAN' WHERE id = ?", user.getAccountId());
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"고양이\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/characters/" + character.id()).with(oidcLogin().oidcUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"토끼친구\"}"))
                .andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT status FROM game_character WHERE id = ?", String.class, character.id()))
                .isEqualTo("ACTIVE");
    }

    @Test
    void concurrentCreationsForOneAccountHaveDistinctSlots() throws Exception {
        var user = principal(accounts.login("parallel-creator", null, "127.0.0.1"));
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var results = java.util.stream.IntStream.range(0, 6).mapToObj(index -> executor.submit(() -> {
                start.await();
                return characters.create(user, "친구" + index);
            })).toList();
            start.countDown();
            for (var result : results) result.get(20, TimeUnit.SECONDS);
        }
        assertThat(characters.findMine(user)).extracting(item -> item.slotNo())
                .containsExactly(1, 2, 3, 4, 5, 6);
    }

    @Test
    void concurrentNameRaceAcrossAccountsHasOnlyOneWinner() throws Exception {
        var first = principal(accounts.login("race-first", null, "127.0.0.1"));
        var second = principal(accounts.login("race-second", null, "127.0.0.1"));
        assertThat(characters.isNameAvailable(first, "SharedName")).isTrue();
        assertThat(characters.isNameAvailable(second, "SharedName")).isTrue();
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var results = List.of(first, second).stream().map(user -> executor.submit(() -> {
                start.await();
                try {
                    characters.create(user, "SharedName");
                    return true;
                } catch (ResponseStatusException exception) {
                    assertThat(exception.getStatusCode().value()).isEqualTo(409);
                    return false;
                }
            })).toList();
            start.countDown();
            int winners = 0;
            for (var result : results) if (result.get(20, TimeUnit.SECONDS)) winners++;
            assertThat(winners).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM game_character", Integer.class)).isEqualTo(1);
    }

    @Test
    void introCompletionIsPerCharacterAndKeepsFirstCompletionTime() throws Exception {
        var owner = principal(accounts.login("intro-owner", null, "127.0.0.1"));
        var first = characters.create(owner, "첫여행자");
        var second = characters.create(owner, "다음여행자");
        String detail = "/api/characters/" + first.id();
        mvc.perform(get(detail).with(oidcLogin().oidcUser(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.introCompletedAt").isEmpty());
        mvc.perform(post(detail + "/intro-completion").with(oidcLogin().oidcUser(owner)))
                .andExpect(status().isForbidden());
        mvc.perform(post(detail + "/intro-completion").with(oidcLogin().oidcUser(owner)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.introCompletedAt").isNotEmpty());
        var completedAt = characters.findMineById(owner, first.id()).introCompletedAt();
        assertThat(completedAt).isNotNull();
        mvc.perform(post(detail + "/intro-completion").with(oidcLogin().oidcUser(owner)).with(csrf()))
                .andExpect(status().isOk());
        assertThat(characters.findMineById(owner, first.id()).introCompletedAt()).isEqualTo(completedAt);
        assertThat(characters.findMineById(owner, second.id()).introCompletedAt()).isNull();
    }

    @Test
    void introCannotBeReadOrCompletedForOtherOwnersDeletedCharactersOrBannedAccounts() throws Exception {
        var owner = principal(accounts.login("intro-active", null, "127.0.0.1"));
        var other = principal(accounts.login("intro-other", null, "127.0.0.1"));
        var character = characters.create(owner, "주인있는친구");
        String detail = "/api/characters/" + character.id();
        mvc.perform(get(detail).with(oidcLogin().oidcUser(other))).andExpect(status().isNotFound());
        mvc.perform(post(detail + "/intro-completion").with(oidcLogin().oidcUser(other)).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(post(detail + "/intro-completion").with(csrf())).andExpect(status().isUnauthorized());
        jdbc.update("UPDATE account SET status = 'BAN' WHERE id = ?", owner.getAccountId());
        mvc.perform(post(detail + "/intro-completion").with(oidcLogin().oidcUser(owner)).with(csrf()))
                .andExpect(status().isForbidden());
        jdbc.update("UPDATE account SET status = 'ACTIVE' WHERE id = ?", owner.getAccountId());
        assertThat(characters.findMineById(owner, character.id()).introCompletedAt()).isNull();
        characters.delete(owner, character.id(), character.name());
        mvc.perform(get(detail).with(oidcLogin().oidcUser(owner))).andExpect(status().isNotFound());
        mvc.perform(post(detail + "/intro-completion").with(oidcLogin().oidcUser(owner)).with(csrf()))
                .andExpect(status().isNotFound());
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
