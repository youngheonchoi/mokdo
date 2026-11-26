# 로그인

로그인은 Google 로그인을 사용한다.

## 현재 화면과 인증 흐름

- `/`: 검정 배경 가운데 `Google로 로그인` 버튼.
- 버튼 → `/oauth2/authorization/google` → Google 인증 → 프로필의 `spring.security.oauth2.client.registration.google.redirect-uri`(서버 콜백).
- 서버는 Google ID 토큰을 검증하고 `sub`로 `mb_member_social`의 `GOOGLE` 연동을 조회한다.
- 신규 회원은 `mb_member`와 `mb_member_social`에 UUID로 함께 저장한다. 기존 회원은 재사용하며 `BAN` 계정은 로그인을 거절한다.
- 인증 성공 → `/characters`. `/api/auth/session`에서 서버 세션을 확인한 다음 흰 배경만 표시한다. 캐릭터나 게임 이미지는 로드하지 않는다.
- 유효한 세션이 있으면 메인 접근 시 버튼 없이 바로 흰 화면을 표시한다.
- 로그인 성공 이력이 있는 브라우저는 세션이 만료됐을 때 Google 자동 재인증(`prompt=none`)을 한 번 시도한다. 성공하면 흰 화면으로 이동하고, Google 세션·동의가 없거나 인증이 실패하면 로그인 버튼을 표시한다.
- 성공 이력은 `localStorage`에 표시만 저장하며 인증 여부는 항상 서버에서 확인한다. 토큰·비밀번호는 브라우저 저장소에 저장하지 않는다. 브라우저 데이터 삭제나 저장소 차단 시 버튼으로 다시 로그인한다.
- 인증 실패·취소 → 검정 로그인 화면에 재시도 안내. 자동 재시도 이력은 지워 반복 이동을 막는다.

## 설정 프로필과 실행

백엔드 설정은 `backend/src/main/resources/`에서 관리한다.

| 파일 | 역할 |
|---|---|
| `application-local.properties` | 로컬 실행에 필요한 전체 설정 및 비밀값 환경변수 참조 |
| `application-prod.properties` | 운영 실행에 필요한 전체 설정 및 비밀값 환경변수 참조 |

공통 `application.properties` 없이 두 프로필 파일을 독립적으로 관리한다. 실행할 때 `local` 또는 `prod` 프로필을 반드시 지정한다. 프로필 설정 파일에는 비밀값을 넣지 않는다. `change_value`와 `https://change-value.example`은 실제 값으로 채워야 하는 자리 표시자다. 로컬 Google Client ID와 운영 설정을 사용 전에 입력한다. Google Cloud Console의 OAuth 클라이언트에도 해당 프로필의 `spring.security.oauth2.client.registration.google.redirect-uri`와 **완전히 같은 값**을 승인된 리디렉션 URI로 등록한다. 이 URI는 인증 코드를 처리하는 서버 콜백이다.

환경변수로 전달하는 비밀값은 다음 두 개다. 프런트엔드에는 넣지 않는다.

```dotenv
DB_PASSWORD=your_database_password
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 로컬 실행

로컬 설정은 PostgreSQL `localhost:5432/mokdo`, DB 계정 `mokdo`, 백엔드 `8081`, 프런트엔드 `8080`이다. `infra/compose.yml`의 DB 이름·계정도 동일하다. 이를 변경하면 두 파일을 함께 수정한다. 기존 PostgreSQL 볼륨의 DB 이름·계정은 Compose 설정을 수정해도 자동 변경되지 않는다.

1. `infra/.env.example`을 `infra/.env`로 복사하고 비밀값을 채운다. 이미 `.env`가 있으면 기존 비밀값을 유지한다.
2. `infra/`에서 `docker compose up -d`로 DB를 실행한다. Compose는 `DB_PASSWORD`를 사용한다. `.env`는 백엔드 프로세스에 자동 전달되지 않으므로 IDE나 실행 셸에도 위 두 환경변수를 설정한다.
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
- 로그인 완료 및 새로고침 시 이미지·문구 없이 흰 화면만 보이는지 확인한다.
- 처음 방문한 브라우저에서 비로그인 상태로 `/characters`에 접근하면 검정 로그인 화면이 나오는지 확인한다.
- 이전 로그인 브라우저는 세션 만료 후 자동 인증을 한 번 시도하며, 실패 후 새로고침해도 자동 인증을 반복하지 않는지 확인한다.
- Google 동의 취소나 `BAN` 계정 로그인은 흰 화면으로 넘어가지 않는지 확인한다.
