package com.mokdo.backend.mapper;

import java.util.Optional;
import java.util.UUID;

import com.mokdo.backend.dto.AccountDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AccountMapper {
    private final JdbcTemplate jdbc;

    public AccountMapper(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<AccountDto> findByGoogleSubject(String subject) {
        return jdbc.query("""
                SELECT a.id, a.status FROM account a
                JOIN account_identity i ON i.account_id = a.id
                WHERE i.provider = 'GOOGLE' AND i.provider_subject = ?
                """, (rs, row) -> new AccountDto(rs.getObject("id", UUID.class), rs.getString("status")),
                subject).stream().findFirst();
    }

    public Optional<AccountDto> findById(UUID id) {
        return jdbc.query("SELECT id, status FROM account WHERE id = ?",
                (rs, row) -> new AccountDto(rs.getObject("id", UUID.class), rs.getString("status")), id)
                .stream().findFirst();
    }

    public void insertAccount(UUID accountId, String remoteAddress) {
        jdbc.update("INSERT INTO account (id, create_ip) VALUES (?, CAST(? AS inet))",
                accountId, remoteAddress);
    }

    public void insertGoogleIdentity(UUID identityId, UUID accountId, String subject, String email) {
        jdbc.update("""
                INSERT INTO account_identity (id, account_id, provider, provider_subject, email)
                VALUES (?, ?, 'GOOGLE', ?, ?)
                """, identityId, accountId, subject, email);
    }
}
