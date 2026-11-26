# 로그인

로그인은 Google 로그인을 사용한다.

## 현재 화면과 인증 흐름

- `/`: 검정 배경 가운데 `Google로 로그인` 버튼.
- 버튼 → `/oauth2/authorization/google` → Google 인증 → `GOOGLE_REDIRECT_URI`(서버 콜백).
- 서버는 Google ID 토큰을 검증하고 `sub`로 `mb_member_social`의 `GOOGLE` 연동을 조회한다.
- 신규 회원은 `mb_member`와 `mb_member_social`에 UUID로 함께 저장한다. 기존 회원은 재사용하며 `BAN` 계정은 로그인을 거절한다.
- 인증 성공 → `/characters`. `/api/auth/session`에서 서버 세션을 확인한 다음 흰 배경만 표시한다. 캐릭터나 게임 이미지는 로드하지 않는다.
- 유효한 세션이 있으면 메인 접근 시 버튼 없이 바로 흰 화면을 표시한다.
- 로그인 성공 이력이 있는 브라우저는 세션이 만료됐을 때 Google 자동 재인증(`prompt=none`)을 한 번 시도한다. 성공하면 흰 화면으로 이동하고, Google 세션·동의가 없거나 인증이 실패하면 로그인 버튼을 표시한다.
- 성공 이력은 `localStorage`에 표시만 저장하며 인증 여부는 항상 서버에서 확인한다. 토큰·비밀번호는 브라우저 저장소에 저장하지 않는다. 브라우저 데이터 삭제나 저장소 차단 시 버튼으로 다시 로그인한다.
- 인증 실패·취소 → 검정 로그인 화면에 재시도 안내. 자동 재시도 이력은 지워 반복 이동을 막는다.

## 환경변수와 실행

백엔드 실행 프로세스에 다음 환경변수를 설정한다. 프런트엔드에는 비밀값을 넣지 않는다.

```dotenv
DB_NAME=mokdo
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8080/login/oauth2/code/google
```

Google Cloud Console의 OAuth 클라이언트에도 `GOOGLE_REDIRECT_URI`와 **완전히 같은 값**을 승인된 리디렉션 URI로 등록한다. 이 URI는 흰 화면 주소가 아니라 인증 코드를 처리하는 서버 콜백이다.

로컬 기본값은 PostgreSQL `localhost:5432`, 백엔드 `8081`, 프런트엔드 `8080`이다. DB 호스트·포트는 필요할 때 `DB_HOST`, `DB_PORT`로 바꾼다. 로그인 후 브라우저가 이동할 프런트엔드 주소는 `FRONTEND_URL`로 지정하며 기본값은 `http://localhost:8080`이다.

1. `infra/`에서 `docker compose up -d`로 DB를 실행한다. Compose의 `.env`는 백엔드 프로세스에 자동 전달되지 않으므로 IDE나 실행 셸에도 환경변수를 설정한다.
2. JDK 21 이상을 사용해 `backend/`에서 `./gradlew bootRun`을 실행한다. Flyway가 기존 마이그레이션을 적용한다.
3. 루트에서 `npm ci`, `npm run dev-nolog`를 실행하고 `http://localhost:8080`에 접속한다.

Vite 개발 서버는 `/api`, `/oauth2`, `/login/oauth2`를 백엔드로 전달한다. Google 콜백은 위 경로 중 하나로 설정한다. 다른 콜백 경로를 쓰면 해당 경로의 프록시도 추가해야 한다. 백엔드는 `GOOGLE_REDIRECT_URI`의 경로를 콜백으로 처리한다.

배포 시에는 `FRONTEND_URL`, `GOOGLE_REDIRECT_URI`를 실제 HTTPS 주소로 설정하고 프록시가 인증 경로들을 동일한 백엔드로 전달하도록 한다. 프런트엔드 서버는 `/characters` 새로고침에도 `index.html`을 반환해야 한다. HTTPS 환경에서는 `SERVER_SERVLET_SESSION_COOKIE_SECURE=true`도 설정한다.

## 확인 항목

- 신규 Google 로그인 후 두 테이블에 회원과 `GOOGLE` 연동이 각각 하나 생성되는지 확인한다.
- 같은 Google 계정으로 다시 로그인해도 기존 `member_id`가 유지되는지 확인한다.
- 로그인 완료 및 새로고침 시 이미지·문구 없이 흰 화면만 보이는지 확인한다.
- 처음 방문한 브라우저에서 비로그인 상태로 `/characters`에 접근하면 검정 로그인 화면이 나오는지 확인한다.
- 이전 로그인 브라우저는 세션 만료 후 자동 인증을 한 번 시도하며, 실패 후 새로고침해도 자동 인증을 반복하지 않는지 확인한다.
- Google 동의 취소나 `BAN` 계정 로그인은 흰 화면으로 넘어가지 않는지 확인한다.
