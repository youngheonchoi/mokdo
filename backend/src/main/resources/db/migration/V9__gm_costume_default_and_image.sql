ALTER TABLE gm_costume ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE gm_costume ADD COLUMN image_key VARCHAR(255);

COMMENT ON COLUMN gm_costume.is_default IS '신규 캐릭터 생성 시 지급 및 장착할 기본 코스튬 여부(전체 중 하나)';
COMMENT ON COLUMN gm_costume.image_key IS '코스튬 PNG 이미지의 오브젝트 스토리지 키';

UPDATE gm_costume SET is_default = TRUE
WHERE costume_id = (
    SELECT costume_id FROM gm_costume
    ORDER BY CASE WHEN appearance_code = 'common-character-01' THEN 0 ELSE 1 END, reg_dtm, costume_id
    LIMIT 1
);

CREATE UNIQUE INDEX uq_gm_costume_is_default ON gm_costume (is_default) WHERE is_default = TRUE;
ALTER TABLE gm_costume ADD CONSTRAINT chk_gm_costume_image_key
    CHECK (image_key IS NULL OR image_key ~ '^costumes/[a-f0-9-]{36}/[a-f0-9-]{36}\.png$');
