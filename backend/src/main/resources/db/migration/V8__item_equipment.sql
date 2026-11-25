-- item_equipment 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 드롭 장비는 줍기 처리 시 각 범위에서 정수 값을 한 번 추첨한다.
-- 상점 구매 장비는 min_attack, min_max_hp, min_defense를 사용한다.
-- 범위를 수정해도 이미 획득한 character_item의 확정값은 변경하지 않는다.

CREATE TABLE item_equipment (
    item_code VARCHAR(64) PRIMARY KEY,
    equipment_type_code VARCHAR(64),
    equipment_slot VARCHAR(20),
    item_category VARCHAR(20) NOT NULL DEFAULT 'equipment',
    min_attack BIGINT NOT NULL DEFAULT 0,
    max_attack BIGINT NOT NULL DEFAULT 0,
    min_max_hp BIGINT NOT NULL DEFAULT 0,
    max_max_hp BIGINT NOT NULL DEFAULT 0,
    min_defense BIGINT NOT NULL DEFAULT 0,
    max_defense BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_item_equipment_type_pair CHECK (
        (equipment_type_code IS NULL AND equipment_slot IS NULL)
        OR (equipment_type_code IS NOT NULL AND equipment_slot IS NOT NULL)
    ),
    CONSTRAINT fk_item_equipment_type_slot FOREIGN KEY (equipment_type_code, equipment_slot)
        REFERENCES equipment_type (code, equipment_slot) ON DELETE RESTRICT,
    CONSTRAINT fk_item_equipment_item_slot FOREIGN KEY (item_code, equipment_slot)
        REFERENCES item (item_code, equipment_slot) ON DELETE RESTRICT,
    CONSTRAINT chk_item_equipment_category CHECK (item_category = 'equipment'),
    CONSTRAINT fk_item_equipment_item_category FOREIGN KEY (item_code, item_category)
        REFERENCES item (item_code, category) ON DELETE RESTRICT,
    CONSTRAINT chk_item_equipment_attack CHECK (min_attack >= 0 AND max_attack >= min_attack),
    CONSTRAINT chk_item_equipment_max_hp CHECK (min_max_hp >= 0 AND max_max_hp >= min_max_hp),
    CONSTRAINT chk_item_equipment_defense CHECK (min_defense >= 0 AND max_defense >= min_defense)
);

COMMENT ON TABLE item_equipment IS '장비 종류별 기본 능력치 추첨 범위. 줍기 처리 시 인벤토리 저장 전에 각 범위에서 정수 값을 한 번 확정한다. 최소와 최대가 같으면 고정 능력치이다';
COMMENT ON COLUMN item_equipment.item_code IS '장비 아이템 코드. 장착 가능 부위는 item.equipment_slot에서 관리한다';
COMMENT ON COLUMN item_equipment.item_category IS '장비에만 능력치를 등록하도록 복합 외래 키로 검증하는 고정 분류값 (equipment)';
COMMENT ON COLUMN item_equipment.min_attack IS '장비 획득 시 추첨할 추가 공격력의 최솟값';
COMMENT ON COLUMN item_equipment.max_attack IS '장비 획득 시 추첨할 추가 공격력의 최댓값. 최솟값 이상이며 양 끝을 포함한다';
COMMENT ON COLUMN item_equipment.min_max_hp IS '장비 획득 시 추첨할 추가 최대 체력의 최솟값. 현재 체력 회복량이 아니다';
COMMENT ON COLUMN item_equipment.max_max_hp IS '장비 획득 시 추첨할 추가 최대 체력의 최댓값. 최솟값 이상이며 양 끝을 포함한다';
COMMENT ON COLUMN item_equipment.min_defense IS '장비 획득 시 추첨할 추가 방어력의 최솟값';
COMMENT ON COLUMN item_equipment.max_defense IS '장비 획득 시 추첨할 추가 방어력의 최댓값. 최솟값 이상이며 양 끝을 포함한다';
COMMENT ON COLUMN item_equipment.created_at IS '장비 기본 능력치 생성 일시';
COMMENT ON COLUMN item_equipment.updated_at IS '장비 기본 능력치 최종 수정 일시';
COMMENT ON COLUMN item_equipment.equipment_type_code IS '장비 종류 코드. 특성 전용 보조무기는 반드시 분류하며 NULL인 장비는 특성 보조무기 조건을 만족하지 않는다';
COMMENT ON COLUMN item_equipment.equipment_slot IS '장비 종류와 아이템의 부위가 일치하는지 복합 외래 키로 검증하기 위한 값. 종류 지정 시 함께 입력한다';
