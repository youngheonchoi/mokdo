CREATE TABLE mb_member (
    member_id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'ACT',
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_mb_member_status CHECK (status IN ('ACT', 'BAN'))
);

COMMENT ON TABLE mb_member IS '사용자';
COMMENT ON COLUMN mb_member.member_id IS '사용자 고유 번호(자체 생성)';
COMMENT ON COLUMN mb_member.status IS '계정 상태';
COMMENT ON COLUMN mb_member.reg_dtm IS '등록 일자';
COMMENT ON COLUMN mb_member.mod_dtm IS '수정 일자';