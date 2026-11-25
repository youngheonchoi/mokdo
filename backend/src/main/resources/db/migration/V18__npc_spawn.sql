-- npc_spawn 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 맵 코드, 배치 가능 좌표 및 대화 거리는 서버에서 검증한다.

CREATE TABLE npc_spawn (
    id UUID PRIMARY KEY,
    npc_code VARCHAR(64) NOT NULL,
    map_code VARCHAR(64) NOT NULL,
    position_x NUMERIC(12, 3) NOT NULL,
    position_y NUMERIC(12, 3) NOT NULL,
    interaction_radius NUMERIC(10, 3) NOT NULL DEFAULT 85,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_npc_spawn_npc FOREIGN KEY (npc_code)
        REFERENCES npc (npc_code) ON DELETE RESTRICT,
    CONSTRAINT chk_npc_spawn_map CHECK (map_code = BTRIM(map_code) AND map_code <> ''),
    CONSTRAINT chk_npc_spawn_position CHECK (position_x >= 0 AND position_y >= 0),
    CONSTRAINT chk_npc_spawn_radius CHECK (interaction_radius > 0),
    CONSTRAINT chk_npc_spawn_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE npc_spawn IS '맵별 NPC 배치 정보. 같은 NPC를 여러 위치에 배치할 수 있으며 판매 목록과 매입 규칙은 NPC 코드별로 공유한다';
COMMENT ON COLUMN npc_spawn.id IS 'NPC 배치 식별자. 애플리케이션에서 UUID를 생성한다';
COMMENT ON COLUMN npc_spawn.npc_code IS '배치할 NPC 코드';
COMMENT ON COLUMN npc_spawn.map_code IS '배치 맵 코드. 맵 테이블이 없어 서버에서 유효성을 검증한다';
COMMENT ON COLUMN npc_spawn.position_x IS '맵 내 NPC의 X 좌표. 맵 경계와 배치 가능 지형은 서버에서 검증한다';
COMMENT ON COLUMN npc_spawn.position_y IS '맵 내 NPC의 Y 좌표. 맵 경계와 배치 가능 지형은 서버에서 검증한다';
COMMENT ON COLUMN npc_spawn.interaction_radius IS '대화 및 거래를 시작할 수 있는 거리. 좌표와 동일한 단위를 사용하며 실제 거리는 서버에서 검증한다';
COMMENT ON COLUMN npc_spawn.status IS '배치 운영 상태 (ACTIVE: 배치 사용, INACTIVE: 배치 중지)';
COMMENT ON COLUMN npc_spawn.created_at IS 'NPC 배치 정보 생성 일시';
COMMENT ON COLUMN npc_spawn.updated_at IS 'NPC 배치 정보 최종 수정 일시';

CREATE INDEX idx_npc_spawn_npc ON npc_spawn (npc_code);
CREATE INDEX idx_npc_spawn_map_status ON npc_spawn (map_code, status);
