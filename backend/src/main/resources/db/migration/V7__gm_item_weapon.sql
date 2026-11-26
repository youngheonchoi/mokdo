CREATE TABLE gm_item (
    item_id UUID PRIMARY KEY,
    item_code VARCHAR(64) NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    item_type VARCHAR(20) NOT NULL,
    equip_slot_code VARCHAR(20),
    appearance_code VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'ACT',
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_gm_item_item_code UNIQUE (item_code),
    CONSTRAINT chk_gm_item_item_code CHECK (item_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
    CONSTRAINT chk_gm_item_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_gm_item_item_type CHECK (item_type IN ('WEAPON', 'ARMOR', 'CONSUMABLE', 'MATERIAL')),
    CONSTRAINT chk_gm_item_appearance_code CHECK (appearance_code IS NULL OR appearance_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
    CONSTRAINT chk_gm_item_status CHECK (status IN ('DRAFT', 'ACT', 'INACTIVE')),
    CONSTRAINT chk_gm_item_equip_slot_code CHECK (
        (item_type = 'WEAPON' AND equip_slot_code IS NOT NULL AND equip_slot_code = 'WEAPON' AND appearance_code IS NOT NULL)
        OR (item_type = 'ARMOR' AND equip_slot_code IS NOT NULL AND equip_slot_code <> 'WEAPON')
        OR (item_type IN ('CONSUMABLE', 'MATERIAL') AND equip_slot_code IS NULL))
);
COMMENT ON TABLE gm_item IS '아이템 정의';
COMMENT ON COLUMN gm_item.item_id IS '아이템 고유 번호';
COMMENT ON COLUMN gm_item.item_code IS '아이템 고유 코드';
COMMENT ON COLUMN gm_item.name IS '아이템 이름';
COMMENT ON COLUMN gm_item.description IS '아이템 설명';
COMMENT ON COLUMN gm_item.item_type IS '아이템 종류(무기, 방어구, 소모품, 재료)';
COMMENT ON COLUMN gm_item.equip_slot_code IS '장착 가능 슬롯 코드';
COMMENT ON COLUMN gm_item.appearance_code IS '외형 이미지 코드';
COMMENT ON COLUMN gm_item.status IS '관리 상태(작성 중, 사용 중, 사용 중지)';
COMMENT ON COLUMN gm_item.reg_dtm IS '등록 일자';
COMMENT ON COLUMN gm_item.mod_dtm IS '수정 일자';

CREATE TABLE gm_character_item (
    character_item_id UUID PRIMARY KEY,
    character_id UUID NOT NULL,
    item_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gm_character_item_character_id FOREIGN KEY (character_id) REFERENCES gm_character (character_id),
    CONSTRAINT fk_gm_character_item_item_id FOREIGN KEY (item_id) REFERENCES gm_item (item_id),
    CONSTRAINT uq_gm_character_item_character_id_character_item_id UNIQUE (character_id, character_item_id),
    CONSTRAINT chk_gm_character_item_quantity CHECK (quantity > 0)
);
COMMENT ON TABLE gm_character_item IS '캐릭터가 보유한 아이템';
COMMENT ON COLUMN gm_character_item.character_item_id IS '보유 아이템 고유 번호';
COMMENT ON COLUMN gm_character_item.character_id IS '보유 캐릭터 고유 번호';
COMMENT ON COLUMN gm_character_item.item_id IS '아이템 정의 고유 번호';
COMMENT ON COLUMN gm_character_item.quantity IS '보유 수량(장착 무기는 한 행에 한 개)';
COMMENT ON COLUMN gm_character_item.reg_dtm IS '획득 일자';
COMMENT ON COLUMN gm_character_item.mod_dtm IS '수정 일자';

CREATE TABLE gm_character_equipment (
    character_equipment_id UUID PRIMARY KEY,
    character_id UUID NOT NULL,
    slot_code VARCHAR(20) NOT NULL,
    character_item_id UUID NOT NULL,
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gm_character_equipment_character_id_character_item_id FOREIGN KEY (character_id, character_item_id)
        REFERENCES gm_character_item (character_id, character_item_id),
    CONSTRAINT uq_gm_character_equipment_character_id_slot_code UNIQUE (character_id, slot_code),
    CONSTRAINT uq_gm_character_equipment_character_item_id UNIQUE (character_item_id),
    CONSTRAINT chk_gm_character_equipment_slot_code CHECK (BTRIM(slot_code) <> '')
);
COMMENT ON TABLE gm_character_equipment IS '캐릭터 슬롯별 장착 아이템';
COMMENT ON COLUMN gm_character_equipment.character_equipment_id IS '장착 정보 고유 번호';
COMMENT ON COLUMN gm_character_equipment.character_id IS '장착 캐릭터 고유 번호';
COMMENT ON COLUMN gm_character_equipment.slot_code IS '장착 슬롯 코드(무기는 WEAPON)';
COMMENT ON COLUMN gm_character_equipment.character_item_id IS '장착한 보유 아이템 고유 번호';
COMMENT ON COLUMN gm_character_equipment.reg_dtm IS '등록 일자';
COMMENT ON COLUMN gm_character_equipment.mod_dtm IS '수정 일자';

INSERT INTO gm_item (item_id, item_code, name, description, item_type, equip_slot_code, appearance_code)
VALUES ('20000000-0000-4000-8000-000000000001', 'wooden-club', '몽둥이', '모험을 시작할 때 지급하는 기본 무기', 'WEAPON', 'WEAPON', 'wooden-club');

INSERT INTO gm_character_item (character_item_id, character_id, item_id)
SELECT gen_random_uuid(), g.character_id, i.item_id
FROM gm_character g CROSS JOIN gm_item i WHERE i.item_code = 'wooden-club';

INSERT INTO gm_character_equipment (character_equipment_id, character_id, slot_code, character_item_id)
SELECT gen_random_uuid(), ci.character_id, 'WEAPON', ci.character_item_id
FROM gm_character_item ci JOIN gm_item i ON i.item_id = ci.item_id WHERE i.item_code = 'wooden-club';
