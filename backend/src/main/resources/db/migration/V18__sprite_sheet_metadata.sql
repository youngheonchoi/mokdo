-- Validated animation atlas metadata is stored with its PNG definition.
-- NULL keeps existing costume layouts and static monster images compatible.
ALTER TABLE gm_costume ADD COLUMN sprite_json TEXT;
ALTER TABLE gm_monster ADD COLUMN sprite_json TEXT;
