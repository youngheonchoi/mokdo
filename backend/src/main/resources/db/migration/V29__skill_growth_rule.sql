-- 경험치 및 확률 수치는 초기 데이터로 넣지 않고 운영 데이터로 등록한다.
CREATE TABLE skill_growth_rule (
    skill_code VARCHAR(64) NOT NULL,
    skill_type VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    current_mastery_rank SMALLINT NOT NULL,
    min_level SMALLINT NOT NULL,
    max_level SMALLINT NOT NULL,
    required_growth_mastery_rank SMALLINT NOT NULL,
    xp_per_kill BIGINT NOT NULL DEFAULT 0,
    promotion_mastery_rank SMALLINT,
    promotion_probability NUMERIC(12, 11) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_skill_growth_rule PRIMARY KEY (skill_code, current_mastery_rank, min_level),
    CONSTRAINT chk_skill_growth_rule_type CHECK (skill_type = 'ACTIVE'),
    CONSTRAINT fk_skill_growth_rule_active FOREIGN KEY (skill_code, skill_type)
        REFERENCES skill (skill_code, type) ON DELETE RESTRICT,
    CONSTRAINT fk_skill_growth_rule_current FOREIGN KEY (current_mastery_rank)
        REFERENCES skill_mastery (rank) ON DELETE RESTRICT,
    CONSTRAINT fk_skill_growth_rule_gate FOREIGN KEY (required_growth_mastery_rank)
        REFERENCES skill_mastery (rank) ON DELETE RESTRICT,
    CONSTRAINT fk_skill_growth_rule_promotion FOREIGN KEY (promotion_mastery_rank)
        REFERENCES skill_mastery (rank) ON DELETE RESTRICT,
    CONSTRAINT chk_skill_growth_rule_levels CHECK (min_level >= 1 AND max_level >= min_level AND max_level <= 50),
    CONSTRAINT chk_skill_growth_rule_xp CHECK (xp_per_kill >= 0),
    CONSTRAINT chk_skill_growth_rule_probability CHECK (promotion_probability BETWEEN 0 AND 1),
    CONSTRAINT chk_skill_growth_rule_promotion CHECK (
        (promotion_mastery_rank IS NULL AND promotion_probability = 0)
        OR (promotion_mastery_rank IS NOT NULL AND promotion_mastery_rank = current_mastery_rank + 1)
    )
);

COMMENT ON TABLE skill_growth_rule IS '현재 스킬 레벨 구간과 숙련도별 처치 성장 규칙. 같은 스킬과 숙련도의 레벨 구간 중복 및 누락은 서버에서 검증한다';
COMMENT ON COLUMN skill_growth_rule.skill_code IS '성장 규칙이 적용되는 액티브 스킬 코드';
COMMENT ON COLUMN skill_growth_rule.skill_type IS '액티브에만 처치 성장 규칙을 허용하는 고정 구분값 ACTIVE';
COMMENT ON COLUMN skill_growth_rule.current_mastery_rank IS '규칙 적용 시점의 현재 숙련도';
COMMENT ON COLUMN skill_growth_rule.min_level IS '규칙이 적용되는 현재 스킬 레벨의 최솟값 (포함)';
COMMENT ON COLUMN skill_growth_rule.max_level IS '규칙이 적용되는 현재 스킬 레벨의 최댓값 (포함)';
COMMENT ON COLUMN skill_growth_rule.required_growth_mastery_rank IS '이 구간에서 경험치를 쌓고 다음 레벨로 오르기 위한 최소 숙련도. 미달이면 경험치는 누적하지 않지만 승급 추첨은 계속한다';
COMMENT ON COLUMN skill_growth_rule.xp_per_kill IS '해당 액티브 스킬로 적을 처치했을 때 지급할 경험치. 최대 레벨이거나 숙련도 부족으로 막혀 있으면 지급하지 않는다';
COMMENT ON COLUMN skill_growth_rule.promotion_mastery_rank IS '처치 시 확률적으로 승급할 다음 숙련도. 승급하지 않는 구간은 NULL';
COMMENT ON COLUMN skill_growth_rule.promotion_probability IS '유효 처치 1회당 승급 확률. 0은 승급 없음, 1은 확정이며 0.00001은 0.001퍼센트이다';
COMMENT ON COLUMN skill_growth_rule.created_at IS '성장 규칙 생성 일시';
COMMENT ON COLUMN skill_growth_rule.updated_at IS '성장 규칙 최종 수정 일시';

-- 등록할 구간 예시: 1~9 하급은 경험치만, 10~29 하급은 경험치와 중급 승급 추첨.
-- 30~49 하급은 최소 성장 숙련도 2로 막고 중급 승급 추첨은 유지한다.
-- 30~49 중급은 경험치로 성장한다. 50 중급은 경험치 없이 상급 승급 추첨만 한다.
-- 중급으로 일찍 승급한 10~29 및 상급 50 등 실제로 도달 가능한 모든 상태의 규칙도 등록한다.
-- 스킬 레벨 30의 하급은 31로 오를 수 없다. 50에서는 모든 숙련도의 경험치 누적을 중단한다.
-- 처치 직전 상태로 경험치와 승급 가능 여부를 정하고 승급을 최대 한 번 추첨한 뒤 경험치를 정산한다.
-- 한 번에 여러 레벨을 올릴 때도 각 경계에서 규칙을 다시 확인하고 막힌 경계의 초과 경험치는 버린다.
-- 처치를 확정한 피해의 원본 스킬에만 성장 보상을 주며 중복 처치 이벤트는 서버에서 방지한다.
