CREATE TABLE skill (
    skill_code VARCHAR(64) PRIMARY KEY,
    specialization_code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,
    required_level INTEGER NOT NULL DEFAULT 1,
    cooldown_ms INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_skill_code CHECK (skill_code = BTRIM(skill_code) AND skill_code <> ''),
    CONSTRAINT fk_skill_specialization FOREIGN KEY (specialization_code)
        REFERENCES specialization (code) ON DELETE RESTRICT,
    CONSTRAINT chk_skill_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_skill_type CHECK (type IN ('ACTIVE', 'PASSIVE', 'BUFF')),
    CONSTRAINT chk_skill_required_level CHECK (required_level >= 1),
    CONSTRAINT chk_skill_cooldown CHECK (cooldown_ms >= 0 AND (type <> 'PASSIVE' OR cooldown_ms = 0)),
    CONSTRAINT chk_skill_sort CHECK (sort_order >= 0),
    CONSTRAINT chk_skill_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_skill_code_type UNIQUE (skill_code, type)
);

COMMENT ON TABLE skill IS '특성별 스킬 정의. 캐릭터 레벨과 선행 조건 충족 시 자동 해금하며 포인트와 별도 학습 비용은 없다';
COMMENT ON COLUMN skill.skill_code IS '스킬 고유 코드';
COMMENT ON COLUMN skill.specialization_code IS '소속 특성. 공통은 항상 사용하고 나머지는 현재 선택 특성과 지정 보조무기 착용 조건을 모두 요구한다';
COMMENT ON COLUMN skill.name IS '스킬 표시 이름';
COMMENT ON COLUMN skill.type IS '스킬 구분 (ACTIVE: 처치로 성장하는 액티브, PASSIVE: 상시 효과, BUFF: 사용하여 지속 효과 부여). 버프 및 패시브는 현재 사용 숙련도 성장 대상이 아니다';
COMMENT ON COLUMN skill.required_level IS '자동 해금에 필요한 최소 캐릭터 레벨. 선택 특성의 선택 최소 레벨도 함께 만족해야 한다';
COMMENT ON COLUMN skill.cooldown_ms IS '기본 재사용 대기시간 (밀리초). 패시브는 0이며 실제 다음 사용 가능 시각은 전투 상태에서 관리한다';
COMMENT ON COLUMN skill.description IS '스킬 설명';
COMMENT ON COLUMN skill.sort_order IS '특성 내 스킬 표시 순서';
COMMENT ON COLUMN skill.status IS '스킬 운영 상태 (ACTIVE: 사용 가능, INACTIVE: 비활성)';
COMMENT ON COLUMN skill.created_at IS '스킬 정의 생성 일시';
COMMENT ON COLUMN skill.updated_at IS '스킬 정의 최종 수정 일시';

CREATE INDEX idx_skill_specialization ON skill (specialization_code, status);

-- 해금 여부와 현재 사용 가능 여부는 구분한다. 장비를 해제해도 성장 기록은 보존한다.
-- 스킬 사용 시 서버가 소유권, 캐릭터 상태, 특성, 장비, 선행 조건 및 재사용 대기시간을 검증한다.
-- 장비 종류나 특성이 바뀌면 이전 특성의 패시브와 부여한 지속 버프를 해제하고 능력치를 재계산한다.
