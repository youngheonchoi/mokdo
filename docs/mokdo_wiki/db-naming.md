# DB 네이밍 규칙

## 테이블명

```
{분류}_{테이블명}_{상세}
```

- `{분류}`: 도메인을 나타내는 약어 코드 (아래 분류 코드 표 참고)
- `{테이블명}`: 대상 엔티티 이름
- `{상세}`: 하위 테이블이나 세부 구분이 필요할 때만 붙인다. 없으면 생략한다.
- 모두 소문자 snake_case로 쓴다.
- 예약어와 겹치는 이름(예: `character`)은 단독으로 쓰지 않는다. 분류 접두사를 붙여 피한다.

### 분류 코드

| 분류 | 의미 |
|---|---|
| `mb` | 회원(member) |
| `gm` | 인게임(game) |

새 분류를 추가할 때는 이 표에 먼저 등록한다.

### 예시

| 테이블명 | 설명 |
|---|---|
| `mb_member` | 회원 |
| `mb_member_social` | 회원 소셜 연동 정보 |
| `gm_character` | 인게임 캐릭터 |

## 제약조건 및 인덱스명

```
{접두사}_{테이블명}_{대상}
```

| 접두사 | 의미 | 예시 |
|---|---|---|
| `pk_` | PRIMARY KEY | `pk_mb_member` |
| `fk_` | FOREIGN KEY | `fk_mb_member_social_member_id` |
| `uq_` | UNIQUE | `uq_mb_member_social_provider_provider_subject` |
| `chk_` | CHECK | `chk_mb_member_status` |
| `idx_` | 일반 인덱스 | `idx_gm_character_member` |

- `{테이블명}`은 분류 접두사를 포함한 전체 테이블명이다.
- `{대상}`은 제약이 걸린 컬럼명을 그대로 이어 붙인다. 예: `(provider, provider_subject)` → `provider_provider_subject`

## 외래키 규칙

- `ON DELETE CASCADE`는 사용하지 않는다. 앞으로도 쓰지 않는다.
- `ON UPDATE CASCADE`, `ON DELETE SET NULL` 같은 참조 동작 옵션도 지정하지 않고 기본 동작(`NO ACTION`)을 쓴다.
- 부모 행을 삭제하려면 자식 행을 애플리케이션에서 먼저 명시적으로 삭제해야 한다. 자식이 남아 있으면 DB가 삭제를 거부한다.

## 컬럼명

- 소문자 snake_case로 쓴다.
- 컬럼명에는 분류 접두사를 붙이지 않는다.
- PK 컬럼은 `{엔티티}_id`로 쓴다. 예: `member_id`, `member_social_id`, `character_id`
- 일시 컬럼은 `_dtm`으로 끝낸다. 예: `reg_dtm`, `mod_dtm`, `link_dtm`

## 주석

- 모든 테이블과 컬럼에 `COMMENT ON`으로 한글 설명을 단다.
