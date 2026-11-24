package com.mokdo.backend.serviceImpl;

import java.util.List;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.CharacterSummary;
import com.mokdo.backend.mapper.CharacterMapper;
import com.mokdo.backend.service.CharacterService;
import com.mokdo.backend.service.CurrentAccountService;
import org.springframework.stereotype.Service;

@Service
public class CharacterServiceImpl implements CharacterService {
    private final CurrentAccountService currentAccount;
    private final CharacterMapper characters;

    public CharacterServiceImpl(CurrentAccountService currentAccount, CharacterMapper characters) {
        this.currentAccount = currentAccount;
        this.characters = characters;
    }

    @Override
    public List<CharacterSummary> findMine(MokdoOidcUser user) {
        var account = currentAccount.requireActive(user);
        return characters.findByAccountId(account.id());
    }
}
