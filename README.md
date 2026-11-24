# MOKDO 개발 실행

현재 구현 범위는 Google 로그인 → 캐릭터 선택·생성·삭제 → 캐릭터별 최초 인트로 웹툰 → 마을 → 사냥터 → 동굴 대기실 → 보스 던전입니다. `feat/001-mvp`의 이동·전투·성장·전리품 기능을 기존 계정 흐름에 연결했습니다. 마을 진입 전 화면은 공통 배경을 사용하고, 플레이 화면에는 MVP의 모험가 모델을 사용합니다.

## 로컬 실행

1. `infra`의 PostgreSQL을 실행합니다. 기존 V1~V6에 더해 V7 마이그레이션이 적용됩니다.
2. 백엔드 실행 구성에 `DB_USERNAME`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 환경변수를 등록합니다. 예시는 `backend/.env.example`을 참고하세요. Spring Boot는 `.env` 파일을 자동으로 읽지 않습니다.
3. Google Auth Platform에서 **웹 애플리케이션** 클라이언트의 승인된 리디렉션 URI를 `http://localhost:8081/login/oauth2/code/google`로 등록합니다. 요청 범위는 `openid`, `email`입니다.
4. 백엔드를 재시작합니다. 인증 의존성을 추가했으므로 IntelliJ에서는 Gradle 프로젝트도 새로고침하세요.
5. 프로젝트 루트에서 `npm run dev-nolog`를 실행하고 `http://localhost:8080`을 엽니다. `127.0.0.1` 대신 `localhost`로 주소를 통일하세요.
6. Google 로그인 후 캐릭터 선택 화면으로 복귀합니다. 첫 로그인에서는 계정과 Google 연동만 생성되며 캐릭터 목록은 비어 있는 것이 정상입니다. 캐릭터 생성 버튼에서 닉네임 중복 확인 후 생성할 수 있습니다.

백엔드는 세션 쿠키를 사용합니다. 로그인 시작은 백엔드 `8081`로 이동하고, 인증 후 프론트 `8080`으로 돌아옵니다. API는 Vite의 `/api` 프록시를 통해 요청합니다. 새로고침 시 `/api/me`로 세션을 확인합니다. 로그인 실패 시 다시 로그인할 수 있는 화면을 표시합니다.

## 백엔드 패키지 구조

- `controller`: HTTP 요청 매핑과 응답 처리
- `service`: 비즈니스 로직 인터페이스
- `serviceImpl`: 서비스 구현체, 계정 상태 검사와 트랜잭션 처리
- `mapper`: DB 조회·저장 SQL과 결과 매핑 (현재 JdbcTemplate 사용)
- `dto`: 계층 간 데이터 전달 객체
- `auth`: Spring Security 설정과 세션 로그인 사용자 객체

컨트롤러는 서비스 인터페이스를 주입받고, 서비스 구현체가 mapper를 호출합니다.

## API

| 경로 | 동작 |
| --- | --- |
| `GET /api/health` | 비로그인 상태에서도 접근 가능 |
| `GET /oauth2/authorization/google` | Google 로그인 시작 (브라우저 페이지 이동) |
| `GET /login/oauth2/code/google` | Spring Security가 처리하는 Google 콜백 |
| `GET /api/me` | 세션의 내부 계정 `id`, `status` 반환 |
| `GET /api/characters` | 세션의 계정이 소유한 활성 캐릭터만 슬롯 순으로 반환 |
| `GET /api/characters/{id}` | 소유한 활성 캐릭터의 정보와 웹툰 완료 상태 조회 |
| `POST /api/characters/{id}/intro-completion` | CSRF 헤더 필요, 캐릭터의 최초 웹툰 완료 시각 저장 (재요청 시 기존 시각 유지) |
| `GET /api/characters/name-availability?name=...` | 전체 활성 캐릭터의 닉네임 중복 확인 |
| `POST /api/characters` | `{ "name": "닉네임" }`, CSRF 헤더 필요, 생성 후 201 반환 |
| `DELETE /api/characters/{id}` | `{ "confirmationName": "정확한 캐릭터명" }`, CSRF 헤더 필요, 상태 변경 후 204 반환 |
| `GET /api/csrf` | 로그아웃 요청에 사용할 CSRF 헤더 이름·토큰 반환 |
| `POST /api/logout` | CSRF 헤더 필요, 세션 폐기 후 204 반환 |

인증되지 않은 API 요청은 401, 정지·탈퇴 계정은 403을 반환합니다. Google 이메일이 같아도 고유 식별자 `sub`가 다르면 별개의 계정입니다. 동시 첫 로그인의 유니크 충돌은 전체 생성 트랜잭션을 롤백한 뒤 기존 계정을 조회합니다. 브라우저에 Google 토큰이나 Client Secret을 반환하지 않습니다.

## 캐릭터 생성·삭제

닉네임은 앞뒤 공백 제거·NFC 정규화 후 한글 완성형·영문·숫자 2~12자를 허용합니다. 전체 사용자 기준으로 영문 대소문자를 구분하지 않습니다. 생성 화면에서 중복 확인 후 닉네임을 수정하면 다시 확인해야 합니다. 확인 결과가 이름을 예약하지는 않으므로 생성 시 서버와 DB 유니크 인덱스에서도 중복을 차단합니다.

삭제 버튼을 누르면 확인창을 열고, 캐릭터명을 대소문자·공백까지 정확하게 입력해야 확정할 수 있습니다. 서버는 소유자를 확인하고 `status`를 `ACTIVE`에서 `DELETED`로 변경합니다. 삭제된 행은 보존하고 캐릭터 목록에서는 제외합니다. 삭제된 닉네임과 슬롯은 재사용할 수 있습니다.

`V7__game_charactor.sql`은 상태 컬럼과 활성 캐릭터의 닉네임·슬롯 유니크 인덱스를 추가합니다. 기존 데이터에 대소문자·앞뒤 공백을 제외하고 같은 활성 닉네임이 있다면 마이그레이션 전에 정리해야 하며, 마이그레이션이 임의로 이름을 변경하지는 않습니다.

## 임시 인트로 웹툰

캐릭터 선택 후 인트로 미완료 캐릭터는 4컷 세로 스크롤 웹툰을 표시합니다. 우측 상단 `SKIP`은 스크롤과 관계없이 고정됩니다. 마지막 `마을로 가기`와 `SKIP` 모두 서버에 `intro_completed_at`을 저장한 뒤 마을로 이동합니다. 저장에 실패하면 웹툰에서 재시도할 수 있으며, 캐릭터 선택으로 돌아가기만 하면 완료로 처리하지 않습니다.

완료한 캐릭터는 다음 선택부터 웹툰을 생략합니다. 캐릭터마다 상태를 따로 관리하고, 다른 사용자의 캐릭터·삭제된 캐릭터에는 완료를 기록할 수 없습니다. 기존 V6의 컬럼을 사용하므로 웹툰을 위한 추가 마이그레이션은 없습니다.

이미지는 `public/assets/mokdo-intro-panels.png`, 대사와 컷 구성은 `src/game/scenes/IntroStory.ts`에 있습니다. 제작 프롬프트는 `docs/design/intro-webtoon.md`에 기록했습니다. `Village`는 서버에서 캐릭터 소유권과 인트로 완료 여부를 확인한 뒤 플레이 가능한 `Hub` 마을로 연결합니다.

## 마을과 모험 (MVP 통합)

마을 동쪽 포탈 가까이에서 `F` 또는 포탈 이용 버튼으로 사냥터에 진입합니다. 사냥터 동쪽 위 동굴에서 대기실에 들어가 준비 완료 후 보스 던전으로 이동합니다. 보스전 결과에서 동굴 입구로 돌아오면 기존 사냥터 상태가 이어지며, 마을로 돌아온 뒤 캐릭터 선택 화면으로 나갈 수 있습니다.

- 이동: `WASD` 또는 방향키, 상호작용: `F`
- 공격: `J` 또는 필드 클릭, 회피: `Space`, 범위 공격: `K`
- 전리품: 가까이 가면 자동 획득, 주변 회수: `E`, 일시정지: `Esc`
- 마을의 여행자·보관함에서 레벨, 경험치, 처치·보스 클리어 기록과 전리품을 확인하고 현재 캐릭터의 성장만 초기화할 수 있습니다.

성장 데이터는 **서버 저장이 아닌 현재 브라우저의 캐릭터별 로컬 저장**입니다. 키는 `mokdo.solo.v1.character.<캐릭터 ID>`이며 캐릭터를 바꾸어도 기록이 섞이지 않습니다. 다른 브라우저·기기에는 동기화되지 않습니다. MVP의 기존 공용 키 `mokdo.solo.v1`은 소유 캐릭터를 알 수 없어 자동 이전하지 않고 보존합니다. 캐릭터 선택으로 나가면 대기 중인 전투 장면과 메모리의 캐릭터 연결을 종료합니다.

플레이 화면은 MVP의 1280×800 비율에 맞춰 축소되며 키보드·마우스 사용을 권장합니다. 로그인·캐릭터 관리·인트로는 기존 화면을 유지합니다.

## 검증

- `npm test` (전투·던전·이동·성장 및 캐릭터별 저장 분리)
- `npx tsc --noEmit`
- `npm run build-nolog`
- `cd backend` 후 `./gradlew test` (Docker 필요)

백엔드 통합 테스트는 Testcontainers의 별도 PostgreSQL에 실제 Flyway 마이그레이션을 적용합니다. 개발 DB와 Google 자격증명을 사용하지 않습니다. 계정 생성·재로그인·동시 가입·계정 분리·이용 제한·세션 유지·CSRF 로그아웃·OAuth 리디렉션과 캐릭터 생성·닉네임 검증·동시 생성·소유자 및 이름 확인 삭제·삭제 기록 보존·이름과 슬롯 재사용을 확인합니다. Google의 실제 로그인과 토큰 교환은 본인의 브라우저에서 별도로 확인해야 합니다.

배포 시에는 `GOOGLE_REDIRECT_URI`, `MOKDO_FRONTEND_URL`, 프론트의 `VITE_BACKEND_ORIGIN`을 실제 주소로 변경하고 `SESSION_COOKIE_SECURE=true`로 설정하세요. 운영 환경에서는 같은 사이트에서 프론트와 백엔드에 접근하도록 리버스 프록시를 구성하고 `/api`를 백엔드로 전달해야 합니다. Client Secret은 백엔드에만 설정하세요.

---

# Phaser Vite TypeScript Template

This is a Phaser project template that uses Vite for bundling. It supports hot-reloading for quick development workflow, includes TypeScript support and scripts to generate production-ready builds.

**[This Template is also available as a JavaScript version.](https://github.com/phaserjs/template-vite)**

### Versions

This template has been updated for:

- [Phaser 4](https://github.com/phaserjs/phaser)
- [Vite 6.3.1](https://github.com/vitejs/vite)
- [TypeScript 5.7.2](https://github.com/microsoft/TypeScript)

![screenshot](screenshot.png)

## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Launch a development web server |
| `npm run build` | Create a production build in the `dist` folder |
| `npm run dev-nolog` | Launch a development web server without sending anonymous data (see "About log.js" below) |
| `npm run build-nolog` | Create a production build in the `dist` folder without sending anonymous data (see "About log.js" below) |

## Writing Code

After cloning the repo, run `npm install` from your project directory. Then, you can start the local development server by running `npm run dev`.

The local development server runs on `http://localhost:8080` by default. Please see the Vite documentation if you wish to change this, or add SSL support.

Once the server is running you can edit any of the files in the `src` folder. Vite will automatically recompile your code and then reload the browser.

## Template Project Structure

We have provided a default project structure to get you started. This is as follows:

## Template Project Structure

We have provided a default project structure to get you started:

| Path                         | Description                                                |
|------------------------------|------------------------------------------------------------|
| `index.html`                 | A basic HTML page to contain the game.                     |
| `public/assets`              | Game sprites, audio, etc. Served directly at runtime.      |
| `public/style.css`           | Global layout styles.                                      |
| `src/main.ts`                | Application bootstrap.                                     |
| `src/game`                   | Folder containing the game code.                           |
| `src/game/main.ts`           | Game entry point: configures and starts the game.          |
| `src/game/scenes`            | Folder with all Phaser game scenes.                        | 


## Handling Assets

Vite supports loading assets via JavaScript module `import` statements.

This template provides support for both embedding assets and also loading them from a static folder. To embed an asset, you can import it at the top of the JavaScript file you are using it in:

```js
import logoImg from './assets/logo.png'
```

To load static files such as audio files, videos, etc place them into the `public/assets` folder. Then you can use this path in the Loader calls within Phaser:

```js
preload ()
{
    //  This is an example of an imported bundled image.
    //  Remember to import it at the top of this file
    this.load.image('logo', logoImg);

    //  This is an example of loading a static image
    //  from the public/assets folder:
    this.load.image('background', 'assets/bg.png');
}
```

When you issue the `npm run build` command, all static assets are automatically copied to the `dist/assets` folder.

## Deploying to Production

After you run the `npm run build` command, your code will be built into a single bundle and saved to the `dist` folder, along with any other assets your project imported, or stored in the public assets folder.

In order to deploy your game, you will need to upload *all* of the contents of the `dist` folder to a public facing web server.

## Customizing the Template

### Vite

If you want to customize your build, such as adding plugin (i.e. for loading CSS or fonts), you can modify the `vite/config.*.mjs` file for cross-project changes, or you can modify and/or create new configuration files and target them in specific npm tasks inside of `package.json`. Please see the [Vite documentation](https://vitejs.dev/) for more information.

## About log.js

If you inspect our node scripts you will see there is a file called `log.js`. This file makes a single silent API call to a domain called `gryzor.co`. This domain is owned by Phaser Studio Inc. The domain name is a homage to one of our favorite retro games.

We send the following 3 pieces of data to this API: The name of the template being used (vue, react, etc). If the build was 'dev' or 'prod' and finally the version of Phaser being used.

At no point is any personal data collected or sent. We don't know about your project files, device, browser or anything else. Feel free to inspect the `log.js` file to confirm this.

Why do we do this? Because being open source means we have no visible metrics about which of our templates are being used. We work hard to maintain a large and diverse set of templates for Phaser developers and this is our small anonymous way to determine if that work is actually paying off, or not. In short, it helps us ensure we're building the tools for you.

However, if you don't want to send any data, you can use these commands instead:

Dev:

```bash
npm run dev-nolog
```

Build:

```bash
npm run build-nolog
```

Or, to disable the log entirely, simply delete the file `log.js` and remove the call to it in the `scripts` section of `package.json`:

Before:

```json
"scripts": {
    "dev": "node log.js dev & dev-template-script",
    "build": "node log.js build & build-template-script"
},
```

After:

```json
"scripts": {
    "dev": "dev-template-script",
    "build": "build-template-script"
},
```

Either of these will stop `log.js` from running. If you do decide to do this, please could you at least join our Discord and tell us which template you're using! Or send us a quick email. Either will be super-helpful, thank you.

## Join the Phaser Community!

We love to see what developers like you create with Phaser! It really motivates us to keep improving. So please join our community and show-off your work 😄

**Visit:** The [Phaser website](https://phaser.io) and follow on [Phaser Twitter](https://twitter.com/phaser_)<br />
**Play:** Some of the amazing games [#madewithphaser](https://twitter.com/search?q=%23madewithphaser&src=typed_query&f=live)<br />
**Learn:** [API Docs](https://newdocs.phaser.io), [Support Forum](https://phaser.discourse.group/) and [StackOverflow](https://stackoverflow.com/questions/tagged/phaser-framework)<br />
**Discord:** Join us on [Discord](https://discord.gg/phaser)<br />
**Code:** 2000+ [Examples](https://labs.phaser.io)<br />
**Read:** The [Phaser World](https://phaser.io/community/newsletter) Newsletter<br />

Created by [Phaser Studio](mailto:support@phaser.io). Powered by coffee, anime, pixels and love.

The Phaser logo and characters are &copy; 2011 - 2025 Phaser Studio Inc.

All rights reserved.
