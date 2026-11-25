-- npc_shop_buy_rule 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 판매 상품 목록과 매입 규칙은 독립적이며 활성 규칙이 없으면 매입하지 않는다.
-- 매입 단가는 item.sell_price를 사용한다.
-- 장비 판매 시 소유권을 확인하고 장착 중인 장비는 판매할 수 없도록 처리한다.

CREATE TABLE npc_shop_buy_rule (
    id UUID PRIMARY KEY,
    npc_code VARCHAR(64) NOT NULL,
    npc_type VARCHAR(20) NOT NULL DEFAULT 'MERCHANT',
    item_category VARCHAR(20) NOT NULL,
    equipment_slot VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_npc_shop_buy_rule_npc_type CHECK (npc_type = 'MERCHANT'),
    CONSTRAINT fk_npc_shop_buy_rule_merchant FOREIGN KEY (npc_code, npc_type)
        REFERENCES npc (npc_code, type) ON DELETE RESTRICT,
    CONSTRAINT chk_npc_shop_buy_rule_category CHECK (item_category IN ('misc', 'consumable', 'equipment')),
    CONSTRAINT chk_npc_shop_buy_rule_slot CHECK (
        (item_category = 'equipment' AND equipment_slot IS NOT NULL AND equipment_slot IN (
            'head', 'armor', 'gloves', 'shoes', 'weapon', 'offhand', 'earring', 'necklace', 'ring'
        )) OR (item_category <> 'equipment' AND equipment_slot IS NULL)
    ),
    CONSTRAINT chk_npc_shop_buy_rule_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE npc_shop_buy_rule IS '상인이 플레이어로부터 매입하는 아이템 범위. 판매 상품 목록과 독립적이며 활성 규칙이 없으면 매입하지 않는다. 매입 단가는 item.sell_price를 사용한다';
COMMENT ON COLUMN npc_shop_buy_rule.id IS '매입 규칙 식별자. 애플리케이션에서 UUID를 생성한다';
COMMENT ON COLUMN npc_shop_buy_rule.npc_code IS '아이템을 매입하는 상인 NPC 코드';
COMMENT ON COLUMN npc_shop_buy_rule.npc_type IS '상인 NPC만 매입 규칙을 등록하도록 복합 외래 키로 검증하는 고정 유형값 (MERCHANT)';
COMMENT ON COLUMN npc_shop_buy_rule.item_category IS '매입 대상 분류 (misc: 기타, consumable: 소모품, equipment: 장비). 여러 분류를 매입하면 분류별로 등록한다';
COMMENT ON COLUMN npc_shop_buy_rule.equipment_slot IS '매입 가능한 장비 부위. 장비 분류이면 부위별로 등록하고 기타 및 소모품이면 NULL이다';
COMMENT ON COLUMN npc_shop_buy_rule.status IS '매입 규칙 상태 (ACTIVE: 매입 허용, INACTIVE: 매입 중지)';
COMMENT ON COLUMN npc_shop_buy_rule.created_at IS '매입 규칙 등록 일시';
COMMENT ON COLUMN npc_shop_buy_rule.updated_at IS '매입 규칙 최종 수정 일시';

CREATE UNIQUE INDEX uq_npc_shop_buy_rule_category
    ON npc_shop_buy_rule (npc_code, item_category) WHERE equipment_slot IS NULL;
CREATE UNIQUE INDEX uq_npc_shop_buy_rule_slot
    ON npc_shop_buy_rule (npc_code, equipment_slot) WHERE equipment_slot IS NOT NULL;
