package com.mokdo.backend.serviceImpl;

import java.text.Normalizer;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.CharacterSummary;
import com.mokdo.backend.mapper.CharacterMapper;
import com.mokdo.backend.service.CharacterService;
import com.mokdo.backend.service.CurrentAccountService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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

    @Override
    public CharacterSummary findMineById(MokdoOidcUser user, UUID characterId) {
        UUID accountId = currentAccount.requireActive(user).id();
        return characters.findActiveOwned(characterId, accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "character_not_found"));
    }

    @Override
    @Transactional
    public CharacterSummary completeIntro(MokdoOidcUser user, UUID characterId) {
        UUID accountId = currentAccount.requireActive(user).id();
        lockAccount(accountId);
        characters.findActiveOwned(characterId, accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "character_not_found"));
        characters.completeIntro(characterId, accountId);
        return characters.findActiveOwned(characterId, accountId).orElseThrow();
    }

    @Override
    public boolean isNameAvailable(MokdoOidcUser user, String name) {
        currentAccount.requireActive(user);
        return !characters.activeNameExists(normalizeName(name));
    }

    @Override
    @Transactional
    public CharacterSummary create(MokdoOidcUser user, String name) {
        UUID accountId = currentAccount.requireActive(user).id();
        String normalized = normalizeName(name);
        lockAccount(accountId);
        if (characters.activeNameExists(normalized)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "nickname_taken");
        }
        var occupied = characters.findByAccountId(accountId).stream()
                .map(CharacterSummary::slotNo).collect(Collectors.toSet());
        int slot = 1;
        while (occupied.contains(slot)) slot++;
        if (slot > Short.MAX_VALUE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "character_slots_full");
        }
        UUID id = UUID.randomUUID();
        try {
            characters.insert(id, accountId, slot, normalized);
        } catch (DuplicateKeyException concurrentCreation) {
            // The database index is authoritative if another account takes the name
            // after the availability check. Throwing rolls back this transaction.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "nickname_taken");
        }
        return new CharacterSummary(id, slot, normalized, "STICK_FIGURE", null);
    }

    @Override
    @Transactional
    public void delete(MokdoOidcUser user, UUID characterId, String confirmationName) {
        UUID accountId = currentAccount.requireActive(user).id();
        lockAccount(accountId);
        var character = characters.findActiveOwned(characterId, accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "character_not_found"));
        if (!character.name().equals(confirmationName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "confirmation_mismatch");
        }
        if (characters.markDeleted(characterId, accountId, confirmationName) != 1) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "character_not_found");
        }
    }

    private void lockAccount(UUID accountId) {
        if (!characters.lockActiveAccount(accountId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "account_unavailable");
        }
    }

    private String normalizeName(String name) {
        if (name == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nickname_invalid");
        String normalized = Normalizer.normalize(name.strip(), Normalizer.Form.NFC);
        if (!normalized.matches("[가-힣A-Za-z0-9]{2,12}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nickname_invalid");
        }
        return normalized;
    }
}
