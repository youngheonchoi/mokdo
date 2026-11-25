-- mob 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 실제 전투 중의 현재 체력과 위치는 별도 전투 상태로 관리한다.
-- 방어력의 실제 피해 감소 공식과 최소 피해는 전투 로직에서 정의한다.

CREATE TABLE mob (
    mob_code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    level INTEGER NOT NULL DEFAULT 1,
    max_hp BIGINT NOT NULL,
    attack BIGINT NOT NULL,
    defense BIGINT NOT NULL DEFAULT 0,
    reward_xp BIGINT NOT NULL DEFAULT 0,
    min_gold INTEGER NOT NULL DEFAULT 0,
    max_gold INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_mob_code CHECK (mob_code = BTRIM(mob_code) AND mob_code <> ''),
    CONSTRAINT chk_mob_name CHECK (BTRIM(name) <> ''),
    CONSTRAINT chk_mob_type CHECK (type IN ('NORMAL', 'NAMED', 'BOSS')),
    CONSTRAINT chk_mob_level CHECK (level >= 1),
    CONSTRAINT chk_mob_max_hp CHECK (max_hp > 0),
    CONSTRAINT chk_mob_attack CHECK (attack >= 0),
    CONSTRAINT chk_mob_defense CHECK (defense >= 0),
    CONSTRAINT chk_mob_reward_xp CHECK (reward_xp >= 0),
    CONSTRAINT chk_mob_gold CHECK (min_gold >= 0 AND max_gold >= min_gold AND max_gold <= 99999999),
    CONSTRAINT chk_mob_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE mob IS '몹 기준정보. 일반 몹, 네임드 및 보스를 유형으로 구분하며 개별 전투 중의 현재 체력과 위치는 저장하지 않는다';
COMMENT ON COLUMN mob.mob_code IS '몹 고유 코드. 동일 종류의 몹이 여러 위치에 출현해도 같은 코드를 사용한다';
COMMENT ON COLUMN mob.name IS '몹 표시 이름';
COMMENT ON COLUMN mob.type IS '몹 유형 (NORMAL: 일반, NAMED: 네임드, BOSS: 보스). 근거리 및 원거리 등 공격 방식과는 별개이다';
COMMENT ON COLUMN mob.level IS '몹 레벨. 플레이어 성장 기준표와 독립적으로 설정하며 체력과 공격력은 이 테이블의 값을 사용한다';
COMMENT ON COLUMN mob.max_hp IS '몹의 기본 최대 체력. 전투 시작 시 현재 체력의 초기값으로 사용한다';
COMMENT ON COLUMN mob.attack IS '몹의 기본 공격력. 스킬 배율, 페이즈 및 버프에 따른 최종 피해량 계산은 전투 로직에서 처리한다';
COMMENT ON COLUMN mob.reward_xp IS '몹 1마리 처치 시 지급하는 기본 경험치';
COMMENT ON COLUMN mob.min_gold IS '몹 1마리 처치 시 지급할 골드의 최솟값. 최댓값과 모두 0이면 골드를 지급하지 않는다';
COMMENT ON COLUMN mob.max_gold IS '몹 1마리 처치 시 지급할 골드의 최댓값. 최솟값 이상이어야 하며 양 끝을 포함한 범위에서 서버가 결정한다';
COMMENT ON COLUMN mob.description IS '몹 설명';
COMMENT ON COLUMN mob.status IS '몹 운영 상태 (ACTIVE: 사용 가능, INACTIVE: 비활성). 신규 출현 가능 여부는 서버에서 검증한다';
COMMENT ON COLUMN mob.created_at IS '몹 기준정보 생성 일시';
COMMENT ON COLUMN mob.updated_at IS '몹 기준정보 최종 수정 일시';
COMMENT ON COLUMN mob.defense IS '몹의 기본 방어력. 0 이상이며 플레이어가 몹에게 가하는 피해 계산에 사용한다. 실제 피해 감소 공식과 최소 피해는 전투 로직에서 정의한다';
