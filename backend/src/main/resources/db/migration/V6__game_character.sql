-- 캐릭터별 인트로 완료 상태 및 사용자 캐릭터 테이블의 한글 설명.

ALTER TABLE game_character
    ADD COLUMN intro_completed_at TIMESTAMPTZ;

-- 기존 계정의 완료 기록은 특정 캐릭터의 완료 여부를 구분할 수 없으므로
-- 캐릭터별 완료 상태는 NULL(미완료)로 시작한다.
ALTER TABLE account
    DROP COLUMN intro_completed_at;

COMMENT ON TABLE game_character IS '사용자 캐릭터';
COMMENT ON COLUMN game_character.id IS '캐릭터 식별자';
COMMENT ON COLUMN game_character.account_id IS '캐릭터 소유 사용자 식별자';
COMMENT ON COLUMN game_character.slot_no IS '캐릭터 슬롯 번호';
COMMENT ON COLUMN game_character.name IS '캐릭터 이름';
COMMENT ON COLUMN game_character.appearance_code IS '캐릭터 외형 코드';
COMMENT ON COLUMN game_character.intro_completed_at IS '캐릭터의 최초 스토리 만화 완료 일시 (NULL이면 미완료)';
COMMENT ON COLUMN game_character.created_at IS '캐릭터 생성 일시';
COMMENT ON COLUMN game_character.updated_at IS '캐릭터 정보 수정 일시';
