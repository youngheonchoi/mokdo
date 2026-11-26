-- 영문 대소문자를 구분하지 않고 전체 캐릭터의 닉네임 중복을 방지한다.
CREATE UNIQUE INDEX uq_gm_character_nickname_lower ON gm_character (LOWER(nickname));
COMMENT ON INDEX uq_gm_character_nickname_lower IS '영문 대소문자를 구분하지 않는 캐릭터 닉네임 고유 인덱스';
