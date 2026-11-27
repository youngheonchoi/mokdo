ALTER TABLE gm_item ADD COLUMN required_level INTEGER NOT NULL DEFAULT 1;
COMMENT ON COLUMN gm_item.required_level IS '무기 착용 최소 레벨(기타 종류는 1)';
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_required_level CHECK (required_level >= 1);
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_required_level_type
    CHECK (item_type = 'WEAPON' OR required_level = 1);
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_required_level_default
    CHECK (item_code <> 'wooden-club' OR required_level = 1);
