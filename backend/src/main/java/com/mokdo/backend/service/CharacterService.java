package com.mokdo.backend.service;

import java.util.List;
import java.util.UUID;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.CharacterSummary;

public interface CharacterService {
    List<CharacterSummary> findMine(MokdoOidcUser user);
    CharacterSummary findMineById(MokdoOidcUser user, UUID characterId);
    CharacterSummary completeIntro(MokdoOidcUser user, UUID characterId);
    boolean isNameAvailable(MokdoOidcUser user, String name);
    CharacterSummary create(MokdoOidcUser user, String name);
    void delete(MokdoOidcUser user, UUID characterId, String confirmationName);
}
