-- mob_spawn 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 맵 코드와 배치 가능한 좌표는 서버에서 검증한다.
-- 보스 페이즈, 스킬 및 특수 기믹은 해당 기능 설계 시 별도 테이블로 확장한다.

CREATE TABLE mob_spawn (
    id UUID PRIMARY KEY,
    mob_code VARCHAR(64) NOT NULL,
    map_code VARCHAR(64) NOT NULL,
    position_x NUMERIC(12, 3) NOT NULL,
    position_y NUMERIC(12, 3) NOT NULL,
    respawn_seconds INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_mob_spawn_mob FOREIGN KEY (mob_code)
        REFERENCES mob (mob_code) ON DELETE RESTRICT,
    CONSTRAINT chk_mob_spawn_map_code CHECK (map_code = BTRIM(map_code) AND map_code <> ''),
    CONSTRAINT chk_mob_spawn_position CHECK (position_x >= 0 AND position_y >= 0),
    CONSTRAINT chk_mob_spawn_respawn CHECK (respawn_seconds IS NULL OR respawn_seconds > 0),
    CONSTRAINT chk_mob_spawn_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE mob_spawn IS '맵별 몹 출현 지점 설정. 1행은 몹 1마리의 기준 출현 지점이며 던전별 실제 출현 상태는 별도로 관리한다';
COMMENT ON COLUMN mob_spawn.id IS '출현 지점 식별자. 애플리케이션에서 UUID를 생성한다';
COMMENT ON COLUMN mob_spawn.mob_code IS '해당 지점에 출현하는 몹 코드';
COMMENT ON COLUMN mob_spawn.map_code IS '출현 맵 코드. 현재 코드의 town, field, dungeon 등과 연결하며 맵 테이블이 없어 서버에서 유효성을 검증한다';
COMMENT ON COLUMN mob_spawn.position_x IS '맵 내 출현 기준 X 좌표. 맵 경계 및 이동 가능한 지형 여부는 서버에서 검증한다';
COMMENT ON COLUMN mob_spawn.position_y IS '맵 내 출현 기준 Y 좌표. 맵 경계 및 이동 가능한 지형 여부는 서버에서 검증한다';
COMMENT ON COLUMN mob_spawn.respawn_seconds IS '처치 후 재출현까지의 기본 대기 시간 (초). NULL이면 해당 전투 또는 던전 인스턴스에서 자동 재출현하지 않는다';
COMMENT ON COLUMN mob_spawn.status IS '출현 지점 운영 상태 (ACTIVE: 출현 사용, INACTIVE: 출현 중지)';
COMMENT ON COLUMN mob_spawn.created_at IS '출현 지점 생성 일시';
COMMENT ON COLUMN mob_spawn.updated_at IS '출현 지점 최종 수정 일시';

CREATE INDEX idx_mob_spawn_mob ON mob_spawn (mob_code);
CREATE INDEX idx_mob_spawn_map_status ON mob_spawn (map_code, status);
