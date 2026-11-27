# 관리자 계정

`mokdo_admin`은 mokdo 게임 운영용 관리자 페이지다. 게임 회원인 `mb_member`와 별도로 `ad_admin`에서 관리자 계정을 관리한다.

## DB와 마이그레이션

두 프로젝트는 같은 PostgreSQL DB를 사용하며, Flyway 마이그레이션은 `mokdo/backend/src/main/resources/db/migration/` 한 곳에서 관리한다. `V8__ad_admin.sql`이 관리자 테이블을 생성한다. 기본 계정이나 공통 비밀번호는 마이그레이션에 넣지 않는다.

`mokdo_admin`에서는 Flyway를 실행하지 않고 Hibernate 설정은 `spring.jpa.hibernate.ddl-auto=validate`를 사용한다. 관리자 서버를 실행하기 전에 `mokdo` 백엔드에서 마이그레이션을 적용해야 한다. 현재 추가된 것은 테이블 정의이며 관리자 화면·로그인·초기 계정 생성 기능은 아직 구현하지 않았다.

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

- 로컬: PostgreSQL `localhost:5432/mokdo`, DB 계정 `mokdo`, 관리자 서버 포트 `8082`를 사용한다. IDE의 활성 프로필을 `local`로 설정하거나 프로젝트 루트에서 `.\gradlew.bat bootRun --args='--spring.profiles.active=local'`로 실행한다.
- 운영: `application-prod.properties`의 `change_value`를 실제 DB 호스트·DB 이름·계정으로 변경하고 `prod` 프로필로 실행한다. HTTPS 전용 세션 쿠키와 Thymeleaf 캐시를 사용하고 SQL 출력은 끈다.
- 두 환경 모두 비밀번호는 실행 환경변수 `DB_PASSWORD`로 전달한다. `mokdo/infra/.env`는 관리자 서버에 자동으로 전달되지 않는다.
- 게임과 관리자 세션의 충돌을 피하도록 관리자 세션 쿠키 이름은 `MOKDO_ADMIN_SESSION`을 사용한다.
- Flyway는 두 프로필 모두 비활성화하고 `ddl-auto=validate`로 설정한다. 스키마 변경은 `mokdo` 백엔드에서 먼저 적용한다.

## 계정 운영 방식

아래 동작은 관리자 애플리케이션 구현 시 적용할 규칙이다.

- 최초 `SUPER_ADMIN`은 별도 초기 설정으로 생성한다. 이후 관리자 계정은 활성 `SUPER_ADMIN`이 관리자 관리 메뉴에서 이름·아이디·비밀번호를 직접 입력해 등록한다.
- 등록한 정보를 구두로 전달하고, 관리자는 전달받은 아이디·비밀번호로 바로 로그인한다. 초대 메일·자체 가입·최초 비밀번호 변경 강제 절차는 두지 않는다.
- 비밀번호는 BCrypt 등 비밀번호 해시로 저장한다. 저장된 비밀번호를 조회하거나 복호화하지 않는다. 잊어버리면 `SUPER_ADMIN`이 새 비밀번호를 지정해 다시 전달한다.
- 관리자 관리 메뉴의 등록·수정·비밀번호 재설정·상태 변경은 활성 `SUPER_ADMIN`만 수행할 수 있다. 사용 중지 계정은 로그인할 수 없으며 기존 세션으로도 관리자 기능을 사용할 수 없게 한다.
- 계정은 물리 삭제 대신 `INACTIVE`로 사용을 중지한다. 마지막 활성 `SUPER_ADMIN`의 사용 중지·일반 관리자 변경은 동시 요청에도 막아야 한다. 이 규칙은 테이블 CHECK 제약으로 보장되지 않으므로 애플리케이션 트랜잭션에서 처리한다.
- 로그인 성공 시 `last_login_dtm`, 계정 정보 수정 시 `mod_admin_id`·`mod_dtm`을 애플리케이션에서 갱신한다. DB가 수정 일시를 자동 갱신하지는 않는다.

메뉴별 접근 권한이 필요해지면 역할·권한 테이블을 분리한다. 현재는 역할 코드 두 개로 시작한다.
