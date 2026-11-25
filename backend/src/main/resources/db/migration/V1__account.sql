-- account 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 사용자 식별자는 애플리케이션에서 UUID로 생성한다.

CREATE TABLE account (
    id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    create_ip INET,
    updated_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_account_status
        CHECK (status IN ('ACTIVE', 'BAN', 'DELETED'))
);

COMMENT ON TABLE account IS '사용자';
COMMENT ON COLUMN account.id IS '사용자 식별자';
COMMENT ON COLUMN account.status IS '사용자 상태 (ACTIVE: 활성, BAN: 이용 정지, DELETED: 탈퇴)';
COMMENT ON COLUMN account.created_at IS '사용자 생성 일시';
COMMENT ON COLUMN account.updated_at IS '사용자 정보 수정 일시';
COMMENT ON COLUMN account.create_ip IS '사용자 생성 요청 IP 주소';
COMMENT ON COLUMN account.updated_ip IS '사용자 정보 수정 요청 IP 주소';
