-- character_equipment 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 장착 해제 시 장착 행만 삭제하고 character_item의 소유 장비 행은 유지한다.
-- 장착 및 해제와 최종 능력치 재계산은 일관되게 처리한다.

CREATE TABLE character_equipment (
    character_id UUID NOT NULL,
    slot_code VARCHAR(20) NOT NULL,
    item_code VARCHAR(64) NOT NULL,
    character_item_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_character_equipment PRIMARY KEY (character_id, slot_code),
    -- 개별 장비의 소유 캐릭터와 종류가 장착 정보와 일치해야 한다.
    CONSTRAINT fk_character_equipment_instance FOREIGN KEY (character_item_id, character_id, item_code)
        REFERENCES character_item (id, character_id, item_code),
    CONSTRAINT uq_character_equipment_instance UNIQUE (character_item_id),
    CONSTRAINT fk_character_equipment_character FOREIGN KEY (character_id)
        REFERENCES game_character (id) ON DELETE CASCADE,
    -- 장비가 아닌 아이템과 부위가 맞지 않는 장비는 저장할 수 없다.
    CONSTRAINT fk_character_equipment_item_slot FOREIGN KEY (item_code, slot_code)
        REFERENCES item (item_code, equipment_slot) ON DELETE RESTRICT,
    CONSTRAINT chk_character_equipment_slot CHECK (slot_code IN (
        'head', 'armor', 'gloves', 'shoes', 'weapon', 'offhand', 'earring', 'necklace', 'ring'
    ))
);

COMMENT ON TABLE character_equipment IS '캐릭터별 부위당 장착한 개별 장비. 미장착 부위는 행을 저장하지 않으며 장착 해제 시에도 character_item의 소유 장비 행은 유지한다';
COMMENT ON COLUMN character_equipment.character_id IS '장비를 장착한 캐릭터 식별자';
COMMENT ON COLUMN character_equipment.slot_code IS '장착 부위 코드. 아이템 기준정보에 정의된 장착 부위와 반드시 일치해야 한다';
COMMENT ON COLUMN character_equipment.item_code IS '장착 장비의 종류 코드. 개별 장비의 종류 및 item에 정의된 장착 부위를 함께 검증하기 위해 유지한다';
COMMENT ON COLUMN character_equipment.created_at IS '해당 장착 부위 행 생성 일시';
COMMENT ON COLUMN character_equipment.updated_at IS '해당 부위의 장착 장비 최종 수정 일시';
COMMENT ON COLUMN character_equipment.character_item_id IS '장착한 개별 장비 식별자. 같은 캐릭터의 같은 아이템 종류여야 하며 동일 장비를 여러 부위에 중복 장착할 수 없다';

CREATE INDEX idx_character_equipment_item_slot ON character_equipment (item_code, slot_code);
