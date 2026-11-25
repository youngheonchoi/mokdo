-- npc 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- NPC의 대화 및 기능은 서버 로직에서 연결한다.

CREATE TABLE npc (
    npc_code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_npc_code CHECK (npc_code = BTRIM(npc_code) AND npc_code <> ''),
    CONSTRAINT chk_npc_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_npc_type CHECK (type IN ('GENERAL', 'MERCHANT', 'QUEST')),
    CONSTRAINT chk_npc_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uq_npc_code_type UNIQUE (npc_code, type)
);

COMMENT ON TABLE npc IS 'NPC 기본정보. 이름과 유형을 관리하고 출현 위치 및 상점 정보는 별도 테이블로 연결한다';
COMMENT ON COLUMN npc.npc_code IS 'NPC 고유 코드. 동일 NPC를 여러 맵에 배치할 때도 같은 코드를 사용한다';
COMMENT ON COLUMN npc.name IS 'NPC 표시 이름';
COMMENT ON COLUMN npc.type IS 'NPC 유형 (GENERAL: 일반, MERCHANT: 상인, QUEST: 퀘스트 담당). 실제 기능은 서버 로직에서 연결한다';
COMMENT ON COLUMN npc.description IS 'NPC 설명';
COMMENT ON COLUMN npc.status IS 'NPC 운영 상태 (ACTIVE: 사용 가능, INACTIVE: 비활성). 대화와 거래 가능 여부는 서버에서 검증한다';
COMMENT ON COLUMN npc.created_at IS 'NPC 기본정보 생성 일시';
COMMENT ON COLUMN npc.updated_at IS 'NPC 기본정보 최종 수정 일시';
