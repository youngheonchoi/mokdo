package com.mokdo.backend.service;

import java.util.UUID;

public interface AccountLoginService {
    UUID login(String subject, String email, String remoteAddress);
}
