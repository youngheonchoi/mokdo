-- 사용자 외부 로그인 연동 테이블의 한글 설명.

COMMENT ON TABLE account_identity IS '사용자 외부 로그인 연동';
COMMENT ON COLUMN account_identity.id IS '외부 로그인 연동 식별자';
COMMENT ON COLUMN account_identity.account_id IS '연동된 사용자 식별자';
COMMENT ON COLUMN account_identity.provider IS '외부 로그인 제공자';
COMMENT ON COLUMN account_identity.provider_subject IS '검증된 제공자 토큰의 고유 사용자 식별자 (이메일 사용 금지)';
COMMENT ON COLUMN account_identity.email IS '외부 로그인 제공자의 이메일 주소';
COMMENT ON COLUMN account_identity.linked_at IS '외부 로그인 연동 일시';
