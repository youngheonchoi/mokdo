# 로그인

로그인은 Google 로그인을 사용한다.

## 현재 화면과 인증 흐름

- `/`: 평화로운 숲길과 푸른 하늘의 픽셀 RPG 배경 가운데 `Google로 로그인` 버튼. 배경 이미지(`public/assets/login-forest.png`)는 로그인 화면과 `/characters`에서 공통으로 표시하고 화면 비율에 맞춰 중앙 기준으로 채운다.
- 버튼 → `/oauth2/authorization/google` → Google 인증 → 프로필의 `spring.security.oauth2.client.registration.google.redirect-uri`(서버 콜백).
- 서버는 Google ID 토큰을 검증하고 `sub`로 `mb_member_social`의 `GOOGLE` 연동을 조회한다.
- 로그인된 사용자도 매 서버 요청마다 `mb_member.status`를 확인한다. 관리자에서 밴 처리한 사용자는 다음 요청에서 세션이 종료되고 `401 account_disabled`를 받는다. 밴 해제 후 다시 로그인할 수 있다.
- 신규 회원은 `mb_member`와 `mb_member_social`에 UUID로 함께 저장한다. 기존 회원은 재사용하며 `BAN` 계정은 로그인을 거절한다.
- 인증 성공 → `/characters`. `/api/auth/session`에서 서버 세션을 확인한 다음 로그인 화면과 같은 숲길 배경에 캐릭터 선택 슬롯 3개를 표시한다. 빈 슬롯에서 닉네임 중복 확인 후 캐릭터를 생성한다. 상세 동작은 [캐릭터 선택과 생성](characters.md)을 참고한다.
- 유효한 세션이 있으면 메인 접근 시 버튼 없이 바로 숲길 배경의 `/characters` 화면을 표시한다.
- 로그인 성공 이력이 있는 브라우저는 세션이 만료됐을 때 Google 자동 재인증(`prompt=none`)을 한 번 시도한다. 성공하면 숲길 배경의 `/characters`로 이동하고, Google 세션·동의가 없거나 인증이 실패하면 로그인 버튼을 표시한다.
- 성공 이력은 `localStorage`에 표시만 저장하며 인증 여부는 항상 서버에서 확인한다. 토큰·비밀번호는 브라우저 저장소에 저장하지 않는다. 브라우저 데이터 삭제나 저장소 차단 시 버튼으로 다시 로그인한다.
- 인증 실패·취소 → 숲길 배경의 로그인 화면에 재시도 안내. 자동 재시도 이력은 지워 반복 이동을 막는다.
- 인증 실패 시 백엔드에 `Google login failed: code=..., cause=..., sqlState=...`를 기록한다. 토큰·인증 코드·예외 메시지·Google 사용자 식별자는 로그에 출력하지 않는다. `invalid_client`는 OAuth 클라이언트 인증, `authorization_request_not_found`는 로그인 시작 세션 유실, `member_storage_error`는 회원 DB 처리 문제를 확인한다.

## 설정 프로필과 실행

백엔드 설정은 `backend/src/main/resources/`에서 관리한다.

| 파일 | 역할 |
|---|---|
| `application-local.properties` | 로컬 실행에 필요한 전체 설정 및 비밀값 환경변수 참조 |
| `application-prod.properties` | 운영 실행에 필요한 전체 설정 및 비밀값 환경변수 참조 |

공통 `application.properties` 없이 두 프로필 파일을 독립적으로 관리한다. 실행할 때 `local` 또는 `prod` 프로필을 반드시 지정한다. 프로필 설정 파일에는 비밀값을 넣지 않는다. `change_value`와 `https://change-value.example`은 실제 값으로 채워야 하는 자리 표시자다. 로컬 Google Client ID와 운영 설정을 사용 전에 입력한다. Google Cloud Console의 OAuth 클라이언트에도 해당 프로필의 `spring.security.oauth2.client.registration.google.redirect-uri`와 **완전히 같은 값**을 승인된 리디렉션 URI로 등록한다. 이 URI는 인증 코드를 처리하는 서버 콜백이다.

로컬·개발에서는 다음 환경변수를 서버 실행 환경에 지정한다. 비밀번호와 Google Client Secret은 프런트엔드에 넣지 않는다.

```dotenv
DB_PASSWORD=your_neon_password
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 로컬 실행

로컬 앱은 공용 Neon 개발 DB `mokdo-dev`를 사용한다. Direct JDBC URL과 계정 `mokdo-dev_owner`는 두 프로젝트의 로컬 설정 파일에 지정되어 있다. 두 장소의 PC와 `mokdo_admin`에 같은 `DB_PASSWORD`를 지정한다. 백엔드 포트는 `8081`, 프런트엔드는 `8080`이다. Neon을 사용하면 로컬 PostgreSQL Docker는 실행하지 않아도 된다. 기존 Docker DB의 데이터는 별도로 이전해야 한다.

1. Neon의 Connect에서 Direct connection의 호스트·DB 이름·계정·비밀번호를 확인한다.
2. IDE나 실행 셸에 `DB_PASSWORD`, `GOOGLE_CLIENT_SECRET`을 설정한다. `.env` 파일은 Spring Boot 실행 환경에 자동으로 전달되지 않는다.
3. `application-local.properties`의 Google Client ID를 입력한다.
4. JDK 21 이상을 사용해 `backend/`에서 `./gradlew bootRun --args='--spring.profiles.active=local'`을 실행한다. IDE에서는 활성 프로필을 `local`로 지정한다. Flyway가 기존 마이그레이션을 적용한다.
5. 루트에서 `npm ci`, `npm run dev-nolog`를 실행하고 `http://localhost:8080`에 접속한다.

Vite 개발 서버는 `/api`, `/oauth2`, `/login/oauth2`를 백엔드로 전달한다. 로컬 Google 콜백은 `http://localhost:8081/login/oauth2/code/google`로 백엔드에 직접 돌아온다. Google Cloud Console의 승인된 리디렉션 URI에도 이 주소를 등록한다. 로그인 완료 후에는 `app.frontend-url`에 지정된 프런트엔드 `http://localhost:8080`으로 이동한다. 백엔드는 프로필에 지정한 리디렉션 URI의 경로를 콜백으로 처리한다.

### 운영 실행

`application-prod.properties`에 실제 DB 호스트·DB 이름·계정, Google Client ID, HTTPS 콜백·프런트엔드 주소를 채운다. 비밀값 두 개는 운영 환경의 값으로 전달하고 `prod` 프로필을 명시한다.

```bash
# backend/에서 빌드
./gradlew bootJar
# 생성된 JAR 실행 (실제 파일명에 맞춰 사용)
java -jar build/libs/backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
```

배포 환경에서 `SPRING_PROFILES_ACTIVE=prod`로 지정해도 된다. 프로필 선택은 비밀값이 아닌 실행 옵션이다. 운영 프로필은 SQL 출력이 꺼지고 HTTPS 전용 세션 쿠키가 적용된다.

프록시가 인증 경로들을 동일한 백엔드로 전달하도록 한다. 프런트엔드 서버는 `/characters` 새로고침에도 `index.html`을 반환해야 한다.

## 확인 항목

- 신규 Google 로그인 후 두 테이블에 회원과 `GOOGLE` 연동이 각각 하나 생성되는지 확인한다.
- 같은 Google 계정으로 다시 로그인해도 기존 `member_id`가 유지되는지 확인한다.
- 로그인 완료 및 새로고침 시 로그인 버튼 없이 같은 숲길 배경이 보이는지 확인한다.
- 처음 방문한 브라우저에서 비로그인 상태로 `/characters`에 접근하면 숲길 배경의 로그인 화면이 나오는지 확인한다.
- 이전 로그인 브라우저는 세션 만료 후 자동 인증을 한 번 시도하며, 실패 후 새로고침해도 자동 인증을 반복하지 않는지 확인한다.
- Google 동의 취소나 `BAN` 계정 로그인은 `/characters`로 넘어가지 않는지 확인한다.
