package com.mokdo.backend.serviceImpl;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.AccountDto;
import com.mokdo.backend.mapper.AccountMapper;
import com.mokdo.backend.service.CurrentAccountService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentAccountServiceImpl implements CurrentAccountService {
    private final AccountMapper accounts;

    public CurrentAccountServiceImpl(AccountMapper accounts) {
        this.accounts = accounts;
    }

    @Override
    public AccountDto requireActive(MokdoOidcUser user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        var account = accounts.findById(user.getAccountId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!"ACTIVE".equals(account.status())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return account;
    }
}
