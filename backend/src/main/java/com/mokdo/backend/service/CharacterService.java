package com.mokdo.backend.service;

import java.util.List;

import com.mokdo.backend.auth.MokdoOidcUser;
import com.mokdo.backend.dto.CharacterSummary;

public interface CharacterService {
    List<CharacterSummary> findMine(MokdoOidcUser user);
}
