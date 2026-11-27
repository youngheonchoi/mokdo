# 관리자 계정

`mokdo_admin`은 mokdo 게임 운영용 관리자 페이지다. 게임 회원인 `mb_member`와 별도로 `ad_admin`에서 관리자 계정을 관리한다.

## DB와 마이그레이션

두 프로젝트는 같은 PostgreSQL DB를 사용하며, Flyway 마이그레이션은 `mokdo/backend/src/main/resources/db/migration/` 한 곳에서 관리한다. `V8__ad_admin.sql`이 관리자 테이블을 생성한다. 기본 계정이나 공통 비밀번호는 마이그레이션에 넣지 않는다.

`mokdo_admin`에서는 Flyway를 실행하지 않고 Hibernate 설정은 `spring.jpa.hibernate.ddl-auto=validate`를 사용한다. 관리자 서버를 실행하기 전에 `mokdo` 백엔드에서 마이그레이션을 적용해야 한다. 관리자 로그인, 공통 좌측 메뉴, 빈 대시보드, 관리자 목록·등록·상세 수정 화면을 구현했다.

| 컬럼 | 설명 |
|---|---|
| `admin_id` | 애플리케이션에서 생성하는 UUID PK |
| `login_id` | 영문 소문자·숫자 1~50자, 고유 로그인 ID |
| `password_hash` | 비밀번호 해시, 최대 255자 |
| `name` | 관리자 이름, 최대 50자, 공백만 입력 불가 |
| `role_code` | `SUPER_ADMIN`, `ADMIN` (기본값) |
| `status_code` | `ACT` (기본값), `INACTIVE` |
| `last_login_dtm` | 마지막 로그인 일시, 최초에는 NULL |
| `reg_admin_id` | 등록한 관리자 참조, 최초 계정 생성 시 NULL 허용 |
| `mod_admin_id` | 마지막 수정 관리자 참조, 최초 계정 생성 시 NULL 허용 |
| `reg_dtm`, `mod_dtm` | 등록·수정 일시, 최초 기본값은 현재 시각 |

아이디는 애플리케이션에서 영문 소문자로 정규화하고 등록·로그인·중복 확인에 같은 규칙을 적용한다. DB는 소문자·숫자 형식과 중복 방지를 보장한다. 외래키는 참조 동작 옵션 없이 기본 `NO ACTION`을 사용한다.

## 설정 프로필과 실행

`mokdo_admin/src/main/resources/`의 `application-local.properties`와 `application-prod.properties`에 각각 전체 설정을 둔다. 공통 `application.properties`는 사용하지 않으며 실행 시 `local` 또는 `prod` 프로필을 명시한다.

- 로컬·개발: 두 장소의 PC에서 같은 Neon 개발 DB `mokdo-dev`를 사용한다. Direct JDBC URL과 계정 `mokdo-dev_owner`는 두 프로젝트의 `application-local.properties`에 설정한다. DB 관련 환경변수는 `DB_PASSWORD`만 같은 값으로 지정한다. URL에는 `sslmode=require&channelBinding=require`를 적용한다. 관리자 서버 포트는 `8082`다. IDE의 활성 프로필을 `local`로 설정하거나 프로젝트 루트에서 `.\gradlew.bat bootRun --args='--spring.profiles.active=local'`로 실행한다.
- 운영: `application-prod.properties`의 `change_value`를 실제 DB 호스트·DB 이름·계정으로 변경하고 `prod` 프로필로 실행한다. HTTPS 전용 세션 쿠키와 Thymeleaf 캐시를 사용하고 SQL 출력은 끈다.
- 로컬·운영 모두 비밀번호는 실행 환경변수 `DB_PASSWORD`로 전달한다. `mokdo/infra/.env`는 관리자 서버에 자동으로 전달되지 않는다.
- 게임과 관리자 세션의 충돌을 피하도록 관리자 세션 쿠키 이름은 `MOKDO_ADMIN_SESSION`을 사용한다.
- Flyway는 두 프로필 모두 비활성화하고 `ddl-auto=validate`로 설정한다. 스키마 변경은 `mokdo` 백엔드에서 먼저 적용한다.

## 계정 운영 방식

아래 동작은 관리자 애플리케이션에 적용된 규칙이다.

- 최초 `SUPER_ADMIN`은 별도 초기 설정으로 생성한다. 이후 관리자 계정은 활성 `SUPER_ADMIN`이 관리자 관리 메뉴에서 이름·아이디·비밀번호를 직접 입력해 등록한다.
- 등록한 정보를 구두로 전달하고, 관리자는 전달받은 아이디·비밀번호로 바로 로그인한다. 초대 메일·자체 가입·최초 비밀번호 변경 강제 절차는 두지 않는다.
- 비밀번호는 BCrypt 등 비밀번호 해시로 저장한다. 저장된 비밀번호를 조회하거나 복호화하지 않는다. 잊어버리면 `SUPER_ADMIN`이 새 비밀번호를 지정해 다시 전달한다.
- 관리자 관리 메뉴의 등록·수정·비밀번호 재설정·상태 변경은 활성 `SUPER_ADMIN`만 수행할 수 있다. 사용 중지 계정은 로그인할 수 없으며 기존 세션으로도 관리자 기능을 사용할 수 없게 한다.
- 계정은 물리 삭제 대신 `INACTIVE`로 사용을 중지한다. 마지막 활성 `SUPER_ADMIN`의 사용 중지·일반 관리자 변경은 동시 요청에도 막아야 한다. 이 규칙은 테이블 CHECK 제약으로 보장되지 않으므로 애플리케이션 트랜잭션에서 처리한다.
- 로그인 성공 시 `last_login_dtm`, 계정 정보 수정 시 `mod_admin_id`·`mod_dtm`을 애플리케이션에서 갱신한다. DB가 수정 일시를 자동 갱신하지는 않는다.

메뉴별 접근 권한이 필요해지면 역할·권한 테이블을 분리한다. 현재는 역할 코드 두 개로 시작한다.

## 화면과 접근 권한

| 경로 | 화면 | 접근 권한 |
|---|---|---|
| `/login` | 아이디·비밀번호 로그인 | 비로그인 포함 |
| `/`, `/dashboard` | 빈 대시보드와 공통 좌측 메뉴 | 활성 관리자 |
| `/members` | 사용자 목록, 사용자 ID·캐릭터 닉네임 검색, 정상/이용 정지 상태 필터, 20명 단위 페이지 이동 | 활성 관리자 |
| `/members/{id}` | 사용자 기본 정보, 소셜 연동 제공자·연동일, 보유 캐릭터 조회 | 활성 관리자 |
| `/admins` | 관리자 목록, 이름·아이디 검색, 20개 단위 페이지 이동 | 활성 최고 관리자 |
| `/admins/new` | 이름·아이디·비밀번호·권한·상태로 등록 | 활성 최고 관리자 |
| `/admins/{id}` | 관리자 상세, 이름·권한·상태 수정, 비밀번호 재설정 | 활성 최고 관리자 |

- 로그인 ID는 등록 시 소문자로 정규화하며 이후 변경하지 않는다.
- 비밀번호는 8자 이상, UTF-8 기준 72바이트 이내로 입력한다. BCrypt 해시로 저장하고 화면에 기존 값이나 해시를 출력하지 않는다. 수정 화면에서 새 비밀번호를 비워두면 기존 비밀번호를 유지한다.
- 로그인 성공 시 대시보드로 이동한다. 로그아웃 및 계정 변경 요청에는 CSRF 토큰이 필요하다.
- 매 요청에서 DB의 계정 상태·권한을 확인한다. 사용 중지 또는 비밀번호 변경 시 기존 세션은 다음 요청에서 종료되고, 권한 변경은 다음 요청에 적용된다.
- 계정 생성·수정 트랜잭션은 PostgreSQL `LOCK TABLE ad_admin IN SHARE ROW EXCLUSIVE MODE`로 직렬화한다. 최초 계정 중복 생성과 마지막 활성 최고 관리자를 동시에 사용 중지하는 요청을 방지한다.

사용자 관리는 `mb_member`, `mb_member_social`, `gm_character`의 기존 데이터를 읽는다. 이름·이메일은 현재 사용자 DB에 저장되어 있지 않아 검색 대상에 포함하지 않는다. 모든 캐릭터 닉네임을 검색하며 사용자 한 명당 목록 한 행을 표시한다. 목록의 첫 번째 캐릭터는 가장 낮은 슬롯 번호의 닉네임이다. 현재는 정보 조회를 제공하며, 소셜 제공자 고유 식별자는 화면에 표시하지 않는다. 기존 테이블을 그대로 사용하므로 추가 마이그레이션은 없다.

## 최초 최고 관리자 생성

최초 실행 때만 관리자 서버 실행 환경에 다음 값을 설정한다. 계정이 하나라도 있으면 새 초기 계정을 만들거나 기존 계정 비밀번호를 덮어쓰지 않는다.

| 환경변수 | 값 |
|---|---|
| `ADMIN_BOOTSTRAP_ENABLED` | `true` |
| `ADMIN_BOOTSTRAP_LOGIN_ID` | 사용할 아이디(영문 소문자·숫자 1~50자) |
| `ADMIN_BOOTSTRAP_PASSWORD` | 직접 지정한 비밀번호(8자 이상, UTF-8 72바이트 이내) |
| `ADMIN_BOOTSTRAP_NAME` | 최초 최고 관리자 이름 |

기본 아이디·비밀번호는 없다. 계정 생성 후 위 환경변수를 제거하고 이후 실행한다. DB 접속용 비밀번호 환경변수 `DB_PASSWORD`는 계속 필요하다. 일반 관리자 계정은 최초 최고 관리자로 로그인한 후 관리자 등록 화면에서 만든다.
