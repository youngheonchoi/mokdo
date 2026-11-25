-- item 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 골드는 아이템으로 등록하지 않고 character_progress에서 관리한다.

CREATE TABLE item (
    item_code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    rarity VARCHAR(20) NOT NULL DEFAULT 'COMMON',
    equipment_slot VARCHAR(20),
    description TEXT,
    buy_price BIGINT NOT NULL DEFAULT 0,
    sell_price BIGINT NOT NULL DEFAULT 0,
    max_stack INTEGER NOT NULL DEFAULT 99999999,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_item_code
        CHECK (item_code = BTRIM(item_code) AND item_code <> '' AND item_code <> 'gold'),
    CONSTRAINT chk_item_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_item_category CHECK (category IN ('misc', 'consumable', 'equipment')),
    CONSTRAINT fk_item_rarity FOREIGN KEY (rarity)
        REFERENCES item_rarity (code) ON DELETE RESTRICT,
    CONSTRAINT chk_item_equipment_slot CHECK (
        (category = 'equipment' AND equipment_slot IS NOT NULL AND equipment_slot IN (
            'head', 'armor', 'gloves', 'shoes', 'weapon', 'offhand', 'earring', 'necklace', 'ring'
        )) OR (category <> 'equipment' AND equipment_slot IS NULL)
    ),
    CONSTRAINT chk_item_prices CHECK (buy_price >= 0 AND sell_price >= 0),
    CONSTRAINT chk_item_max_stack CHECK (max_stack BETWEEN 1 AND 99999999),
    CONSTRAINT chk_item_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    -- 장착 테이블에서 아이템에 정의된 부위까지 함께 검증하기 위한 참조 키.
    CONSTRAINT uq_item_code_slot UNIQUE (item_code, equipment_slot),
    -- 퀵슬롯 테이블에서 소모품 여부까지 함께 검증하기 위한 참조 키.
    CONSTRAINT uq_item_code_category UNIQUE (item_code, category)
);

COMMENT ON TABLE item IS '아이템 기준정보. 사용 중인 아이템은 삭제 대신 비활성 처리하며 골드는 별도로 관리한다';
COMMENT ON COLUMN item.item_code IS '아이템 고유 코드. 프런트엔드 아이템 코드와 동일하게 사용하며 골드 코드는 등록하지 않는다';
COMMENT ON COLUMN item.name IS '아이템 표시 이름';
COMMENT ON COLUMN item.category IS '아이템 분류 (misc: 기타, consumable: 소모품, equipment: 장비)';
COMMENT ON COLUMN item.rarity IS '아이템 희귀도 코드. item_rarity를 참조하여 희귀도 표시 이름, 아이템명 색상 및 정렬 순서를 결정한다';
COMMENT ON COLUMN item.equipment_slot IS '장착 부위 (head: 머리, armor: 전신 갑옷, gloves: 장갑, shoes: 신발, weapon: 무기, offhand: 보조무기, earring: 귀걸이, necklace: 목걸이, ring: 반지). 장비 이외에는 NULL';
COMMENT ON COLUMN item.description IS '아이템 상세 설명';
COMMENT ON COLUMN item.buy_price IS '아이템 1개당 기본 구매 가격. 0은 무료 가격이며 상점 판매 여부는 별도 판매 목록에서 판단한다';
COMMENT ON COLUMN item.sell_price IS '아이템 1개당 기본 판매 가격';
COMMENT ON COLUMN item.max_stack IS '캐릭터 가방에서 해당 아이템 코드별로 보유 가능한 최대 수량. 지급 시 서버에서 검증한다';
COMMENT ON COLUMN item.status IS '아이템 운영 상태 (ACTIVE: 사용 가능, INACTIVE: 비활성). 거래 및 사용 가능 여부는 서버에서 검증한다';
COMMENT ON COLUMN item.created_at IS '아이템 기준정보 생성 일시';
COMMENT ON COLUMN item.updated_at IS '아이템 기준정보 최종 수정 일시';

CREATE INDEX idx_item_rarity ON item (rarity);
