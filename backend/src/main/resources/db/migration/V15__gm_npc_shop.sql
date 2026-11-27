CREATE TABLE gm_npc (
    npc_id UUID CONSTRAINT pk_gm_npc PRIMARY KEY,
    npc_code VARCHAR(64) NOT NULL CONSTRAINT uq_gm_npc_npc_code UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    dialogue TEXT NOT NULL DEFAULT '',
    image_key VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_gm_npc_npc_code CHECK (npc_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
    CONSTRAINT chk_gm_npc_name CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_gm_npc_status CHECK (status IN ('DRAFT', 'ACT', 'INACTIVE'))
);

CREATE TABLE gm_npc_shop_item (
    npc_shop_item_id UUID CONSTRAINT pk_gm_npc_shop_item PRIMARY KEY,
    npc_id UUID NOT NULL,
    item_id UUID NOT NULL,
    price BIGINT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    sale_status VARCHAR(20) NOT NULL DEFAULT 'ACT',
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gm_npc_shop_item_npc_id FOREIGN KEY (npc_id) REFERENCES gm_npc(npc_id),
    CONSTRAINT fk_gm_npc_shop_item_item_id FOREIGN KEY (item_id) REFERENCES gm_item(item_id),
    CONSTRAINT uq_gm_npc_shop_item_npc_id_item_id UNIQUE (npc_id, item_id),
    CONSTRAINT chk_gm_npc_shop_item_price CHECK (price >= 0),
    CONSTRAINT chk_gm_npc_shop_item_sort_order CHECK (sort_order >= 0),
    CONSTRAINT chk_gm_npc_shop_item_sale_status CHECK (sale_status IN ('ACT', 'INACTIVE'))
);
CREATE INDEX idx_gm_npc_shop_item_item_id ON gm_npc_shop_item(item_id);

COMMENT ON TABLE gm_npc IS 'NPC 정의';
COMMENT ON COLUMN gm_npc.npc_id IS 'NPC ID';
COMMENT ON COLUMN gm_npc.npc_code IS '고유 NPC 코드';
COMMENT ON COLUMN gm_npc.name IS '이름';
COMMENT ON COLUMN gm_npc.description IS '설명';
COMMENT ON COLUMN gm_npc.dialogue IS '대화 문구';
COMMENT ON COLUMN gm_npc.image_key IS '스토리지 PNG 외형 에셋 경로';
COMMENT ON COLUMN gm_npc.status IS '관리 상태(DRAFT, ACT, INACTIVE)';
COMMENT ON COLUMN gm_npc.reg_dtm IS '등록 일시';
COMMENT ON COLUMN gm_npc.mod_dtm IS '수정 일시';
COMMENT ON TABLE gm_npc_shop_item IS 'NPC별 판매 아이템 정의';
COMMENT ON COLUMN gm_npc_shop_item.npc_shop_item_id IS 'NPC 판매 아이템 ID';
COMMENT ON COLUMN gm_npc_shop_item.npc_id IS 'NPC ID';
COMMENT ON COLUMN gm_npc_shop_item.item_id IS '판매 아이템 ID';
COMMENT ON COLUMN gm_npc_shop_item.price IS '아이템 1개당 판매 가격(기본 재화)';
COMMENT ON COLUMN gm_npc_shop_item.sort_order IS '표시 순서(작은 값 우선)';
COMMENT ON COLUMN gm_npc_shop_item.sale_status IS '판매 상태(ACT: 판매 중, INACTIVE: 판매 중지)';
COMMENT ON COLUMN gm_npc_shop_item.reg_dtm IS '등록 일시';
COMMENT ON COLUMN gm_npc_shop_item.mod_dtm IS '수정 일시';
