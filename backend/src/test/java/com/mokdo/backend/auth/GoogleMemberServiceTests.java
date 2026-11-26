package com.mokdo.backend.auth;

import java.sql.ResultSet;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GoogleMemberServiceTests {
    private JdbcTemplate jdbc;
    private GoogleMemberService members;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        members = new GoogleMemberService(jdbc);
    }

    @Test
    void createsMemberAndGoogleLinkWithSameMemberId() {
        UUID memberId = members.login("google-subject");

        verify(jdbc).update("INSERT INTO mb_member (member_id) VALUES (?)", memberId);
        ArgumentCaptor<UUID> socialId = ArgumentCaptor.forClass(UUID.class);
        verify(jdbc).update(contains("INSERT INTO mb_member_social"), socialId.capture(),
                eq(memberId), eq("google-subject"));
        assertNotEquals(memberId, socialId.getValue());
    }

    @Test
    void reusesExistingMemberWithoutInsertingRows() throws Exception {
        UUID memberId = stubExistingMember("ACT");
        assertEquals(memberId, members.login("google-subject"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void refusesBannedMember() throws Exception {
        stubExistingMember("BAN");
        var exception = assertThrows(OAuth2AuthenticationException.class,
                () -> members.login("google-subject"));
        assertEquals("account_disabled", exception.getError().getErrorCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsMissingSubjectBeforeDatabaseAccess() {
        assertThrows(OAuth2AuthenticationException.class, () -> members.login(null));
        assertThrows(OAuth2AuthenticationException.class, () -> members.login(" "));
        verifyNoInteractions(jdbc);
    }

    private UUID stubExistingMember(String status) throws Exception {
        UUID memberId = UUID.randomUUID();
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("member_id", UUID.class)).thenReturn(memberId);
        when(row.getString("status")).thenReturn(status);
        when(jdbc.query(contains("SELECT m.member_id"), any(RowMapper.class), eq("google-subject")))
                .thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    return List.of(mapper.mapRow(row, 0));
                });
        return memberId;
    }
}
