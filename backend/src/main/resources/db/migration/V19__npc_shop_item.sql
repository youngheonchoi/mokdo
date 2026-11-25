-- npc_shop_item 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 거래 시 NPC, 배치, 상품 및 아이템의 활성 상태를 검증한다.
-- 상점 장비는 최소 능력치를 사용하며 장비 1개마다 character_item에 행을 생성한다.
-- 소모품 및 기타 구매는 character_inventory의 수량을 증가시킨다.
-- 골드 증감과 아이템 지급 또는 회수는 같은 트랜잭션으로 처리하고 중복 거래를 방지한다.

CREATE TABLE npc_shop_item (
    id UUID PRIMARY KEY,
    npc_code VARCHAR(64) NOT NULL,
    npc_type VARCHAR(20) NOT NULL DEFAULT 'MERCHANT',
    item_code VARCHAR(64) NOT NULL,
    price BIGINT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_npc_shop_item_npc_type CHECK (npc_type = 'MERCHANT'),
    CONSTRAINT fk_npc_shop_item_merchant FOREIGN KEY (npc_code, npc_type)
        REFERENCES npc (npc_code, type) ON DELETE RESTRICT,
    CONSTRAINT fk_npc_shop_item_item FOREIGN KEY (item_code)
        REFERENCES item (item_code) ON DELETE RESTRICT,
    CONSTRAINT uq_npc_shop_item_product UNIQUE (npc_code, item_code),
    CONSTRAINT chk_npc_shop_item_price CHECK (price >= 0),
    CONSTRAINT chk_npc_shop_item_sort CHECK (sort_order >= 0),
    CONSTRAINT chk_npc_shop_item_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE npc_shop_item IS '상인이 플레이어에게 판매하는 상품 목록. 상인마다 같은 아이템의 판매가를 다르게 설정할 수 있으며 현재는 재고 제한 없는 판매를 전제로 한다';
COMMENT ON COLUMN npc_shop_item.id IS '판매 상품 식별자. 애플리케이션에서 UUID를 생성한다';
COMMENT ON COLUMN npc_shop_item.npc_code IS '상품을 판매하는 상인 NPC 코드';
COMMENT ON COLUMN npc_shop_item.npc_type IS '상인 NPC만 상품을 등록하도록 복합 외래 키로 검증하는 고정 유형값 (MERCHANT)';
COMMENT ON COLUMN npc_shop_item.item_code IS '판매 아이템 코드. 장비이면 구매 처리 시 item_equipment의 최소 능력치를 확정하여 character_item에 저장한다';
COMMENT ON COLUMN npc_shop_item.price IS '플레이어가 상품 1개를 구매할 때 지불하는 골드. item.buy_price보다 우선하는 실제 판매가이며 0이면 무료이다';
COMMENT ON COLUMN npc_shop_item.sort_order IS '상점 내 상품 표시 순서. 작은 값부터 표시하며 동순위는 상품 식별자로 정렬한다';
COMMENT ON COLUMN npc_shop_item.status IS '상품 판매 상태 (ACTIVE: 판매 중, INACTIVE: 판매 중지)';
COMMENT ON COLUMN npc_shop_item.created_at IS '판매 상품 등록 일시';
COMMENT ON COLUMN npc_shop_item.updated_at IS '판매 상품 정보 최종 수정 일시';

CREATE INDEX idx_npc_shop_item_item ON npc_shop_item (item_code);
