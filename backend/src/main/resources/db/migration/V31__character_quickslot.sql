-- character_quickslot 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 아이템 등록 및 사용 시 보유 수량을, 스킬 등록 및 사용 시 해금 조건을 서버에서 확인한다.
-- 소모품을 모두 사용해도 퀵슬롯 설정은 유지하며 수량을 중복 저장하지 않는다.

CREATE TABLE character_quickslot (
    character_id UUID NOT NULL,
    slot_no SMALLINT NOT NULL,
    slot_type VARCHAR(20) NOT NULL DEFAULT 'ITEM',
    item_code VARCHAR(64),
    item_category VARCHAR(20),
    skill_code VARCHAR(64),
    skill_type VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_character_quickslot PRIMARY KEY (character_id, slot_no),
    CONSTRAINT fk_character_quickslot_character FOREIGN KEY (character_id)
        REFERENCES game_character (id) ON DELETE CASCADE,
    -- 아이템 등록은 소모품으로 제한하며 스킬 등록 시 아이템 참조는 NULL이다.
    CONSTRAINT fk_character_quickslot_item_category FOREIGN KEY (item_code, item_category)
        REFERENCES item (item_code, category) ON DELETE RESTRICT,
    CONSTRAINT chk_character_quickslot_no CHECK (slot_no BETWEEN 1 AND 10),
    CONSTRAINT chk_character_quickslot_target CHECK (
        (slot_type = 'ITEM' AND item_code IS NOT NULL
            AND item_category IS NOT NULL AND item_category = 'consumable'
            AND skill_code IS NULL AND skill_type IS NULL)
        OR (slot_type = 'SKILL' AND item_code IS NULL AND item_category IS NULL
            AND skill_code IS NOT NULL AND skill_type IS NOT NULL AND skill_type IN ('ACTIVE', 'BUFF'))
    ),
    CONSTRAINT fk_character_quickslot_skill FOREIGN KEY (skill_code, skill_type)
        REFERENCES skill (skill_code, type) ON DELETE RESTRICT
);

COMMENT ON TABLE character_quickslot IS '캐릭터별 소모품 또는 사용형 스킬 퀵슬롯 설정. 패시브는 등록하지 않으며 현재 사용할 수 없는 스킬도 설정은 보존한다';
COMMENT ON COLUMN character_quickslot.character_id IS '퀵슬롯 설정의 소유 캐릭터 식별자';
COMMENT ON COLUMN character_quickslot.slot_no IS '퀵슬롯 번호 (1~10: Q, W, E, R, T, A, S, D, F, G 순서). 프런트엔드 배열 인덱스에 1을 더한 값';
COMMENT ON COLUMN character_quickslot.item_code IS 'ITEM일 때 등록한 소모품 코드. 소진 후에도 설정을 유지하며 SKILL이면 NULL';
COMMENT ON COLUMN character_quickslot.item_category IS 'ITEM이면 consumable, SKILL이면 NULL. 복합 외래 키로 소모품만 등록하도록 검증한다';
COMMENT ON COLUMN character_quickslot.created_at IS '해당 퀵슬롯 행 생성 일시';
COMMENT ON COLUMN character_quickslot.updated_at IS '퀵슬롯 등록 대상 최종 수정 일시';

COMMENT ON COLUMN character_quickslot.slot_type IS '등록 대상 구분 (ITEM: 소모품, SKILL: 액티브 또는 버프 스킬)';
COMMENT ON COLUMN character_quickslot.skill_code IS 'SKILL일 때 등록한 스킬 코드. 등록 시 자동 해금 조건을 서버에서 확인하며 ITEM이면 NULL';
COMMENT ON COLUMN character_quickslot.skill_type IS '등록 스킬의 구분 ACTIVE 또는 BUFF. 복합 외래 키로 실제 스킬 구분과 일치시킨다';

CREATE INDEX idx_character_quickslot_item_category ON character_quickslot (item_code, item_category);
CREATE INDEX idx_character_quickslot_skill ON character_quickslot (skill_code, skill_type);

-- 특성 변경 시 등록을 삭제하지 않고 비활성 표시한다. 사용 요청마다 특성과 보조무기 조건을 재검증한다.
-- ITEM 등록 시 item_category도 consumable로 명시해야 하며 SKILL 등록 시 아이템 관련 두 값은 NULL로 저장한다.
