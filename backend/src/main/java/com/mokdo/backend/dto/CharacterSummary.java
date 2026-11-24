package com.mokdo.backend.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CharacterSummary(UUID id, int slotNo, String name, String appearanceCode,
        OffsetDateTime introCompletedAt) {}
