CREATE TABLE skill_level (
    skill_code VARCHAR(64) NOT NULL,
    skill_type VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    level SMALLINT NOT NULL,
    required_xp BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_skill_level PRIMARY KEY (skill_code, level),
    CONSTRAINT chk_skill_level_type CHECK (skill_type = 'ACTIVE'),
    CONSTRAINT fk_skill_level_active FOREIGN KEY (skill_code, skill_type)
        REFERENCES skill (skill_code, type) ON DELETE RESTRICT,
    CONSTRAINT chk_skill_level_range CHECK (level BETWEEN 1 AND 50),
    CONSTRAINT chk_skill_level_xp CHECK (
        (level < 50 AND required_xp IS NOT NULL AND required_xp > 0)
        OR (level = 50 AND required_xp IS NULL)
    )
);

COMMENT ON TABLE skill_level IS '액티브 스킬별 레벨업 경험치 설정. 스킬 레벨은 1부터 50까지이며 레벨 자체는 위력에 영향을 주지 않는다';
COMMENT ON COLUMN skill_level.skill_code IS '성장 기준이 적용되는 액티브 스킬 코드';
COMMENT ON COLUMN skill_level.skill_type IS '액티브 스킬에만 성장 곡선을 등록하기 위한 고정 구분값 ACTIVE';
COMMENT ON COLUMN skill_level.level IS '현재 스킬 레벨. 각 스킬마다 1부터 50까지 빠짐없이 등록했는지 서버에서 검증한다';
COMMENT ON COLUMN skill_level.required_xp IS '현재 레벨에서 다음 레벨로 오르는 데 필요한 경험치. 누적 경험치가 아니며 최대 레벨 50은 NULL';
COMMENT ON COLUMN skill_level.created_at IS '스킬 레벨 설정 생성 일시';
COMMENT ON COLUMN skill_level.updated_at IS '스킬 레벨 설정 최종 수정 일시';

-- 경험치 요구량은 운영 데이터로 변경한다. 기존에 도달한 캐릭터 스킬 레벨은 소급 변경하지 않는다.
-- 이미 쌓인 레벨 내 경험치가 변경된 요구량 이상이면 다음 성장 처리 시 정산한다.
