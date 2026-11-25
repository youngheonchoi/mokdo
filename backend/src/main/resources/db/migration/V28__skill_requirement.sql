CREATE TABLE skill_requirement (
    skill_code VARCHAR(64) NOT NULL,
    required_skill_code VARCHAR(64) NOT NULL,
    required_skill_level SMALLINT NOT NULL DEFAULT 1,
    required_mastery_rank SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_skill_requirement PRIMARY KEY (skill_code, required_skill_code),
    CONSTRAINT fk_skill_requirement_skill FOREIGN KEY (skill_code) REFERENCES skill (skill_code) ON DELETE RESTRICT,
    CONSTRAINT fk_skill_requirement_prerequisite FOREIGN KEY (required_skill_code) REFERENCES skill (skill_code) ON DELETE RESTRICT,
    CONSTRAINT fk_skill_requirement_mastery FOREIGN KEY (required_mastery_rank) REFERENCES skill_mastery (rank) ON DELETE RESTRICT,
    CONSTRAINT chk_skill_requirement_self CHECK (skill_code <> required_skill_code),
    CONSTRAINT chk_skill_requirement_level CHECK (required_skill_level BETWEEN 1 AND 50)
);

COMMENT ON TABLE skill_requirement IS '스킬 자동 해금의 선행 조건. 여러 행이면 모든 조건을 만족해야 하며 캐릭터 요구 레벨도 함께 확인한다';
COMMENT ON COLUMN skill_requirement.skill_code IS '자동 해금하려는 스킬 코드';
COMMENT ON COLUMN skill_requirement.required_skill_code IS '선행 스킬 코드. 공통 또는 같은 특성의 스킬만 연결하도록 서버에서 검증한다';
COMMENT ON COLUMN skill_requirement.required_skill_level IS '선행 스킬 최소 레벨. 액티브는 성장 레벨을 확인하고 패시브와 버프는 해금 상태를 1레벨로 간주한다';
COMMENT ON COLUMN skill_requirement.required_mastery_rank IS '선행 스킬 최소 숙련도. 패시브와 버프에는 1만 허용하도록 서버에서 검증한다';
COMMENT ON COLUMN skill_requirement.created_at IS '선행 조건 생성 일시';
COMMENT ON COLUMN skill_requirement.updated_at IS '선행 조건 최종 수정 일시';

CREATE INDEX idx_skill_requirement_prerequisite ON skill_requirement (required_skill_code);

-- A가 B를 요구하고 B가 A를 요구하는 순환을 포함해 전체 선행 관계의 순환을 서버에서 차단한다.
-- 단순 해금 조건은 레벨 1, 숙련도 1로 등록한다. 선행 스킬의 현재 쿨타임은 해금에 영향을 주지 않는다.
