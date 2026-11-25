-- 숙련도는 확률로 승급하는 스킬 성능 단계이며 경험치로 오르는 스킬 레벨과 구분한다.
CREATE TABLE skill_mastery (
    rank SMALLINT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_skill_mastery_rank CHECK (rank BETWEEN 1 AND 3),
    CONSTRAINT chk_skill_mastery_name CHECK (BTRIM(name) <> '')
);

COMMENT ON TABLE skill_mastery IS '스킬 숙련도 단계. 1: 하급, 2: 중급, 3: 상급으로 등록하며 초기 데이터는 삽입하지 않는다';
COMMENT ON COLUMN skill_mastery.rank IS '숙련도 단계 번호 (1: 하급, 2: 중급, 3: 상급). 확률 승급은 한 단계씩 진행한다';
COMMENT ON COLUMN skill_mastery.name IS '숙련도 표시 이름';
COMMENT ON COLUMN skill_mastery.created_at IS '숙련도 정의 생성 일시';
COMMENT ON COLUMN skill_mastery.updated_at IS '숙련도 정의 최종 수정 일시';
