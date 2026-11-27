CREATE TABLE gm_monster (
 monster_id UUID CONSTRAINT pk_gm_monster PRIMARY KEY,
 monster_code VARCHAR(64) NOT NULL CONSTRAINT uq_gm_monster_monster_code UNIQUE,
 name VARCHAR(100) NOT NULL, description TEXT NOT NULL DEFAULT '',
 level INTEGER NOT NULL DEFAULT 1, max_hp INTEGER NOT NULL DEFAULT 1,
 attack INTEGER NOT NULL DEFAULT 0, defense INTEGER NOT NULL DEFAULT 0,
 image_key VARCHAR(255), reward_exp BIGINT NOT NULL DEFAULT 0, reward_currency BIGINT NOT NULL DEFAULT 0,
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
 reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT chk_gm_monster_monster_code CHECK (monster_code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
 CONSTRAINT chk_gm_monster_name CHECK (length(trim(name)) > 0),
 CONSTRAINT chk_gm_monster_stats CHECK (level >= 1 AND max_hp >= 1 AND attack >= 0 AND defense >= 0),
 CONSTRAINT chk_gm_monster_rewards CHECK (reward_exp >= 0 AND reward_currency >= 0),
 CONSTRAINT chk_gm_monster_status CHECK (status IN ('DRAFT','ACT','INACTIVE'))
);
CREATE TABLE gm_monster_drop (
 monster_drop_id UUID CONSTRAINT pk_gm_monster_drop PRIMARY KEY,
 monster_id UUID NOT NULL, item_id UUID NOT NULL, drop_rate NUMERIC(7,4) NOT NULL,
 min_quantity INTEGER NOT NULL DEFAULT 1, max_quantity INTEGER NOT NULL DEFAULT 1,
 reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, mod_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_gm_monster_drop_monster_id FOREIGN KEY (monster_id) REFERENCES gm_monster(monster_id),
 CONSTRAINT fk_gm_monster_drop_item_id FOREIGN KEY (item_id) REFERENCES gm_item(item_id),
 CONSTRAINT uq_gm_monster_drop_monster_id_item_id UNIQUE (monster_id,item_id),
 CONSTRAINT chk_gm_monster_drop_drop_rate CHECK (drop_rate >= 0 AND drop_rate <= 100),
 CONSTRAINT chk_gm_monster_drop_quantity CHECK (min_quantity >= 1 AND max_quantity >= min_quantity)
);
CREATE INDEX idx_gm_monster_drop_item_id ON gm_monster_drop(item_id);
COMMENT ON TABLE gm_monster IS '몬스터 정의';
COMMENT ON COLUMN gm_monster.monster_id IS '몬스터 ID';
COMMENT ON COLUMN gm_monster.monster_code IS '고유 코드';
COMMENT ON COLUMN gm_monster.name IS '이름';
COMMENT ON COLUMN gm_monster.description IS '설명';
COMMENT ON COLUMN gm_monster.level IS '레벨';
COMMENT ON COLUMN gm_monster.max_hp IS '최대 체력';
COMMENT ON COLUMN gm_monster.attack IS '공격력';
COMMENT ON COLUMN gm_monster.defense IS '방어력';
COMMENT ON COLUMN gm_monster.image_key IS '스토리지 PNG 에셋 경로';
COMMENT ON COLUMN gm_monster.reward_exp IS '처치 보상 경험치';
COMMENT ON COLUMN gm_monster.reward_currency IS '처치 보상 재화';
COMMENT ON COLUMN gm_monster.status IS '관리 상태(DRAFT, ACT, INACTIVE)';
COMMENT ON COLUMN gm_monster.reg_dtm IS '등록 일시';
COMMENT ON COLUMN gm_monster.mod_dtm IS '수정 일시';
COMMENT ON TABLE gm_monster_drop IS '몬스터 드롭 정의';
COMMENT ON COLUMN gm_monster_drop.monster_drop_id IS '몬스터 드롭 ID';
COMMENT ON COLUMN gm_monster_drop.monster_id IS '몬스터 ID';
COMMENT ON COLUMN gm_monster_drop.item_id IS '아이템 ID';
COMMENT ON COLUMN gm_monster_drop.drop_rate IS '독립 드롭 확률(0~100 퍼센트)';
COMMENT ON COLUMN gm_monster_drop.min_quantity IS '최소 수량';
COMMENT ON COLUMN gm_monster_drop.max_quantity IS '최대 수량';
COMMENT ON COLUMN gm_monster_drop.reg_dtm IS '등록 일시';
COMMENT ON COLUMN gm_monster_drop.mod_dtm IS '수정 일시';
