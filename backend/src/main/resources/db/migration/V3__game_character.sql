-- game_character 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 캐릭터 삭제는 status를 DELETED로 변경하며 자식 데이터를 보존한다.
-- 실제 행 삭제 시에만 자식 테이블의 ON DELETE CASCADE가 적용된다.
-- 활성 캐릭터의 슬롯과 이름은 유일하며 삭제된 캐릭터의 슬롯과 이름은 재사용할 수 있다.

CREATE TABLE game_character (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    slot_no SMALLINT NOT NULL,
    name TEXT NOT NULL,
    appearance_code VARCHAR(64),
    intro_completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_game_character_account
        FOREIGN KEY (account_id)
        REFERENCES account (id)
        ON DELETE CASCADE,
    CONSTRAINT chk_game_character_status CHECK (status IN ('ACTIVE', 'DELETED')),
    CONSTRAINT chk_game_character_slot_no
        CHECK (slot_no > 0),
    CONSTRAINT chk_game_character_name
        CHECK (BTRIM(name) <> '')
);

COMMENT ON TABLE game_character IS '사용자 캐릭터';
COMMENT ON COLUMN game_character.id IS '캐릭터 식별자';
COMMENT ON COLUMN game_character.account_id IS '캐릭터 소유 사용자 식별자';
COMMENT ON COLUMN game_character.slot_no IS '캐릭터 슬롯 번호';
COMMENT ON COLUMN game_character.name IS '캐릭터 이름';
COMMENT ON COLUMN game_character.appearance_code IS '캐릭터 외형 코드';
COMMENT ON COLUMN game_character.intro_completed_at IS '캐릭터의 최초 스토리 만화 완료 일시 (NULL이면 미완료)';
COMMENT ON COLUMN game_character.created_at IS '캐릭터 생성 일시';
COMMENT ON COLUMN game_character.updated_at IS '캐릭터 정보 수정 일시';
COMMENT ON COLUMN game_character.status IS '캐릭터 상태 (ACTIVE: 활성, DELETED: 삭제)';

CREATE UNIQUE INDEX uq_game_character_active_account_slot
    ON game_character (account_id, slot_no) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_game_character_active_name
    ON game_character (LOWER(BTRIM(name))) WHERE status = 'ACTIVE';
