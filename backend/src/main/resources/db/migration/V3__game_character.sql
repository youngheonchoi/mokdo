-- Player characters; gameplay progression remains outside this initial schema.

CREATE TABLE game_character (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    slot_no SMALLINT NOT NULL,
    name TEXT NOT NULL,
    appearance_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_game_character_account
        FOREIGN KEY (account_id)
        REFERENCES account (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_game_character_account_slot
        UNIQUE (account_id, slot_no),
    CONSTRAINT chk_game_character_slot_no
        CHECK (slot_no > 0),
    CONSTRAINT chk_game_character_name
        CHECK (BTRIM(name) <> '')
);

COMMENT ON TABLE game_character IS
    'Player characters; gameplay progression is intentionally outside this initial schema';

