-- 공통 기술은 항상 사용하며 공격, 지원, 방어 중 하나를 10레벨부터 NPC에게 선택한다.
-- 초기 데이터는 삽입하지 않는다. 공격은 손목보호대, 지원은 책, 방어는 방패 종류를 연결한다.
CREATE TABLE specialization (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    required_level INTEGER NOT NULL,
    required_offhand_type_code VARCHAR(64),
    required_equipment_slot VARCHAR(20),
    sort_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_specialization_code CHECK (code IN ('COMMON', 'ATTACK', 'SUPPORT', 'DEFENSE')),
    CONSTRAINT chk_specialization_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_specialization_requirements CHECK (
        (code = 'COMMON' AND required_level = 1
            AND required_offhand_type_code IS NULL AND required_equipment_slot IS NULL)
        OR (code <> 'COMMON' AND required_level >= 10
            AND required_offhand_type_code IS NOT NULL
            AND required_equipment_slot IS NOT NULL AND required_equipment_slot = 'offhand')
    ),
    CONSTRAINT fk_specialization_offhand_type FOREIGN KEY (required_offhand_type_code, required_equipment_slot)
        REFERENCES equipment_type (code, equipment_slot) ON DELETE RESTRICT,
    CONSTRAINT uq_specialization_offhand_type UNIQUE (required_offhand_type_code),
    CONSTRAINT chk_specialization_sort CHECK (sort_order >= 0),
    CONSTRAINT chk_specialization_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE specialization IS '공통 및 선택 특성 정의. 선택 특성의 모든 스킬은 지정한 보조무기 착용을 추가로 요구한다';
COMMENT ON COLUMN specialization.code IS '특성 코드 (COMMON: 공통, ATTACK: 공격, SUPPORT: 지원, DEFENSE: 방어)';
COMMENT ON COLUMN specialization.name IS '특성 표시 이름';
COMMENT ON COLUMN specialization.description IS '특성 설명';
COMMENT ON COLUMN specialization.required_level IS '특성 선택 최소 캐릭터 레벨. 공통은 1, 선택 특성은 10 이상이며 현재 운영 규칙은 10이다';
COMMENT ON COLUMN specialization.required_offhand_type_code IS '필수 보조무기 종류. 공격은 손목보호대, 지원은 책, 방어는 방패 종류를 등록하며 공통은 NULL';
COMMENT ON COLUMN specialization.required_equipment_slot IS '필수 장비가 보조무기인지 검증하는 고정 부위값 offhand. 공통은 NULL';
COMMENT ON COLUMN specialization.sort_order IS '특성 표시 순서. 작은 값부터 표시한다';
COMMENT ON COLUMN specialization.status IS '특성 운영 상태 (ACTIVE: 사용 가능, INACTIVE: 비활성)';
COMMENT ON COLUMN specialization.created_at IS '특성 생성 일시';
COMMENT ON COLUMN specialization.updated_at IS '특성 최종 수정 일시';
