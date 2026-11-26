package com.mokdo.backend.auth;

import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoogleMemberService {
    private final JdbcTemplate jdbc;

    public GoogleMemberService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public UUID login(String subject) {
        if (subject == null || subject.isBlank() || subject.length() > 255) {
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_subject"));
        }

        // Serialize registrations for the same Google account across server instances.
        // The transaction releases this PostgreSQL lock on commit or rollback.
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                rs -> { }, "GOOGLE:" + subject);

        var members = jdbc.query("""
                SELECT m.member_id, m.status
                FROM mb_member_social s
                JOIN mb_member m ON m.member_id = s.member_id
                WHERE s.provider = 'GOOGLE' AND s.provider_subject = ?
                """, (rs, row) -> new Member(rs.getObject("member_id", UUID.class), rs.getString("status")),
                subject);

        if (!members.isEmpty()) {
            Member member = members.getFirst();
            if (!"ACT".equals(member.status())) {
                throw new OAuth2AuthenticationException(new OAuth2Error("account_disabled"));
            }
            return member.id();
        }

        UUID memberId = UUID.randomUUID();
        jdbc.update("INSERT INTO mb_member (member_id) VALUES (?)", memberId);
        jdbc.update("""
                INSERT INTO mb_member_social (member_social_id, member_id, provider, provider_subject)
                VALUES (?, ?, 'GOOGLE', ?)
                """, UUID.randomUUID(), memberId, subject);
        return memberId;
    }

    private record Member(UUID id, String status) { }
}
