CREATE TABLE character_skill (
    character_id UUID NOT NULL,
    skill_code VARCHAR(64) NOT NULL,
    skill_type VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    level SMALLINT NOT NULL DEFAULT 1,
    level_xp BIGINT NOT NULL DEFAULT 0,
    mastery_rank SMALLINT NOT NULL DEFAULT 1,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_character_skill PRIMARY KEY (character_id, skill_code),
    CONSTRAINT fk_character_skill_character FOREIGN KEY (character_id) REFERENCES game_character (id) ON DELETE CASCADE,
    CONSTRAINT chk_character_skill_type CHECK (skill_type = 'ACTIVE'),
    CONSTRAINT fk_character_skill_active FOREIGN KEY (skill_code, skill_type)
        REFERENCES skill (skill_code, type) ON DELETE RESTRICT,
    CONSTRAINT fk_character_skill_level FOREIGN KEY (skill_code, level)
        REFERENCES skill_level (skill_code, level) ON DELETE RESTRICT,
    CONSTRAINT fk_character_skill_mastery FOREIGN KEY (mastery_rank) REFERENCES skill_mastery (rank) ON DELETE RESTRICT,
    CONSTRAINT chk_character_skill_level CHECK (level BETWEEN 1 AND 50),
    CONSTRAINT chk_character_skill_xp CHECK (level_xp >= 0 AND (level < 50 OR level_xp = 0)),
    CONSTRAINT chk_character_skill_gate CHECK (level <= 30 OR mastery_rank >= 2),
    CONSTRAINT chk_character_skill_high_mastery CHECK (mastery_rank < 3 OR level = 50),
    CONSTRAINT chk_character_skill_version CHECK (version >= 0)
);

COMMENT ON TABLE character_skill IS '캐릭터별 액티브 성장 상태. 최초 해금 시 1레벨, 경험치 0, 하급으로 생성하며 특성 변경 및 장비 해제로 삭제하지 않는다';
COMMENT ON COLUMN character_skill.character_id IS '스킬 성장 기록의 소유 캐릭터 식별자';
COMMENT ON COLUMN character_skill.skill_code IS '성장한 액티브 스킬 코드. 현재 비활성인 다른 특성 스킬의 기록도 보존한다';
COMMENT ON COLUMN character_skill.skill_type IS '액티브만 성장 상태를 저장하도록 검증하는 고정 구분값 ACTIVE';
COMMENT ON COLUMN character_skill.level IS '현재 도달한 스킬 레벨. 레벨 내 경험치와 함께 저장하여 경험치 요구량 변경으로 과거 레벨이 소급 변경되지 않게 한다';
COMMENT ON COLUMN character_skill.level_xp IS '현재 레벨 안에서 누적한 경험치. 레벨업 시 해당 단계 required_xp를 차감한다. 숙련도 제한에 막히면 추가 누적하지 않고 최대 레벨은 0이다';
COMMENT ON COLUMN character_skill.mastery_rank IS '확률로 확정한 현재 숙련도 (1: 하급, 2: 중급, 3: 상급). 숙련도 승급 시 스킬 효과가 바뀐다';
COMMENT ON COLUMN character_skill.version IS '동시 성장 처리 충돌 검사용 버전. 갱신 시 이전 버전을 비교하고 1 증가시키거나 행 잠금을 사용한다';
COMMENT ON COLUMN character_skill.created_at IS '액티브 스킬 최초 성장 기록 생성 일시';
COMMENT ON COLUMN character_skill.updated_at IS '경험치, 레벨 또는 숙련도 최종 수정 일시';

CREATE INDEX idx_character_skill_code ON character_skill (skill_code);

-- 패시브와 버프의 해금 여부는 캐릭터 레벨과 선행 조건으로 계산하며 이 테이블에 행을 만들지 않는다.
-- 액티브 해금 상태도 성장 행의 존재만으로 판단하지 않고 현재 특성과 레벨, 선행 조건을 확인한다.
-- 처치 경험치, 레벨 및 숙련도 변경은 한 번의 원자적 성장 처리로 반영한다.
