-- item_effect 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 소모품 수량은 효과 개수와 관계없이 1회 사용당 1개만 차감한다.
-- 소유권, 활성 상태 및 수량을 검증하고 수량 차감과 효과 반영을 일관되게 처리한다.
-- 버프 중복, 갱신, 비율 적용 기준, 반올림 및 만료 규칙은 서버에서 정의한다.
-- 재접속 후에도 유지할 버프가 필요하면 적용 효과와 만료 시각을 별도 테이블에 저장한다.

CREATE TABLE item_effect (
    item_code VARCHAR(64) NOT NULL,
    effect_no SMALLINT NOT NULL,
    item_category VARCHAR(20) NOT NULL DEFAULT 'consumable',
    effect_type VARCHAR(32) NOT NULL,
    value NUMERIC(18, 4) NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_item_effect PRIMARY KEY (item_code, effect_no),
    CONSTRAINT chk_item_effect_no CHECK (effect_no >= 1),
    CONSTRAINT chk_item_effect_category CHECK (item_category = 'consumable'),
    CONSTRAINT fk_item_effect_item_category FOREIGN KEY (item_code, item_category)
        REFERENCES item (item_code, category) ON DELETE RESTRICT,
    CONSTRAINT chk_item_effect_type CHECK (effect_type IN (
        'HEAL_HP', 'ATTACK_UP', 'ATTACK_UP_PERCENT',
        'MAX_HP_UP', 'MAX_HP_UP_PERCENT', 'DEFENSE_UP', 'DEFENSE_UP_PERCENT'
    )),
    CONSTRAINT chk_item_effect_value CHECK (value > 0),
    -- 고정 수치 효과는 정수로, 비율 효과는 소수점 이하까지 입력할 수 있다.
    CONSTRAINT chk_item_effect_fixed_value CHECK (
        effect_type IN ('ATTACK_UP_PERCENT', 'MAX_HP_UP_PERCENT', 'DEFENSE_UP_PERCENT')
        OR value = TRUNC(value)
    ),
    -- 즉시 회복은 지속시간이 없고 능력치 증가 효과에는 양수의 지속시간이 필요하다.
    CONSTRAINT chk_item_effect_duration CHECK (
        (effect_type = 'HEAL_HP' AND duration_seconds IS NULL)
        OR (effect_type <> 'HEAL_HP' AND duration_seconds IS NOT NULL AND duration_seconds > 0)
    )
);

COMMENT ON TABLE item_effect IS '소모품별 사용 효과 정의. 하나의 아이템에 여러 효과를 등록하고 effect_no 순서로 처리한다. 실제 적용 중인 캐릭터 버프 상태는 저장하지 않는다';
COMMENT ON COLUMN item_effect.item_code IS '효과가 적용되는 소모품 아이템 코드. 효과가 여러 행이어도 아이템 1회 사용 시 수량은 1개만 차감한다';
COMMENT ON COLUMN item_effect.effect_no IS '아이템 내 효과 식별 번호 및 처리 순서. 1 이상의 정수이며 같은 아이템 내에서 중복할 수 없다';
COMMENT ON COLUMN item_effect.item_category IS '소모품에만 사용 효과를 등록하도록 복합 외래 키로 검증하는 고정 분류값 (consumable)';
COMMENT ON COLUMN item_effect.effect_type IS '효과 종류 (HEAL_HP: 즉시 체력 회복, ATTACK_UP: 공격력 고정 증가, ATTACK_UP_PERCENT: 공격력 비율 증가, MAX_HP_UP: 최대 체력 고정 증가, MAX_HP_UP_PERCENT: 최대 체력 비율 증가, DEFENSE_UP: 방어력 고정 증가, DEFENSE_UP_PERCENT: 방어력 비율 증가)';
COMMENT ON COLUMN item_effect.value IS '효과 수치. 고정 효과는 양의 정수, 비율 효과는 퍼센트 단위로 저장한다 (10은 10퍼센트, 2.5는 2.5퍼센트). 체력 회복은 최종 최대 체력을 초과하지 않도록 서버에서 제한한다';
COMMENT ON COLUMN item_effect.duration_seconds IS '능력치 증가 효과의 지속시간 (초). 양의 정수이며 즉시 체력 회복 효과는 NULL';
COMMENT ON COLUMN item_effect.created_at IS '소모품 효과 정의 생성 일시';
COMMENT ON COLUMN item_effect.updated_at IS '소모품 효과 정의 최종 수정 일시';
