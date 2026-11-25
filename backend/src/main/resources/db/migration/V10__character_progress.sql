-- character_progress 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 게임 데이터 접근 시 캐릭터 소유권과 ACTIVE 상태를 서버에서 확인한다.
-- 거래, 장착 및 보상 반영은 행 잠금 또는 버전 비교로 동시 수정을 제어한다.

CREATE TABLE character_progress (
    character_id UUID PRIMARY KEY,
    xp BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,
    kills BIGINT NOT NULL DEFAULT 0,
    boss_clears BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_character_progress_character FOREIGN KEY (character_id)
        REFERENCES game_character (id) ON DELETE CASCADE,
    CONSTRAINT chk_character_progress_xp CHECK (xp >= 0),
    CONSTRAINT chk_character_progress_gold CHECK (gold BETWEEN 0 AND 99999999),
    CONSTRAINT chk_character_progress_kills CHECK (kills >= 0),
    CONSTRAINT chk_character_progress_boss_clears CHECK (boss_clears >= 0),
    CONSTRAINT chk_character_progress_version CHECK (version >= 0)
);

COMMENT ON TABLE character_progress IS '캐릭터별 성장, 골드 및 누적 전투 기록. 캐릭터 1명당 1행';
COMMENT ON COLUMN character_progress.character_id IS '캐릭터 식별자. 사용자 식별자가 아닌 캐릭터 단위로 진행 정보를 분리한다';
COMMENT ON COLUMN character_progress.xp IS '누적 경험치. level의 required_total_xp로 레벨과 기본 능력치를 결정하며 경험치 상한은 서버에서 검증한다';
COMMENT ON COLUMN character_progress.gold IS '보유 골드. 아이템 기준정보와 가방에 중복 저장하지 않는다';
COMMENT ON COLUMN character_progress.kills IS '누적 처치 수. 현재 게임 로직에 따라 일반 몬스터와 보스를 모두 포함한다';
COMMENT ON COLUMN character_progress.boss_clears IS '누적 보스 클리어 수. 현재 단일 보스의 최초 클리어 여부는 0인지로 판단한다';
COMMENT ON COLUMN character_progress.version IS '동시 수정 충돌 검사용 버전. 수정 시 기존 버전을 조건으로 비교하고 1 증가시키며 프런트엔드 저장 형식 버전과는 별개이다';
COMMENT ON COLUMN character_progress.created_at IS '진행 정보 생성 일시';
COMMENT ON COLUMN character_progress.updated_at IS '진행 정보 최종 수정 일시';
