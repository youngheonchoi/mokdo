-- character_item 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 가방에 보관 중이거나 장착 중인 모든 소유 장비를 개별 행으로 관리한다.
-- 장비 줍기 처리: 드롭 유효성과 소유권 확인 → 능력치 1회 확정 → character_item 저장.
-- 줍기와 인벤토리 등록을 일관되게 처리하고 동일 드롭의 중복 획득을 방지한다.
-- 장비 생성 시 추첨 범위를 검증하며 강화, 패시브 및 버프는 기본 능력치에 포함하지 않는다.

CREATE TABLE character_item (
    id UUID PRIMARY KEY,
    character_id UUID NOT NULL,
    item_code VARCHAR(64) NOT NULL,
    attack BIGINT NOT NULL,
    max_hp BIGINT NOT NULL,
    defense BIGINT NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_character_item_character FOREIGN KEY (character_id)
        REFERENCES game_character (id) ON DELETE CASCADE,
    CONSTRAINT fk_character_item_equipment FOREIGN KEY (item_code)
        REFERENCES item_equipment (item_code) ON DELETE RESTRICT,
    CONSTRAINT chk_character_item_attack CHECK (attack >= 0),
    CONSTRAINT chk_character_item_max_hp CHECK (max_hp >= 0),
    CONSTRAINT chk_character_item_defense CHECK (defense >= 0),
    -- 장착 시 개별 장비, 소유 캐릭터 및 아이템 종류를 함께 검증한다.
    CONSTRAINT uq_character_item_owner_code UNIQUE (id, character_id, item_code)
);

COMMENT ON TABLE character_item IS '캐릭터의 개별 장비 인벤토리. 줍기 처리에서 확정한 능력치와 UUID를 저장하며 1행은 장비 1개이다. 가방에 있는 상태부터 능력치가 확정되어 있고 장착 후에도 같은 행을 사용한다';
COMMENT ON COLUMN character_item.id IS '개별 장비 식별자. 획득 시 애플리케이션에서 UUID를 생성하며 장착, 해제 및 판매 시 이 값으로 장비를 구분한다';
COMMENT ON COLUMN character_item.character_id IS '개별 장비를 소유한 캐릭터 식별자';
COMMENT ON COLUMN character_item.item_code IS '장비 종류 코드. item_equipment를 통해 장비 기준정보를 참조한다';
COMMENT ON COLUMN character_item.attack IS '획득 시 인벤토리 등록 전에 확정한 추가 기본 공격력. 드롭 장비는 범위에서 한 번 추첨하고 상점 장비는 최솟값을 사용한다. 장착, 해제 및 재접속 시 다시 추첨하지 않는다';
COMMENT ON COLUMN character_item.max_hp IS '획득 시 인벤토리 등록 전에 확정한 추가 기본 최대 체력. 드롭 장비는 범위에서 한 번 추첨하고 상점 장비는 최솟값을 사용한다. 현재 체력 회복량이 아니다';
COMMENT ON COLUMN character_item.defense IS '획득 시 인벤토리 등록 전에 확정한 추가 기본 방어력. 드롭 장비는 범위에서 한 번 추첨하고 상점 장비는 최솟값을 사용하며 장착 시 다시 추첨하지 않는다';
COMMENT ON COLUMN character_item.acquired_at IS '해당 개별 장비를 획득한 일시';
COMMENT ON COLUMN character_item.updated_at IS '개별 장비 정보 최종 수정 일시';

CREATE INDEX idx_character_item_owner_code ON character_item (character_id, item_code);
CREATE INDEX idx_character_item_code ON character_item (item_code);
