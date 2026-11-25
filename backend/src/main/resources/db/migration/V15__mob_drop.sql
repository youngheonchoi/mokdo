-- mob_drop 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 각 아이템과 각 추첨은 독립적으로 판정한다.
-- 여러 아이템 중 하나만 선택하는 드롭이 필요하면 선택 그룹 구조를 별도로 추가한다.

CREATE TABLE mob_drop (
    mob_code VARCHAR(64) NOT NULL,
    item_code VARCHAR(64) NOT NULL,
    drop_probability NUMERIC(9, 8) NOT NULL,
    min_quantity INTEGER NOT NULL DEFAULT 1,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    roll_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_mob_drop PRIMARY KEY (mob_code, item_code),
    CONSTRAINT fk_mob_drop_mob FOREIGN KEY (mob_code)
        REFERENCES mob (mob_code) ON DELETE RESTRICT,
    CONSTRAINT fk_mob_drop_item FOREIGN KEY (item_code)
        REFERENCES item (item_code) ON DELETE RESTRICT,
    CONSTRAINT chk_mob_drop_probability CHECK (drop_probability BETWEEN 0 AND 1),
    CONSTRAINT chk_mob_drop_quantity CHECK (
        min_quantity >= 1 AND max_quantity >= min_quantity AND max_quantity <= 99999999
    ),
    CONSTRAINT chk_mob_drop_roll_count CHECK (roll_count >= 1),
    CONSTRAINT chk_mob_drop_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE mob_drop IS '몹별 아이템 드롭 설정. 각 아이템과 각 추첨은 독립적으로 판정하며 골드는 mob의 골드 범위로 별도 관리한다';
COMMENT ON COLUMN mob_drop.mob_code IS '처치 보상의 기준이 되는 몹 코드';
COMMENT ON COLUMN mob_drop.item_code IS '드롭할 아이템 코드. 지급 시 아이템의 활성 상태와 캐릭터 보유 한도를 서버에서 검증한다';
COMMENT ON COLUMN mob_drop.drop_probability IS '추첨 1회당 드롭 확률 (0: 미드롭, 0.2: 20퍼센트, 1: 확정 드롭). 아이템 간 확률 합계는 1로 제한하지 않는다';
COMMENT ON COLUMN mob_drop.min_quantity IS '드롭 성공 1회당 지급 수량의 최솟값';
COMMENT ON COLUMN mob_drop.max_quantity IS '드롭 성공 1회당 지급 수량의 최댓값. 양 끝을 포함한 범위에서 서버가 결정한다';
COMMENT ON COLUMN mob_drop.roll_count IS '몹 1마리 처치 시 해당 아이템의 독립 추첨 횟수. 성공한 추첨마다 수량을 결정한다';
COMMENT ON COLUMN mob_drop.status IS '드롭 설정 상태 (ACTIVE: 적용, INACTIVE: 미적용)';
COMMENT ON COLUMN mob_drop.created_at IS '드롭 설정 생성 일시';
COMMENT ON COLUMN mob_drop.updated_at IS '드롭 설정 최종 수정 일시';

CREATE INDEX idx_mob_drop_item ON mob_drop (item_code);
