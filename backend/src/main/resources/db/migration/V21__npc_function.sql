-- NPC 유형과 별개로 하나의 NPC에 여러 기능을 연결한다.
-- 상점은 npc의 MERCHANT 유형 및 상품 외래 키를 함께 사용한다. 초기 데이터는 삽입하지 않는다.
CREATE TABLE npc_function (
    npc_code VARCHAR(64) NOT NULL,
    function_code VARCHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_npc_function PRIMARY KEY (npc_code, function_code),
    CONSTRAINT fk_npc_function_npc FOREIGN KEY (npc_code) REFERENCES npc (npc_code) ON DELETE RESTRICT,
    CONSTRAINT chk_npc_function_code CHECK (function_code IN ('SHOP', 'QUEST', 'SPECIALIZATION_CHANGE')),
    CONSTRAINT chk_npc_function_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

COMMENT ON TABLE npc_function IS 'NPC별 제공 기능. 상점과 특성 변경 등 여러 기능을 같은 NPC에 연결할 수 있다';
COMMENT ON COLUMN npc_function.npc_code IS '기능을 제공하는 NPC 코드';
COMMENT ON COLUMN npc_function.function_code IS '기능 코드 (SHOP: 상점, QUEST: 퀘스트, SPECIALIZATION_CHANGE: 특성 최초 선택 및 재선택)';
COMMENT ON COLUMN npc_function.status IS '기능 운영 상태 (ACTIVE: 사용 가능, INACTIVE: 중지)';
COMMENT ON COLUMN npc_function.created_at IS 'NPC 기능 등록 일시';
COMMENT ON COLUMN npc_function.updated_at IS 'NPC 기능 최종 수정 일시';

-- 특성 변경 요청은 활성 NPC와 SPECIALIZATION_CHANGE 기능, 실제 배치 및 상호작용 거리를 검증한다.
-- NPC는 마을에만 배치한다는 운영 규칙을 사용하며 별도의 전투 중 검사는 요구하지 않는다.
