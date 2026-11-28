ALTER TABLE gm_item ADD COLUMN heal_hp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_heal_hp CHECK (heal_hp >= 0);
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_heal_hp_type
    CHECK (item_type = 'CONSUMABLE' OR heal_hp = 0);
COMMENT ON COLUMN gm_item.heal_hp IS '소모품 사용 시 HP 회복량(0이면 회복 효과 없음)';
