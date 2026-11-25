CREATE TABLE character_specialization (
    character_id UUID PRIMARY KEY,
    specialization_code VARCHAR(20) NOT NULL,
    changed_by_npc_code VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_character_specialization_character FOREIGN KEY (character_id)
        REFERENCES game_character (id) ON DELETE CASCADE,
    CONSTRAINT fk_character_specialization_definition FOREIGN KEY (specialization_code)
        REFERENCES specialization (code) ON DELETE RESTRICT,
    CONSTRAINT fk_character_specialization_npc FOREIGN KEY (changed_by_npc_code)
        REFERENCES npc (npc_code) ON DELETE RESTRICT,
    CONSTRAINT chk_character_specialization_selected CHECK (specialization_code IN ('ATTACK', 'SUPPORT', 'DEFENSE'))
);

COMMENT ON TABLE character_specialization IS '캐릭터가 현재 선택한 특성. 미선택이면 행이 없으며 공통 스킬은 이 행과 무관하게 사용한다';
COMMENT ON COLUMN character_specialization.character_id IS '특성을 선택한 캐릭터 식별자. 캐릭터당 선택 특성은 하나이다';
COMMENT ON COLUMN character_specialization.specialization_code IS '현재 선택한 공격, 지원 또는 방어 특성 코드';
COMMENT ON COLUMN character_specialization.changed_by_npc_code IS '가장 최근 특성 선택 또는 변경을 처리한 NPC 코드. 해당 시점의 기능과 거리는 서버에서 검증한다';
COMMENT ON COLUMN character_specialization.created_at IS '캐릭터의 최초 특성 선택 일시';
COMMENT ON COLUMN character_specialization.updated_at IS '캐릭터의 최근 특성 변경 일시';

CREATE INDEX idx_character_specialization_code ON character_specialization (specialization_code);
CREATE INDEX idx_character_specialization_npc ON character_specialization (changed_by_npc_code);

-- 특성 변경, 조건에 맞지 않는 보조무기 자동 해제 및 관련 DB 변경은 같은 트랜잭션으로 처리한다.
-- 기존 특성의 패시브와 자신 및 팀원에게 부여한 지속 버프를 해제하고 최종 능력치를 재계산한다.
-- 다른 특성의 스킬 성장 기록은 삭제하지 않으며 다시 선택하면 이전 경험치와 숙련도를 사용한다.
