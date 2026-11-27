CREATE TABLE gm_character_level (
    level INTEGER CONSTRAINT pk_gm_character_level PRIMARY KEY,
    max_hp INTEGER NOT NULL,
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    required_exp BIGINT,
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_gm_character_level_level CHECK (level >= 1),
    CONSTRAINT chk_gm_character_level_max_hp CHECK (max_hp >= 1),
    CONSTRAINT chk_gm_character_level_attack CHECK (attack >= 0),
    CONSTRAINT chk_gm_character_level_defense CHECK (defense >= 0),
    CONSTRAINT chk_gm_character_level_required_exp CHECK (required_exp IS NULL OR required_exp > 0)
);
COMMENT ON TABLE gm_character_level IS '캐릭터 레벨별 기본 능력치와 다음 레벨 필요 경험치';
COMMENT ON COLUMN gm_character_level.level IS '캐릭터 레벨';
COMMENT ON COLUMN gm_character_level.max_hp IS '기본 최대 체력';
COMMENT ON COLUMN gm_character_level.attack IS '기본 공격력';
COMMENT ON COLUMN gm_character_level.defense IS '기본 방어력';
COMMENT ON COLUMN gm_character_level.required_exp IS '다음 레벨까지 필요한 경험치(NULL은 최고 레벨)';
COMMENT ON COLUMN gm_character_level.reg_dtm IS '등록 일자';
COMMENT ON COLUMN gm_character_level.mod_dtm IS '수정 일자';

CREATE UNIQUE INDEX uq_gm_character_level_required_exp_null
    ON gm_character_level ((required_exp IS NULL)) WHERE required_exp IS NULL;

INSERT INTO gm_character_level (level, max_hp, attack, defense, required_exp)
VALUES (1, 100, 10, 2, NULL);

ALTER TABLE gm_character ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE gm_character ADD COLUMN exp BIGINT NOT NULL DEFAULT 0;
COMMENT ON COLUMN gm_character.level IS '현재 캐릭터 레벨';
COMMENT ON COLUMN gm_character.exp IS '현재 레벨에서 획득한 경험치';
ALTER TABLE gm_character ADD CONSTRAINT fk_gm_character_level
    FOREIGN KEY (level) REFERENCES gm_character_level (level);
ALTER TABLE gm_character ADD CONSTRAINT chk_gm_character_exp CHECK (exp >= 0);
