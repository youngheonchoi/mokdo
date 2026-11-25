-- account_identity 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 검증된 외부 로그인 제공자의 고유 식별자로 사용자를 연결한다.

CREATE TABLE account_identity (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    email TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_account_identity_account
        FOREIGN KEY (account_id)
        REFERENCES account (id)
        ON DELETE CASCADE,
    CONSTRAINT uq_account_identity_provider_subject
        UNIQUE (provider, provider_subject),
    CONSTRAINT uq_account_identity_account_provider
        UNIQUE (account_id, provider),
    CONSTRAINT chk_account_identity_provider
        CHECK (provider = UPPER(BTRIM(provider)) AND provider <> '')
);

COMMENT ON TABLE account_identity IS '사용자 외부 로그인 연동';
COMMENT ON COLUMN account_identity.provider_subject IS '검증된 제공자 토큰의 고유 사용자 식별자 (이메일 사용 금지)';
COMMENT ON COLUMN account_identity.id IS '외부 로그인 연동 식별자';
COMMENT ON COLUMN account_identity.account_id IS '연동된 사용자 식별자';
COMMENT ON COLUMN account_identity.provider IS '외부 로그인 제공자';
COMMENT ON COLUMN account_identity.email IS '외부 로그인 제공자의 이메일 주소';
COMMENT ON COLUMN account_identity.linked_at IS '외부 로그인 연동 일시';
