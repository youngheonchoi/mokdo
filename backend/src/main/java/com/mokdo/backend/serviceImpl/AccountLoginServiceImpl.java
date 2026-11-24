package com.mokdo.backend.serviceImpl;

import java.util.UUID;

import com.mokdo.backend.dto.AccountDto;
import com.mokdo.backend.mapper.AccountMapper;
import com.mokdo.backend.service.AccountLoginService;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AccountLoginServiceImpl implements AccountLoginService {
    private final AccountMapper accounts;
    private final TransactionTemplate transactions;

    public AccountLoginServiceImpl(AccountMapper accounts, TransactionTemplate transactions) {
        this.accounts = accounts;
        this.transactions = transactions;
    }

    @Override
    public UUID login(String subject, String email, String remoteAddress) {
        AccountDto account;
        try {
            account = transactions.execute(status -> accounts.findByGoogleSubject(subject)
                    .orElseGet(() -> createGoogleAccount(subject, email, remoteAddress)));
        } catch (DuplicateKeyException concurrentRegistration) {
            // The losing transaction (including its account INSERT) has rolled back.
            // Read the winner using a new transaction, never the aborted transaction.
            account = transactions.execute(status -> accounts.findByGoogleSubject(subject)
                    .orElseThrow(() -> concurrentRegistration));
        }
        if (account == null || !"ACTIVE".equals(account.status())) {
            throw new OAuth2AuthenticationException("account_unavailable");
        }
        return account.id();
    }

    private AccountDto createGoogleAccount(String subject, String email, String remoteAddress) {
        UUID accountId = UUID.randomUUID();
        accounts.insertAccount(accountId, remoteAddress);
        accounts.insertGoogleIdentity(UUID.randomUUID(), accountId, subject, email);
        return new AccountDto(accountId, "ACTIVE");
    }
}
