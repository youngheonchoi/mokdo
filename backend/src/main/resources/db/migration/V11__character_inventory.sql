-- character_inventory 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 기타 및 소모품만 저장하며 장비는 character_item에서 개별 관리한다.
-- 아이템 분류와 max_stack에 따른 보유 한도는 서버에서 검증한다.

CREATE TABLE character_inventory (
    character_id UUID NOT NULL,
    item_code VARCHAR(64) NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_character_inventory PRIMARY KEY (character_id, item_code),
    CONSTRAINT fk_character_inventory_character FOREIGN KEY (character_id)
        REFERENCES game_character (id) ON DELETE CASCADE,
    CONSTRAINT fk_character_inventory_item FOREIGN KEY (item_code)
        REFERENCES item (item_code) ON DELETE RESTRICT,
    CONSTRAINT chk_character_inventory_quantity CHECK (quantity BETWEEN 1 AND 99999999)
);

COMMENT ON TABLE character_inventory IS '캐릭터별 소모품 및 재료의 보유 수량. 장비는 장착 여부와 무관하게 character_item에서 개별 관리하며 골드는 character_progress에서 관리한다';
COMMENT ON COLUMN character_inventory.character_id IS '아이템을 보유한 캐릭터 식별자';
COMMENT ON COLUMN character_inventory.item_code IS '보유 소모품 또는 재료의 아이템 코드. 장비를 이 테이블에 중복 저장하지 않도록 서버에서 검증한다';
COMMENT ON COLUMN character_inventory.quantity IS '가방 보유 수량. 아이템별 max_stack 이하인지 서버에서 추가 검증한다';
COMMENT ON COLUMN character_inventory.created_at IS '해당 가방 행 생성 일시. 전량 소진 후 재획득하면 새로 생성된다';
COMMENT ON COLUMN character_inventory.updated_at IS '보유 수량 최종 수정 일시';

CREATE INDEX idx_character_inventory_item ON character_inventory (item_code);
