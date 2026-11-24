-- 사용자 IP 컬럼 및 사용자 테이블의 한글 설명.
-- 이미 적용된 V1~V3는 변경하지 않고 이 마이그레이션에서 설명을 갱신한다.

ALTER TABLE account
    ADD COLUMN create_ip INET,
    ADD COLUMN updated_ip INET;

COMMENT ON TABLE account IS '사용자';
COMMENT ON COLUMN account.id IS '사용자 식별자';
COMMENT ON COLUMN account.status IS '사용자 상태 (ACTIVE: 활성, BAN: 이용 정지, DELETED: 탈퇴)';
COMMENT ON COLUMN account.created_at IS '사용자 생성 일시';
COMMENT ON COLUMN account.updated_at IS '사용자 정보 수정 일시';
COMMENT ON COLUMN account.create_ip IS '사용자 생성 요청 IP 주소';
COMMENT ON COLUMN account.updated_ip IS '사용자 정보 수정 요청 IP 주소';
