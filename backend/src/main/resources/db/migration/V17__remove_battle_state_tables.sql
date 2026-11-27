-- V16 may already be applied. Preserve its checksum and remove only transient
-- battle/notification tables; character progression and inventory are retained.
DROP TABLE IF EXISTS gm_character_battle_event;
DROP TABLE IF EXISTS gm_character_battle;
