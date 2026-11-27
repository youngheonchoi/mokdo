# 캐릭터 선택과 생성

- 로그인 후 `/characters`에서 가로로 배치된 슬롯 3개를 표시한다. 모바일에서도 가로 3칸을 유지한다.
- 빈 슬롯의 `캐릭터 생성`을 누르면 `/characters/create?slot=1`처럼 해당 슬롯의 생성 화면으로 이동한다. 새로고침과 직접 접근에도 서버 세션과 슬롯 상태를 확인한다.
- 로그인·선택·생성 화면 모두 `public/assets/login-forest.png` 배경을 사용한다.
- 앱 전체에서 Tab과 Shift+Tab의 기본 포커스 이동을 막는다. 마우스로 입력란을 선택하거나 화면 진입 시 입력란에 자동 포커스하는 동작은 유지한다.
- 닉네임은 한글 완성형, 영문, 숫자 2~12자다. 공백·특수문자·이모지·단독 자음/모음은 허용하지 않는다. 한글은 NFC로 정규화하고 영문 대소문자는 중복 판단에서 구분하지 않는다.
- `중복 확인`을 통과해야 생성 버튼이 활성화된다. 입력을 바꾸면 다시 확인해야 한다. 서버에서도 생성 시 닉네임·슬롯을 검증한다.
- 생성 완료 후 선택 화면으로 돌아와 저장된 닉네임을 표시한다. 기존 캐릭터는 클릭하면 `/game?characterId=…`로 바로 입장한다. 입장·새로고침 시 서버 목록을 다시 조회해 본인 캐릭터인지 확인한다. 본인 목록에 없는 ID는 선택창으로 돌려보낸다.
- 사용 중인 슬롯은 캐릭터 이미지 → 닉네임 → 레벨 순서로 표시한다. API의 저장된 `level`을 사용한다. `선택하기`와 빈 슬롯의 `새로운 모험 시작` 문구는 표시하지 않는다.
- 사용 중인 카드 오른쪽 위 X 버튼으로 삭제 창을 연다. 닉네임을 대소문자·공백까지 그대로 입력해야 삭제 버튼이 활성화된다. 서버도 소유자·캐릭터 ID·닉네임을 한 DELETE 조건으로 확인한다. 삭제는 복구할 수 없으며 완료 시 빈 슬롯으로 갱신한다. 취소와 Escape로 창을 닫을 수 있고, 요청 중에는 중복 제출과 닫기를 막는다.
- 기본 코스튬도 `gm_costume`에 등록하며 외형 코드는 `common-character-01`이다. 기본 이미지도 로컬 에셋 폴더에서 읽고, 파일 누락 시 `public/assets/characters/common_character_01.png`를 대체 이미지로 사용한다. 코스튬을 장착하면 API의 `appearanceCode`에 맞는 외형을 사용한다. 선택 슬롯에는 동쪽 걷기 모션을 초당 8프레임으로 반복 표시한다. 동작 줄이기 설정에서는 동쪽 대기 프레임을 표시한다. 원본 투명 스프라이트 시트는 변경하지 않고 표시 영역만 지정한다.

## 기본 캐릭터 프레임

기본 무기는 제공된 새 64×64 투명 PNG를 그대로 복사한 `local-assets/weapons/wooden-club.png`다. 선택창에서는 API의 `weapon.appearanceCode`에 해당하는 장착 무기를 인게임과 같은 동쪽 방향·기울기로 표시한다. 무기는 몸에서 간격을 두며, 이미지의 손잡이 기준점을 읽어 종횡비를 유지한다. 미장착(`weapon: null`)이면 무기를 표시하지 않는다. 캐릭터 표시 크기에 비례해 축소·확대하며 픽셀 보간을 끈다. 기본 몽둥이의 파일이 누락되면 기존 번들 이미지를 대체 표시하며 다른 무기의 파일이 누락되면 해당 이미지를 숨긴다. 게임에서도 같은 외형 정보를 읽어 캐릭터 옆에 장착 무기를 표시한다. 게임에서 Z로 장착 무기를 휘두를 수 있으며 V16부터 몬스터와 피해 판정·보상·성장을 지원한다.

`src/game/characters/defaultCharacter.ts`에서 128×352 원본 시트의 43개 프레임을 관리한다. 셀은 여백 없이 32×32이며, 열 4개·행 11개 중 마지막 셀은 비어 있다. 방향은 화면 기준 동·서·남·북과 네 대각선 방향이다. 각 방향의 전용 대기·걷기·점프 프레임을 사용하며 좌우 반전으로 대체하지 않는다.

| 시트 위치(0부터 시작) | 내용 |
|---|---|
| 행 0~2 | 기존 정면·좌우·뒷면 걷기, 피격·주저앉음·죽음 |
| 행 3 | 남서·남동 걷기 각 2프레임 |
| 행 4 | 북서·북동 걷기 각 2프레임 |
| 행 5~8 | 남 → 남서 → 서 → 북서 → 북 → 북동 → 동 → 남동 순서의 웅크림·점프 각 2프레임 |
| 행 9~10 | 남서를 시작으로 위 순서의 7방향 대기. 남쪽 대기는 행 0·열 0 |

기존 JSON 없는 코스튬은 Phaser `Forest` 씬에서 아래 고정 아틀라스를 로드한다. `walk-{방향}`은 대기 → 걷기 1 → 대기 → 걷기 2를 초당 8프레임으로 반복하고, `jump-{방향}`은 웅크림 → 공중 → 해당 방향 대기를 재생한다. `death`는 피격 → 주저앉음 → 쓰러짐으로 구성한다. 선택창은 같은 동쪽 프레임 정의를 Web Animations API로 재생한다. 벨트스크롤 게임은 원본 시트의 동·서 프레임을 골라 사용하며 위아래 이동 중에는 마지막 좌우 방향을 유지한다. 캐릭터는 기본 정수 3배 확대하고 화면 높이에 맞춘 카메라 줌을 적용한다. 시트와 관리자 업로드 규격은 유지한다.

## API와 저장

Flyway V11에서 캐릭터의 `level`·`exp`와 `gm_character_level` 설정을 추가한다. 목록·생성 응답은 저장된 레벨·경험치 및 V16의 현재 체력·재화와 해당 레벨의 기본 `maxHp`·`attack`·`defense`·`requiredExp`를 포함한다. 자세한 설정 방식과 구현 범위는 [레벨과 능력치](character-levels.md)를 참고한다.

| 메서드·경로 | 동작 |
|---|---|
| `GET /api/characters` | 인증된 회원의 캐릭터 목록, 슬롯 순서 |
| `GET /api/characters/nickname-check?nickname=…` | 형식 검증 후 전체 캐릭터 기준 중복 확인 |
| `GET /api/auth/csrf` | 생성 요청에 사용할 CSRF 헤더명과 토큰 |
| `POST /api/characters` | `{ "slotNo": 1, "nickname": "모험가" }`로 생성, 성공 시 201 |
| `DELETE /api/characters/{characterId}` | `{ "nickname": "모험가" }`가 저장된 닉네임과 정확히 일치하고 본인 캐릭터일 때 영구 삭제, 성공 시 204 |
| `GET /api/costumes` | 인증된 회원의 보유 코스튬 목록(`costumeId`, `name`, `appearanceCode`) |
| `PUT /api/characters/{characterId}/costume` | `{ "costumeId": "UUID" }`로 보유 코스튬 장착, 기본으로 돌아갈 때도 기본 코스튬 UUID를 전달한다. `null`은 400, 성공 시 204 |
| `GET /api/characters/{characterId}/items` | 인증 회원이 소유한 캐릭터의 보유 아이템 목록, 종류·수량·장착 여부 포함. 본인 캐릭터가 아니면 빈 목록 |
| `PUT /api/characters/{characterId}/weapon` | `{ "characterItemId": "보유 아이템 UUID" }`로 무기 장착·교체, `null`이면 해제, 성공 시 204 |

모든 API는 로그인 세션이 필요하고 응답을 캐시하지 않는다. 생성·삭제·장착 요청은 CSRF 토큰을 헤더에 포함한다. `member_id`는 요청 본문 대신 인증된 회원 정보를 사용한다.

## 코스튬 보유와 장착

현재 기본 지정은 Flyway V9의 `gm_costume.is_default`로 관리한다. 관리자 코스튬 상세에서 하나를 지정하면 새 캐릭터에 그 코스튬을 지급·장착한다. 초기 외형 코드 `common-character-01`에 고정하지 않으며 기존 캐릭터 장착은 유지한다. 부분 고유 인덱스와 관리자 변경 트랜잭션으로 기본 중복 지정을 막는다.

관리자에서 PNG(최대 2048×2048·5MB)와 JSON(최대 256KB)을 함께 업로드하면 Neon Storage 키를 `gm_costume.image_key`에 저장한다. 게임은 `/api/costumes/{appearanceCode}/image`로 인증 후 조회하고 서버가 공개 스토리지 PNG를 전달한다. 외형 코드를 바꿔도 업로드한 파일은 유지된다. 미업로드 코스튬은 로컬 파일을 사용한다. 아래 V5/V6 설명은 초기 스키마·기본 데이터 기록이며 현재 업로드·기본 관리 방식은 [관리자 문서](admin.md)를 따른다.

`V5__gm_costume.sql`은 다음 구조를 추가한다. 이어서 `V6__gm_character_default_costume.sql`이 기본 코스튬을 등록하고 기존 회원 모두에게 지급하며, NULL인 장착 값을 기본 코스튬으로 채운 뒤 NOT NULL을 적용한다. 기존에 장착한 다른 코스튬은 유지한다.

- `gm_costume`: 코스튬 정의(`costume_id`, `name`, 고유 `appearance_code`).
- `mb_member_costume`: 회원 단위 보유 목록. 같은 회원·코스튬은 한 번만 저장하며 계정 내 캐릭터가 공유한다.
- `gm_character.equipped_costume_id`: 캐릭터별 장착 코스튬이며 NULL을 허용하지 않는다. `(member_id, equipped_costume_id)` 복합 외래키로 해당 회원이 보유한 코스튬만 참조한다. 장착 중인 보유 행 삭제는 거절되므로 회수할 때는 먼저 관련 캐릭터를 기본 코스튬 등 다른 보유 코스튬으로 변경해야 한다. 캐릭터를 삭제해도 회원의 보유 목록은 유지된다.

목록 API의 캐릭터 응답은 `equippedCostumeId`와 `appearanceCode`를 포함한다. 기본 외형 코드는 `common-character-01`이다. 일반 코스튬 코드는 `/asset-files/characters/costumes/{appearanceCode}.png`와 연결하며 영문 소문자·숫자·밑줄·하이픈만 사용한다(첫 글자는 영문 소문자 또는 숫자, 최대 64자). 기본 코드 `common-character-01`은 파일명을 유지하기 위해 `/asset-files/characters/costumes/common_character_01.png`로 연결한다. 코드가 잘못되거나 파일을 불러오지 못하면 기본 이미지로 대체한다.

새 코스튬은 PNG와 내보내기 JSON을 한 쌍으로 등록한다. JSON의 셀 크기·행 위치·방향·프레임 수로 재생하므로 기존 43프레임 배치를 따를 필요가 없다. 기존 JSON 없는 코스튬·로컬 파일은 128×352·32×32 고정 배치를 유지한다. 선택창도 JSON의 동쪽 걷기를 재생한다. 자세한 규격은 [에셋 JSON](sprite-assets.md)을 참고한다. 무기 표시는 코스튬과 별개로 유지한다.

캐릭터 생성 시 서버는 `is_default = TRUE`인 기본 코스튬 정의를 조회해 회원에게 중복 없이 지급한 뒤 해당 UUID를 장착해 저장한다. 기본 코스튬으로 돌아갈 때도 일반 코스튬과 동일하게 보유한 UUID를 장착한다. 임의 구매·결제·보유 지급 API와 코스튬 선택 UI는 아직 구현하지 않았다. 구매 연동 시 서버에서 결제/획득을 검증한 뒤 `mb_member_costume`에 지급해야 하며 클라이언트 요청만으로 보유 행을 생성하면 안 된다. 장착 API 성공 후 캐릭터 목록을 다시 조회하면 선택창에 반영된다.

## 로컬 에셋 파일 관리

관리자에서 이미지를 업로드하지 않은 코스튬은 `application-local.properties`의 `app.assets.path` 폴더에 직접 PNG 파일을 넣는다. 기본값은 `${ASSET_PATH:../local-assets}`이며 `backend/`를 작업 디렉터리로 실행하면 프로젝트 루트의 `local-assets/`를 가리킨다. IDE의 작업 디렉터리가 다르면 절대 경로로 설정하거나 `ASSET_PATH` 환경변수를 지정한다. 경로 설정을 바꾸면 백엔드를 재시작한다.

```properties
app.assets.path=/Users/okerry/Desktop/okerry/project/mokdo/local-assets
```

```text
local-assets/
  characters/costumes/common_character_01.png
  characters/costumes/forest-ranger.png
  weapons/wooden-club.png
```

- `appearance_code = forest-ranger`인 코스튬은 위 `forest-ranger.png`를 사용한다. 코스튬 정의·회원 보유·캐릭터 장착 정보도 DB에 있어야 선택창에 적용된다. 파일 추가만으로 코스튬 지급이나 장착은 되지 않는다.
- 코스튬 파일은 128×352와 새 8방향 프레임 배치를 유지한다. 무기는 별도 PNG이며 `/asset-files/weapons/{code}.png`로 읽을 수 있다. 기본 코스튬은 `common_character_01.png`, 기본 무기는 `wooden-club.png`를 사용한다. 파일 누락에 대비한 기본 캐릭터·몽둥이 대체 이미지는 기존 번들 에셋을 유지한다.
- 파일을 추가하거나 교체한 뒤 새로고침하면 반영된다. 파일 변경에는 서버 재시작이나 프런트 재빌드가 필요 없다. 로컬 파일 응답은 `Cache-Control: no-store`다.
- 폴더는 Git에서 제외한다. 서버는 로그인한 사용자에게 지정된 코스튬·무기 PNG 경로만 제공하며 폴더 목록이나 폴더 밖 파일은 제공하지 않는다.
- Vite는 `/asset-files`를 백엔드로 프록시한다. 운영에서도 이 경로를 백엔드로 연결해야 한다. 운영 프로필에는 경로를 기본 설정하지 않으므로 파일 제공 기능은 꺼져 있다. 운영 파일 저장소 방식이 정해지면 별도 구성한다.

기존 `V3__gm_character.sql`을 유지하고 `V4__gm_character_unique_nickname.sql`에서 `LOWER(nickname)` 고유 인덱스를 추가한다. 이미 영문 대소문자만 다른 중복 닉네임이 있으면 배포 전에 정리해야 한다. 회원 행 잠금으로 같은 회원의 동시 생성을 직렬화하며, 기존 회원·슬롯 고유 제약과 닉네임 고유 인덱스로 충돌을 방지한다. 애플리케이션은 슬롯 1~3만 허용한다.

프런트엔드 서버는 `/characters`, `/characters/create`, `/game` 모두 새로고침 시 `index.html`을 반환해야 한다. 게임 화면 구성과 조작은 [숲 탐험](game.md)을 참고한다.

## 기본 코스튬 등록 SQL

기본 이름은 `기본 코스튬`, 외형 코드는 `common-character-01`, 최초 UUID는 `10000000-0000-4000-8000-000000000001`이다. 일반 코스튬 정의와 같은 테이블에 저장하므로 나중에 관리자 코스튬 목록에서도 조회할 수 있다. UUID를 화면에 하드코딩하지 않고 API의 `costumeId`/`equippedCostumeId`를 사용한다.

직접 등록할 INSERT문은 [default_costume.sql](../sql/default_costume.sql)에 있다. Flyway V6에서도 같은 행을 자동 등록하므로 별도로 실행할 필요는 없으며, 같은 외형 코드가 이미 있으면 중복 삽입하지 않는다. 기존 코드에 다른 UUID가 있으면 그 UUID를 그대로 사용한다.

실제 파일 위치는 `local-assets/characters/costumes/common_character_01.png`다. `characters.costumes`라는 이름의 단일 폴더가 아니라 기존 `characters/costumes` 하위 폴더를 사용한다. 이미지 내용은 변경하지 않고 외형 코드와 파일명을 맞춘다.
