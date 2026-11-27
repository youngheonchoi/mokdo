CREATE TABLE ad_admin (
    admin_id UUID NOT NULL,
    login_id VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role_code VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
    status_code VARCHAR(20) NOT NULL DEFAULT 'ACT',
    last_login_dtm TIMESTAMPTZ,
    reg_admin_id UUID,
    mod_admin_id UUID,
    reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_ad_admin PRIMARY KEY (admin_id),
    CONSTRAINT uq_ad_admin_login_id UNIQUE (login_id),
    CONSTRAINT chk_ad_admin_login_id CHECK (login_id ~ '^[a-z0-9]{1,50}$'),
    CONSTRAINT chk_ad_admin_password_hash CHECK (BTRIM(password_hash) <> ''),
    CONSTRAINT chk_ad_admin_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_ad_admin_role_code CHECK (role_code IN ('SUPER_ADMIN', 'ADMIN')),
    CONSTRAINT chk_ad_admin_status_code CHECK (status_code IN ('ACT', 'INACTIVE')),
    CONSTRAINT fk_ad_admin_reg_admin_id FOREIGN KEY (reg_admin_id) REFERENCES ad_admin (admin_id),
    CONSTRAINT fk_ad_admin_mod_admin_id FOREIGN KEY (mod_admin_id) REFERENCES ad_admin (admin_id)
);

COMMENT ON TABLE ad_admin IS '관리자 계정';
COMMENT ON COLUMN ad_admin.admin_id IS '관리자 고유 번호(애플리케이션에서 생성)';
COMMENT ON COLUMN ad_admin.login_id IS '로그인 아이디(영문 소문자와 숫자, 중복 불가)';
COMMENT ON COLUMN ad_admin.password_hash IS '로그인 비밀번호 해시(평문 저장 금지)';
COMMENT ON COLUMN ad_admin.name IS '관리자 이름';
COMMENT ON COLUMN ad_admin.role_code IS '관리자 역할(SUPER_ADMIN: 최고 관리자, ADMIN: 일반 관리자)';
COMMENT ON COLUMN ad_admin.status_code IS '계정 상태(ACT: 사용 중, INACTIVE: 사용 중지)';
COMMENT ON COLUMN ad_admin.last_login_dtm IS '마지막 로그인 일시';
COMMENT ON COLUMN ad_admin.reg_admin_id IS '등록한 관리자 고유 번호(최초 계정 생성 시 NULL 허용)';
COMMENT ON COLUMN ad_admin.mod_admin_id IS '마지막 수정 관리자 고유 번호(최초 계정 생성 시 NULL 허용)';
COMMENT ON COLUMN ad_admin.reg_dtm IS '등록 일자';
COMMENT ON COLUMN ad_admin.mod_dtm IS '수정 일자';
