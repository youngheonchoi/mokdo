CREATE TABLE skill_effect (
    skill_code VARCHAR(64) NOT NULL,
    mastery_rank SMALLINT NOT NULL,
    effect_no SMALLINT NOT NULL,
    effect_type VARCHAR(20) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    radius NUMERIC(10, 3),
    stat_code VARCHAR(32),
    value NUMERIC(18, 4) NOT NULL,
    value_type VARCHAR(24) NOT NULL DEFAULT 'FIXED',
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_skill_effect PRIMARY KEY (skill_code, mastery_rank, effect_no),
    CONSTRAINT fk_skill_effect_skill FOREIGN KEY (skill_code) REFERENCES skill (skill_code) ON DELETE RESTRICT,
    CONSTRAINT fk_skill_effect_mastery FOREIGN KEY (mastery_rank) REFERENCES skill_mastery (rank) ON DELETE RESTRICT,
    CONSTRAINT chk_skill_effect_no CHECK (effect_no >= 1),
    CONSTRAINT chk_skill_effect_type CHECK (effect_type IN ('DAMAGE', 'HEAL', 'SHIELD', 'STAT_UP', 'STAT_DOWN')),
    CONSTRAINT chk_skill_effect_target CHECK (target_type IN ('SELF', 'ENEMY', 'ALLY', 'RAID_AREA')),
    CONSTRAINT chk_skill_effect_radius CHECK (
        (target_type = 'RAID_AREA' AND radius IS NOT NULL AND radius > 0)
        OR (target_type <> 'RAID_AREA' AND radius IS NULL)
    ),
    CONSTRAINT chk_skill_effect_stat CHECK (
        (effect_type IN ('STAT_UP', 'STAT_DOWN') AND stat_code IS NOT NULL AND stat_code IN (
            'ATTACK', 'DEFENSE', 'MAX_HP', 'CRIT_RATE', 'CRIT_DAMAGE', 'ATTACK_SPEED', 'MOVE_SPEED'
        )) OR (effect_type NOT IN ('STAT_UP', 'STAT_DOWN') AND stat_code IS NULL)
    ),
    CONSTRAINT chk_skill_effect_value CHECK (value > 0),
    CONSTRAINT chk_skill_effect_value_type CHECK (
        (effect_type IN ('STAT_UP', 'STAT_DOWN') AND value_type IN ('FIXED', 'STAT_PERCENT'))
        OR (effect_type NOT IN ('STAT_UP', 'STAT_DOWN') AND value_type IN ('FIXED', 'ATTACK_PERCENT', 'MAX_HP_PERCENT'))
    ),
    CONSTRAINT chk_skill_effect_duration CHECK (
        (effect_type IN ('DAMAGE', 'HEAL') AND duration_ms IS NULL)
        OR (effect_type = 'SHIELD' AND duration_ms IS NOT NULL AND duration_ms > 0)
        OR (effect_type IN ('STAT_UP', 'STAT_DOWN') AND (duration_ms IS NULL OR duration_ms > 0))
    )
);

COMMENT ON TABLE skill_effect IS '숙련도별 스킬 효과. 같은 스킬에 여러 효과를 순서대로 적용하며 스킬 레벨별 수치 증가는 두지 않는다';
COMMENT ON COLUMN skill_effect.skill_code IS '효과를 정의하는 스킬 코드';
COMMENT ON COLUMN skill_effect.mastery_rank IS '효과가 적용되는 숙련도. 액티브는 현재 숙련도의 정의를 사용하며 패시브와 버프는 1만 등록한다';
COMMENT ON COLUMN skill_effect.effect_no IS '스킬 및 숙련도 내 효과 번호와 처리 순서';
COMMENT ON COLUMN skill_effect.effect_type IS '효과 종류 (DAMAGE: 피해, HEAL: 회복, SHIELD: 보호막, STAT_UP: 능력치 증가, STAT_DOWN: 능력치 감소)';
COMMENT ON COLUMN skill_effect.target_type IS '대상 (SELF: 자신, ENEMY: 지정한 적, ALLY: 지정한 팀원, RAID_AREA: 시전자 주변의 같은 레이드 팀원과 자신). 소속, 생존 및 대상 유효성은 서버에서 검증한다';
COMMENT ON COLUMN skill_effect.radius IS 'RAID_AREA의 적용 반경. 시전자를 중심으로 맵 좌표와 같은 단위를 사용하며 다른 대상 방식은 NULL';
COMMENT ON COLUMN skill_effect.stat_code IS '증감할 능력치 코드. 능력치 증감 효과에만 지정하며 현재 전투에서 지원하는 능력치인지 서버에서 검증한다';
COMMENT ON COLUMN skill_effect.value IS '양수 효과 수치. 퍼센트는 100이 100퍼센트이며 최종 계산과 반올림 규칙은 서버에서 정의한다';
COMMENT ON COLUMN skill_effect.value_type IS '수치 해석 (FIXED: 고정값, ATTACK_PERCENT: 시전자 최종 공격력 비율, MAX_HP_PERCENT: 시전자 최종 최대 체력 비율, STAT_PERCENT: 대상 능력치 비율). 능력치 비율의 중첩 기준은 서버에서 정의한다';
COMMENT ON COLUMN skill_effect.duration_ms IS '효과 지속시간 (밀리초). 즉시 피해와 회복은 NULL, 보호막은 양수, 패시브의 상시 능력치 효과는 NULL. 버프의 능력치 효과에는 양수를 요구하도록 서버에서 검증한다';
COMMENT ON COLUMN skill_effect.created_at IS '스킬 효과 생성 일시';
COMMENT ON COLUMN skill_effect.updated_at IS '스킬 효과 최종 수정 일시';

-- 이 테이블은 효과 정의이며 전투 중 버프 인스턴스나 레이드 구성원을 저장하지 않는다.
-- 범위 버프는 시전 시 범위 안의 팀원에게 지속시간 동안 부여한다. 상시 범위 오라는 별도 기능이다.
-- 적용 중인 효과에는 시전자와 원본 스킬을 추적하여 특성 변경 및 보조무기 해제 시 수신자 전체에서 제거한다.
-- 이미 준 피해와 완료한 회복은 되돌리지 않는다. 중첩, 갱신 및 시전자 접속 종료 정책은 전투 로직에서 정의한다.
