-- 장착 부위와 별개로 손목보호대, 책, 방패 등의 장비 종류를 정의한다.
-- 초기 데이터는 삽입하지 않는다. updated_at은 수정 시 애플리케이션에서 갱신한다.
CREATE TABLE equipment_type (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    equipment_slot VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_equipment_type_code CHECK (code = BTRIM(code) AND code <> ''),
    CONSTRAINT chk_equipment_type_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_equipment_type_slot CHECK (equipment_slot IN (
        'head', 'armor', 'gloves', 'shoes', 'weapon', 'offhand', 'earring', 'necklace', 'ring'
    )),
    CONSTRAINT uq_equipment_type_code_slot UNIQUE (code, equipment_slot)
);

COMMENT ON TABLE equipment_type IS '장비 종류 정의. 손목보호대, 책, 방패는 서로 다른 종류이지만 모두 offhand 부위를 사용한다';
COMMENT ON COLUMN equipment_type.code IS '장비 종류 고유 코드. 예: WRIST_GUARD, BOOK, SHIELD';
COMMENT ON COLUMN equipment_type.name IS '장비 종류 표시 이름';
COMMENT ON COLUMN equipment_type.equipment_slot IS '해당 종류의 장착 부위. 장비 아이템의 부위와 일치해야 한다';
COMMENT ON COLUMN equipment_type.created_at IS '장비 종류 생성 일시';
COMMENT ON COLUMN equipment_type.updated_at IS '장비 종류 최종 수정 일시';
