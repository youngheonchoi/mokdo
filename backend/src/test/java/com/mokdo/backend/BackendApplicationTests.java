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
import org.springframework.jdbc.core.RowMapper;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
        when(jdbc.query(eq("SELECT status FROM mb_member WHERE member_id = ?"), any(RowMapper.class), any(UUID.class)))
                .thenReturn(List.of("ACT"));
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
    void callbackWithoutSavedAuthorizationRequestUsesFailureHandler() throws Exception {
        mvc.perform(get("/login/oauth2/code/google").param("code", "test-code").param("state", "missing-state"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("http://localhost:8080/?login=failed"));
    }

    @Test
    void bannedMemberLosesExistingSessionOnNextRequest() throws Exception {
        UUID memberId = UUID.randomUUID();
        when(jdbc.query(eq("SELECT status FROM mb_member WHERE member_id = ?"), any(RowMapper.class), eq(memberId)))
                .thenReturn(List.of("BAN"));
        var session = new MockHttpSession();
        mvc.perform(get("/api/auth/session").session(session).with(oidcLogin().oidcUser(memberUser(memberId))))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("account_disabled"))
                .andExpect(header().string("Cache-Control", "no-store"));
        assertTrue(session.isInvalid());
    }

    @Test
    void bannedMemberCannotCreateCharacterWithExistingLogin() throws Exception {
        UUID memberId = UUID.randomUUID();
        when(jdbc.query(eq("SELECT status FROM mb_member WHERE member_id = ?"), any(RowMapper.class), eq(memberId)))
                .thenReturn(List.of("BAN"));
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(memberUser(memberId))).with(csrf())
                        .contentType("application/json").content("{\"nickname\":\"차단할요청\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("account_disabled"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void removedMemberCannotContinueUsingSession() throws Exception {
        UUID memberId = UUID.randomUUID();
        when(jdbc.query(eq("SELECT status FROM mb_member WHERE member_id = ?"), any(RowMapper.class), eq(memberId)))
                .thenReturn(List.of());
        mvc.perform(get("/api/auth/session").with(oidcLogin().oidcUser(memberUser(memberId))))
                .andExpect(status().isUnauthorized());
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

    @Test
    void characterReadsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/characters")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/characters/nickname-check").param("nickname", "모험가"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isUnauthorized());
    }

    @Test
    void characterCreationRequiresCsrf() throws Exception {
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(memberUser(UUID.randomUUID())))
                        .contentType("application/json").content("{\"slotNo\":1,\"nickname\":\"모험가\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void csrfEndpointReturnsTokenForAuthenticatedSession() throws Exception {
        mvc.perform(get("/api/auth/csrf").with(oidcLogin().oidcUser(memberUser(UUID.randomUUID()))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void characterListUsesAuthenticatedMember() throws Exception {
        UUID memberId = UUID.randomUUID();
        mvc.perform(get("/api/characters").with(oidcLogin().oidcUser(memberUser(memberId))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("[]"));
        verify(jdbc).query(contains("FROM gm_character g JOIN"), any(RowMapper.class), eq(memberId));
    }

    @Test
    void characterCreationValidatesNicknameOnServer() throws Exception {
        mvc.perform(post("/api/characters").with(oidcLogin().oidcUser(memberUser(UUID.randomUUID())))
                        .with(csrf()).contentType("application/json")
                        .content("{\"slotNo\":1,\"nickname\":\"a!\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void characterDeletionRequiresAuthenticationAndCsrf() throws Exception {
        String path = "/api/characters/" + UUID.randomUUID();
        mvc.perform(delete(path).with(csrf()).contentType("application/json")
                        .content("{\"nickname\":\"Hero\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(path).with(oidcLogin().oidcUser(memberUser(UUID.randomUUID())))
                        .contentType("application/json").content("{\"nickname\":\"Hero\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void characterDeletionUsesAuthenticatedMemberAndExactNickname() throws Exception {
        UUID memberId = UUID.randomUUID();
        UUID characterId = UUID.randomUUID();
        when(jdbc.query(contains("AND nickname = ? FOR UPDATE"), any(RowMapper.class),
                eq(characterId), eq(memberId), eq("Hero"))).thenReturn(List.of(characterId));
        mvc.perform(delete("/api/characters/" + characterId)
                        .with(oidcLogin().oidcUser(memberUser(memberId))).with(csrf())
                        .contentType("application/json").content("{\"nickname\":\"Hero\"}"))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Cache-Control", "no-store"));
        verify(jdbc).update(contains("AND member_id = ? AND nickname = ?"),
                eq(characterId), eq(memberId), eq("Hero"));
    }

    @Test
    void characterDeletionReturnsConflictForUnmatchedCharacter() throws Exception {
        mvc.perform(delete("/api/characters/" + UUID.randomUUID())
                        .with(oidcLogin().oidcUser(memberUser(UUID.randomUUID()))).with(csrf())
                        .contentType("application/json").content("{\"nickname\":\"hero\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void costumeEndpointsRequireAuthenticationAndCsrf() throws Exception {
        mvc.perform(get("/api/costumes")).andExpect(status().isUnauthorized());
        mvc.perform(get("/asset-files/characters/costumes/forest-ranger.png"))
                .andExpect(status().isUnauthorized());
        String path = "/api/characters/" + UUID.randomUUID() + "/costume";
        mvc.perform(put(path).with(csrf()).contentType("application/json").content("{\"costumeId\":null}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(path).with(oidcLogin().oidcUser(memberUser(UUID.randomUUID())))
                        .contentType("application/json").content("{\"costumeId\":null}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownedCostumeListUsesAuthenticatedMember() throws Exception {
        UUID memberId = UUID.randomUUID();
        mvc.perform(get("/api/costumes").with(oidcLogin().oidcUser(memberUser(memberId))))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("[]"));
        verify(jdbc).query(contains("WHERE mc.member_id = ?"), any(RowMapper.class), eq(memberId));
    }

    @Test
    void equippingCostumeUsesAuthenticatedMemberAndOwnedCostume() throws Exception {
        UUID memberId = UUID.randomUUID();
        UUID characterId = UUID.randomUUID();
        UUID costumeId = UUID.randomUUID();
        when(jdbc.update(contains("AND EXISTS"), eq(costumeId), eq(characterId),
                eq(memberId), eq(memberId), eq(costumeId))).thenReturn(1);
        mvc.perform(put("/api/characters/" + characterId + "/costume")
                        .with(oidcLogin().oidcUser(memberUser(memberId))).with(csrf())
                        .contentType("application/json").content("{\"costumeId\":\"" + costumeId + "\"}"))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"));
        verify(jdbc).update(contains("AND EXISTS"), eq(costumeId), eq(characterId),
                eq(memberId), eq(memberId), eq(costumeId));
    }

    @Test
    void nullCostumeIsRejected() throws Exception {
        UUID memberId = UUID.randomUUID();
        UUID characterId = UUID.randomUUID();
        mvc.perform(put("/api/characters/" + characterId + "/costume")
                        .with(oidcLogin().oidcUser(memberUser(memberId))).with(csrf())
                        .contentType("application/json").content("{\"costumeId\":null}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unownedCostumeCannotBeEquipped() throws Exception {
        mvc.perform(put("/api/characters/" + UUID.randomUUID() + "/costume")
                        .with(oidcLogin().oidcUser(memberUser(UUID.randomUUID()))).with(csrf())
                        .contentType("application/json").content("{\"costumeId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void weaponEndpointsRequireAuthenticationAndCsrf() throws Exception {
        String path = "/api/characters/" + UUID.randomUUID();
        mvc.perform(get(path + "/items")).andExpect(status().isUnauthorized());
        mvc.perform(put(path + "/weapon").with(csrf()).contentType("application/json")
                        .content("{\"characterItemId\":null}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(path + "/weapon").with(oidcLogin().oidcUser(memberUser(UUID.randomUUID())))
                        .contentType("application/json").content("{\"characterItemId\":null}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void itemListUsesAuthenticatedMemberAndRequestedCharacter() throws Exception {
        UUID memberId = UUID.randomUUID();
        UUID characterId = UUID.randomUUID();
        mvc.perform(get("/api/characters/" + characterId + "/items")
                        .with(oidcLogin().oidcUser(memberUser(memberId))))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("[]"));
        verify(jdbc).query(contains("WHERE g.member_id = ? AND g.character_id = ?"),
                any(RowMapper.class), eq(memberId), eq(characterId));
    }

    @Test
    void weaponEquipmentRequiresOwnedCharacterAndOwnedWeapon() throws Exception {
        UUID memberId = UUID.randomUUID();
        UUID characterId = UUID.randomUUID();
        UUID characterItemId = UUID.randomUUID();
        when(jdbc.query(contains("FROM gm_character WHERE"), any(RowMapper.class), eq(characterId), eq(memberId)))
                .thenReturn(List.of(characterId));
        when(jdbc.query(contains("SELECT ci.character_item_id"), any(RowMapper.class), eq(characterItemId), eq(characterId)))
                .thenReturn(List.of(characterItemId));
        mvc.perform(put("/api/characters/" + characterId + "/weapon")
                        .with(oidcLogin().oidcUser(memberUser(memberId))).with(csrf())
                        .contentType("application/json").content("{\"characterItemId\":\"" + characterItemId + "\"}"))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"));
        verify(jdbc).update(contains("INSERT INTO gm_character_equipment"), any(UUID.class), eq(characterId), eq(characterItemId));
    }

    @Test
    void weaponEquipmentRejectsAnotherMembersCharacter() throws Exception {
        mvc.perform(put("/api/characters/" + UUID.randomUUID() + "/weapon")
                        .with(oidcLogin().oidcUser(memberUser(UUID.randomUUID()))).with(csrf())
                        .contentType("application/json").content("{\"characterItemId\":null}"))
                .andExpect(status().isNotFound());
    }

    private MemberOidcUser memberUser(UUID memberId) {
        OidcIdToken token = OidcIdToken.withTokenValue("test-id-token")
                .subject("google-subject").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300)).build();
        return new MemberOidcUser(new DefaultOidcUser(
                List.of(new SimpleGrantedAuthority("ROLE_USER")), token), memberId);
    }

    @Test
    void hatEquipmentRequiresAuthenticationCsrfAndOwnedCharacter() throws Exception {
        String path = "/api/characters/" + UUID.randomUUID() + "/hat";
        mvc.perform(put(path).with(csrf()).contentType("application/json").content("{\"characterItemId\":null}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(path).with(oidcLogin().oidcUser(memberUser(UUID.randomUUID())))
                        .contentType("application/json").content("{\"characterItemId\":null}"))
                .andExpect(status().isForbidden());
        mvc.perform(put(path).with(oidcLogin().oidcUser(memberUser(UUID.randomUUID()))).with(csrf())
                        .contentType("application/json").content("{\"characterItemId\":null}"))
                .andExpect(status().isNotFound());
    }


}
