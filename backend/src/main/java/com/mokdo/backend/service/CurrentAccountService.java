package com.mokdo.backend.service;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.AccountDto;

public interface CurrentAccountService {
    AccountDto requireActive(MokdoOidcUser user);
}
