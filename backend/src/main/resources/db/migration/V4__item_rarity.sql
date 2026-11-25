-- item_rarity 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 아이템을 등록하기 전에 참조할 희귀도를 먼저 등록한다.

CREATE TABLE item_rarity (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    name_color VARCHAR(7) NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_item_rarity_code CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT chk_item_rarity_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_item_rarity_name_color CHECK (name_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_item_rarity_sort_order CHECK (sort_order >= 0),
    CONSTRAINT uq_item_rarity_sort_order UNIQUE (sort_order)
);

COMMENT ON TABLE item_rarity IS '아이템 희귀도 기준정보. 희귀도별 표시 이름, 아이템명 색상 및 정렬 순서를 관리한다';
COMMENT ON COLUMN item_rarity.code IS '희귀도 고유 코드. COMMON, RARE, HEROIC 등 영문 대문자, 숫자 및 밑줄을 사용하며 영문 대문자로 시작한다';
COMMENT ON COLUMN item_rarity.name IS '희귀도 표시 이름. 일반, 희귀, 영웅 등 화면에 표시할 명칭';
COMMENT ON COLUMN item_rarity.name_color IS '아이템 이름에 적용할 색상. #FFFFFF 형식의 6자리 16진수 색상 코드이며 실제 적용은 화면에서 처리한다';
COMMENT ON COLUMN item_rarity.sort_order IS '희귀도 표시 순서. 0 이상이며 작은 값부터 정렬하고 희귀도 사이에 중복을 허용하지 않는다';
COMMENT ON COLUMN item_rarity.created_at IS '희귀도 기준정보 생성 일시';
COMMENT ON COLUMN item_rarity.updated_at IS '희귀도 기준정보 최종 수정 일시';
