CREATE TABLE gm_character (
    character_id UUID PRIMARY KEY,
    member_id UUID NOT NULL,
    slot_no SMALLINT NOT NULL,
    nickname TEXT NOT NULL,
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_gm_character_member_id FOREIGN KEY (member_id) REFERENCES mb_member (member_id),
    CONSTRAINT uq_gm_character_member_id_slot_no UNIQUE (member_id, slot_no),
    CONSTRAINT chk_gm_character_slot_no CHECK (slot_no > 0),
    CONSTRAINT chk_gm_character_nickname CHECK (BTRIM(nickname) <> '')
);

COMMENT ON TABLE gm_character IS '캐릭터';
COMMENT ON COLUMN gm_character.character_id IS '캐릭터 고유 번호(자체 생성)';
COMMENT ON COLUMN gm_character.member_id IS '사용자 고유 번호';
COMMENT ON COLUMN gm_character.slot_no IS '슬롯 번호';
COMMENT ON COLUMN gm_character.nickname IS '닉네임';
COMMENT ON COLUMN gm_character.reg_dtm IS '등록 일자';
COMMENT ON COLUMN gm_character.mod_dtm IS '수정 일자';