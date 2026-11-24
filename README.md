# MOKDO 개발 실행

현재 구현 범위는 Google 로그인 → 내 캐릭터 선택 화면입니다. 캐릭터 생성·웹툰·마을 입장은 다음 단계이며 화면에서 준비 중으로 표시합니다.

## 로컬 실행

1. `infra`의 PostgreSQL을 실행합니다. 기존 마이그레이션 V1~V6는 그대로 사용합니다.
2. 백엔드 실행 구성에 `DB_USERNAME`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 환경변수를 등록합니다. 예시는 `backend/.env.example`을 참고하세요. Spring Boot는 `.env` 파일을 자동으로 읽지 않습니다.
3. Google Auth Platform에서 **웹 애플리케이션** 클라이언트의 승인된 리디렉션 URI를 `http://localhost:8081/login/oauth2/code/google`로 등록합니다. 요청 범위는 `openid`, `email`입니다.
4. 백엔드를 재시작합니다. 인증 의존성을 추가했으므로 IntelliJ에서는 Gradle 프로젝트도 새로고침하세요.
5. 프로젝트 루트에서 `npm run dev-nolog`를 실행하고 `http://localhost:8080`을 엽니다. `127.0.0.1` 대신 `localhost`로 주소를 통일하세요.
6. Google 로그인 후 캐릭터 선택 화면으로 복귀합니다. 첫 로그인에서는 계정과 Google 연동만 생성되며 캐릭터 목록은 비어 있는 것이 정상입니다.

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
| `GET /api/characters` | 세션의 계정이 소유한 캐릭터만 슬롯 순으로 반환 |
| `GET /api/csrf` | 로그아웃 요청에 사용할 CSRF 헤더 이름·토큰 반환 |
| `POST /api/logout` | CSRF 헤더 필요, 세션 폐기 후 204 반환 |

인증되지 않은 API 요청은 401, 정지·탈퇴 계정은 403을 반환합니다. Google 이메일이 같아도 고유 식별자 `sub`가 다르면 별개의 계정입니다. 동시 첫 로그인의 유니크 충돌은 전체 생성 트랜잭션을 롤백한 뒤 기존 계정을 조회합니다. 브라우저에 Google 토큰이나 Client Secret을 반환하지 않습니다.

## 검증

- `npx tsc --noEmit`
- `npm run build-nolog`
- `cd backend` 후 `./gradlew test` (Docker 필요)

백엔드 통합 테스트는 Testcontainers의 별도 PostgreSQL에 실제 Flyway 마이그레이션을 적용합니다. 개발 DB와 Google 자격증명을 사용하지 않습니다. 계정 생성·재로그인·동시 가입·계정 분리·이용 제한·세션 유지·CSRF 로그아웃·OAuth 리디렉션을 확인합니다. Google의 실제 로그인과 토큰 교환은 본인의 브라우저에서 별도로 확인해야 합니다.

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
