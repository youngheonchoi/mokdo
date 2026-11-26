INSERT INTO gm_costume (costume_id, name, appearance_code)
VALUES ('10000000-0000-4000-8000-000000000001', '기본 코스튬', 'common-character-01')
ON CONFLICT (appearance_code) DO NOTHING;

INSERT INTO mb_member_costume (member_costume_id, member_id, costume_id)
SELECT gen_random_uuid(), m.member_id, c.costume_id
FROM mb_member m CROSS JOIN gm_costume c
WHERE c.appearance_code = 'common-character-01'
ON CONFLICT (member_id, costume_id) DO NOTHING;

UPDATE gm_character g
SET equipped_costume_id = c.costume_id, mod_dtm = CURRENT_TIMESTAMP
FROM gm_costume c
WHERE g.equipped_costume_id IS NULL AND c.appearance_code = 'common-character-01';

ALTER TABLE gm_character ALTER COLUMN equipped_costume_id SET NOT NULL;
COMMENT ON COLUMN gm_character.equipped_costume_id IS '장착한 코스튬 고유 번호(기본 코스튬 포함, 필수)';
