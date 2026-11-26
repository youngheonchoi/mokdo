CREATE TABLE mb_member_social (
    member_social_id UUID PRIMARY KEY,
    member_id UUID NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    link_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_mb_member_social_member_id FOREIGN KEY (member_id) REFERENCES mb_member (member_id),
    CONSTRAINT uq_mb_member_social_provider_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uq_mb_member_social_member_id_provider UNIQUE (member_id, provider),
    CONSTRAINT chk_mb_member_social_provider CHECK (provider IN ('GOOGLE', 'KAKAO', 'NAVER'))
);

COMMENT ON TABLE mb_member_social IS '사용자 소셜 정보';
COMMENT ON COLUMN mb_member_social.member_social_id IS '사용자 소셜 정보 고유 번호(자체 생성)';
COMMENT ON COLUMN mb_member_social.member_id IS '사용자 고유 번호';
COMMENT ON COLUMN mb_member_social.provider IS '소셜 구분';
COMMENT ON COLUMN mb_member_social.provider_subject IS '소셜 제공자가 발급한 사용자 고유 식별자(구글 sub, 카카오/네이버 id)';
COMMENT ON COLUMN mb_member_social.link_dtm IS '연동 일자';