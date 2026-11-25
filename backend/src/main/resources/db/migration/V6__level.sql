-- level 테이블 정의
-- 초기 데이터는 삽입하지 않는다. updated_at이 있는 경우 수정 시 애플리케이션에서 갱신한다.
-- 장비, 패시브 및 버프 적용 전의 기본 능력치를 관리한다.
-- 캐릭터 누적 경험치 이하인 required_total_xp 중 가장 큰 값을 찾아 레벨을 결정한다.
-- 레벨 누락 여부와 레벨별 누적 필요 경험치의 증가 여부는 서버에서 검증한다.
-- 레벨업, 장비 및 패시브 변경 시 기본 능력치부터 최종 능력치를 다시 계산한다.

CREATE TABLE level (
    level INTEGER PRIMARY KEY,
    required_total_xp BIGINT NOT NULL,
    base_max_hp BIGINT NOT NULL,
    base_attack BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_level_level CHECK (level >= 1),
    CONSTRAINT chk_level_required_total_xp CHECK (
        (level = 1 AND required_total_xp = 0)
        OR (level > 1 AND required_total_xp > 0)
    ),
    CONSTRAINT uq_level_required_total_xp UNIQUE (required_total_xp),
    CONSTRAINT chk_level_base_max_hp CHECK (base_max_hp > 0),
    CONSTRAINT chk_level_base_attack CHECK (base_attack >= 0)
);

COMMENT ON TABLE level IS '레벨별 누적 필요 경험치 및 기본 능력치 기준정보. 장비, 패시브, 버프 효과는 포함하지 않는다';
COMMENT ON COLUMN level.level IS '레벨. 1부터 시작하며 기준정보 등록 시 서버에서 레벨 누락 여부를 검증한다';
COMMENT ON COLUMN level.required_total_xp IS '해당 레벨 도달에 필요한 누적 경험치. 다음 레벨까지 추가로 필요한 경험치가 아니며 1레벨은 0이다';
COMMENT ON COLUMN level.base_max_hp IS '해당 레벨의 기본 최대 체력. 장비 및 패시브 효과 적용 전 값이며 현재 남은 체력은 별도 상태로 관리한다';
COMMENT ON COLUMN level.base_attack IS '해당 레벨의 기본 공격력. 장비 및 패시브 효과 적용 전 값';
COMMENT ON COLUMN level.created_at IS '레벨 기준정보 생성 일시';
COMMENT ON COLUMN level.updated_at IS '레벨 기준정보 최종 수정 일시. 수정 시 애플리케이션에서 CURRENT_TIMESTAMP로 갱신한다';
