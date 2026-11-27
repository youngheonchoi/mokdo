ALTER TABLE gm_item DROP CONSTRAINT chk_gm_item_item_type;
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_item_type
    CHECK (item_type IN ('WEAPON', 'HAT', 'ARMOR', 'CONSUMABLE', 'MATERIAL'));
ALTER TABLE gm_item DROP CONSTRAINT chk_gm_item_equip_slot_code;
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_equip_slot_code CHECK (
    (item_type IN ('WEAPON', 'HAT') AND equip_slot_code IS NOT NULL AND equip_slot_code = item_type AND appearance_code IS NOT NULL)
    OR (item_type = 'ARMOR' AND equip_slot_code IS NOT NULL AND equip_slot_code NOT IN ('WEAPON', 'HAT'))
    OR (item_type IN ('CONSUMABLE', 'MATERIAL') AND equip_slot_code IS NULL));
ALTER TABLE gm_item DROP CONSTRAINT chk_gm_item_required_level_type;
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_required_level_type
    CHECK (item_type IN ('WEAPON', 'HAT') OR required_level = 1);
ALTER TABLE gm_item ADD COLUMN attack INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gm_item ADD COLUMN defense INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gm_item ADD COLUMN hp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_stats CHECK (attack >= 0 AND defense >= 0 AND hp >= 0);
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_stats_type
    CHECK (item_type IN ('WEAPON', 'HAT') OR (attack = 0 AND defense = 0 AND hp = 0));
COMMENT ON COLUMN gm_item.item_type IS '아이템 종류(무기, 모자, 방어구, 소모품, 재료)';
COMMENT ON COLUMN gm_item.required_level IS '무기 또는 모자 착용 최소 레벨(기타 종류는 1)';
COMMENT ON COLUMN gm_item.attack IS '장비 추가 공격력';
COMMENT ON COLUMN gm_item.defense IS '장비 추가 방어력';
COMMENT ON COLUMN gm_item.hp IS '장비 추가 최대 체력';
COMMENT ON COLUMN gm_character_equipment.slot_code IS '장착 슬롯 코드(WEAPON: 무기, HAT: 모자)';
