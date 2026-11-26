CREATE TABLE gm_costume (
    costume_id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    appearance_code VARCHAR(64) NOT NULL,
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_gm_costume_appearance_code UNIQUE (appearance_code),
    CONSTRAINT chk_gm_costume_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_gm_costume_appearance_code CHECK (appearance_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
);
COMMENT ON TABLE gm_costume IS '코스튬 정의';
COMMENT ON COLUMN gm_costume.costume_id IS '코스튬 고유 번호';
COMMENT ON COLUMN gm_costume.name IS '코스튬 이름';
COMMENT ON COLUMN gm_costume.appearance_code IS '캐릭터 스프라이트 외형 코드';
COMMENT ON COLUMN gm_costume.reg_dtm IS '등록 일자';
COMMENT ON COLUMN gm_costume.mod_dtm IS '수정 일자';

CREATE TABLE mb_member_costume (
    member_costume_id UUID PRIMARY KEY,
    member_id UUID NOT NULL,
    costume_id UUID NOT NULL,
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mb_member_costume_member_id FOREIGN KEY (member_id) REFERENCES mb_member (member_id),
    CONSTRAINT fk_mb_member_costume_costume_id FOREIGN KEY (costume_id) REFERENCES gm_costume (costume_id),
    CONSTRAINT uq_mb_member_costume_member_id_costume_id UNIQUE (member_id, costume_id)
);
COMMENT ON TABLE mb_member_costume IS '회원이 보유한 코스튬';
COMMENT ON COLUMN mb_member_costume.member_costume_id IS '보유 코스튬 고유 번호';
COMMENT ON COLUMN mb_member_costume.member_id IS '보유 회원 고유 번호';
COMMENT ON COLUMN mb_member_costume.costume_id IS '보유 코스튬 고유 번호';
COMMENT ON COLUMN mb_member_costume.reg_dtm IS '획득 일자';

ALTER TABLE gm_character ADD COLUMN equipped_costume_id UUID;
COMMENT ON COLUMN gm_character.equipped_costume_id IS '장착한 코스튬 고유 번호(NULL이면 기본 외형)';
-- The composite FK also prevents equipping a costume owned only by another member.
ALTER TABLE gm_character ADD CONSTRAINT fk_gm_character_member_id_equipped_costume_id
    FOREIGN KEY (member_id, equipped_costume_id) REFERENCES mb_member_costume (member_id, costume_id);
CREATE INDEX idx_gm_character_member_id_equipped_costume_id ON gm_character (member_id, equipped_costume_id);
