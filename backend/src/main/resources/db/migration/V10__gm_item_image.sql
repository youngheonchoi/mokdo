ALTER TABLE gm_item ADD COLUMN image_key VARCHAR(255);
COMMENT ON COLUMN gm_item.image_key IS '아이템 PNG 이미지 스토리지 키';
ALTER TABLE gm_item ADD CONSTRAINT chk_gm_item_image_key
    CHECK (image_key IS NULL OR image_key ~ '^items/[a-f0-9-]{36}/[a-f0-9-]{36}\.png$');
