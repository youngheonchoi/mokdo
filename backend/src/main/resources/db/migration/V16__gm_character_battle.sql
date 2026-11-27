ALTER TABLE gm_character ADD COLUMN current_hp BIGINT;
ALTER TABLE gm_character ADD COLUMN currency BIGINT NOT NULL DEFAULT 0;
ALTER TABLE gm_character ADD CONSTRAINT chk_gm_character_current_hp CHECK (current_hp >= 0);
ALTER TABLE gm_character ADD CONSTRAINT chk_gm_character_currency CHECK (currency >= 0);
COMMENT ON COLUMN gm_character.current_hp IS '현재 체력(NULL은 최초 전투 전 최대 체력)';
COMMENT ON COLUMN gm_character.currency IS '캐릭터 보유 재화';

CREATE TABLE gm_character_battle (
 character_id UUID CONSTRAINT pk_gm_character_battle PRIMARY KEY,
 session_id UUID NOT NULL,
 command_seq BIGINT NOT NULL DEFAULT 0,
 player_x DOUBLE PRECISION NOT NULL DEFAULT 400,
 player_y DOUBLE PRECISION NOT NULL DEFAULT 560,
 facing VARCHAR(4) NOT NULL DEFAULT 'east',
 monster_id UUID NOT NULL,
 monster_hp BIGINT NOT NULL,
 monster_x DOUBLE PRECISION NOT NULL DEFAULT 800,
 monster_y DOUBLE PRECISION NOT NULL DEFAULT 560,
 monster_respawn_dtm TIMESTAMPTZ,
 player_revive_dtm TIMESTAMPTZ,
 next_attack_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 next_monster_attack_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 jump_until_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_tick_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_gm_character_battle_character_id FOREIGN KEY (character_id) REFERENCES gm_character(character_id),
 CONSTRAINT fk_gm_character_battle_monster_id FOREIGN KEY (monster_id) REFERENCES gm_monster(monster_id),
 CONSTRAINT chk_gm_character_battle_monster_hp CHECK (monster_hp >= 0),
 CONSTRAINT chk_gm_character_battle_facing CHECK (facing IN ('east','west'))
);
COMMENT ON TABLE gm_character_battle IS '캐릭터별 숲 전투와 몬스터 리스폰 상태';
COMMENT ON COLUMN gm_character_battle.character_id IS '전투 캐릭터 ID';
COMMENT ON COLUMN gm_character_battle.session_id IS '현재 게임 화면 세션 ID';
COMMENT ON COLUMN gm_character_battle.command_seq IS '마지막 처리 입력 번호';
COMMENT ON COLUMN gm_character_battle.player_x IS '플레이어 바닥 X 좌표';
COMMENT ON COLUMN gm_character_battle.player_y IS '플레이어 바닥 Y 좌표';
COMMENT ON COLUMN gm_character_battle.facing IS '플레이어 좌우 방향';
COMMENT ON COLUMN gm_character_battle.monster_id IS '배치한 몬스터 정의 ID';
COMMENT ON COLUMN gm_character_battle.monster_hp IS '현재 몬스터 체력';
COMMENT ON COLUMN gm_character_battle.monster_x IS '몬스터 바닥 X 좌표';
COMMENT ON COLUMN gm_character_battle.monster_y IS '몬스터 바닥 Y 좌표';
COMMENT ON COLUMN gm_character_battle.monster_respawn_dtm IS '처치 후 몬스터 재생성 시각';
COMMENT ON COLUMN gm_character_battle.player_revive_dtm IS '플레이어 부활 시각';
COMMENT ON COLUMN gm_character_battle.next_attack_dtm IS '플레이어 다음 공격 가능 시각';
COMMENT ON COLUMN gm_character_battle.next_monster_attack_dtm IS '몬스터 다음 공격 가능 시각';
COMMENT ON COLUMN gm_character_battle.jump_until_dtm IS '플레이어 점프 종료 시각';
COMMENT ON COLUMN gm_character_battle.last_tick_dtm IS '마지막 전투 진행 시각';

CREATE TABLE gm_character_battle_event (
 event_no BIGINT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_gm_character_battle_event PRIMARY KEY,
 character_id UUID NOT NULL,
 kind VARCHAR(20) NOT NULL,
 amount BIGINT NOT NULL DEFAULT 0,
 label TEXT NOT NULL DEFAULT '',
 x DOUBLE PRECISION NOT NULL,
 y DOUBLE PRECISION NOT NULL,
 reg_dtm TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_gm_character_battle_event_character_id FOREIGN KEY (character_id) REFERENCES gm_character(character_id)
);
CREATE INDEX idx_gm_character_battle_event_character_id_event_no ON gm_character_battle_event(character_id,event_no);
COMMENT ON TABLE gm_character_battle_event IS '재시도에 안전한 전투 피격 및 보상 표시 이벤트';
COMMENT ON COLUMN gm_character_battle_event.event_no IS '전투 이벤트 순번';
COMMENT ON COLUMN gm_character_battle_event.character_id IS '이벤트 대상 캐릭터';
COMMENT ON COLUMN gm_character_battle_event.kind IS '피격 사망 경험치 재화 아이템 레벨업 이벤트 종류';
COMMENT ON COLUMN gm_character_battle_event.amount IS '피해 또는 지급 수량';
COMMENT ON COLUMN gm_character_battle_event.label IS '아이템 이름 등 표시 문구';
COMMENT ON COLUMN gm_character_battle_event.x IS '이벤트 바닥 X 좌표';
COMMENT ON COLUMN gm_character_battle_event.y IS '이벤트 바닥 Y 좌표';
COMMENT ON COLUMN gm_character_battle_event.reg_dtm IS '이벤트 생성 시각';
