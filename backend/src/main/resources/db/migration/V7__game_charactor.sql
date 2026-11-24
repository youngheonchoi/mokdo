-- 캐릭터 삭제는 행을 제거하지 않고 상태값으로 처리한다.
ALTER TABLE game_character
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD CONSTRAINT chk_game_character_status CHECK (status IN ('ACTIVE', 'DELETED'));

COMMENT ON COLUMN game_character.status IS '캐릭터 상태 (ACTIVE: 활성, DELETED: 삭제)';

-- 삭제된 캐릭터의 슬롯은 새 캐릭터가 다시 사용할 수 있다.
ALTER TABLE game_character DROP CONSTRAINT uq_game_character_account_slot;
CREATE UNIQUE INDEX uq_game_character_active_account_slot
    ON game_character (account_id, slot_no) WHERE status = 'ACTIVE';

-- 활성 캐릭터의 닉네임은 전체 사용자 사이에서 영문 대소문자 구분 없이 유일하다.
-- 삭제된 닉네임은 재사용할 수 있다. 기존 활성 닉네임의 중복이 있다면 먼저 정리해야 한다.
CREATE UNIQUE INDEX uq_game_character_active_name
    ON game_character (LOWER(BTRIM(name))) WHERE status = 'ACTIVE';
