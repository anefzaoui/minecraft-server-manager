---
title: '아키텍처'
description: 'Minecraft Server Manager는 단일 프로세스, 서버 렌더링 Node.js 애플리케이션입니다.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Docs 인덱스로 돌아가기](/docs/)

Minecraft Server Manager는 단일 프로세스, 서버 렌더링 Node.js 애플리케이션입니다. 이 애플리케이션은
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) 이미지를 사용하여 Docker 컨테이너로 실행되는
Minecraft 서버를 관리하며, `docker` CLI를 직접 호출하는 대신 API를 통해 Docker 데몬과 통신합니다.

## 런타임 구조

- **Express + Handlebars**로 서버 측 페이지를 렌더링합니다. SPA는 없으며, `public/js/`의 브라우저 JS는 수동으로 작성된 점진적 향상(progressive enhancement)입니다. esbuild 단계(`pnpm run build:js`)는 이를 번들링하고 축소하여 `public/dist/js/`로 저장합니다. 앱은 이 번들이 존재할 때 해당 번들을 제공하고, 그렇지 않으면 원본 소스를 제공하므로 빌드 없이 개발 실행도 가능합니다.
- **`node:sqlite`** (Node에 내장됨; 패널은 Node ≥ 24 필요)가 데이터베이스입니다. 동기식이며, 네이티브 모듈이 없고 WAL 모드입니다. 작은 버전 마이그레이션 실행기가 부팅 시 `src/db/migrations/*`를 적용합니다. 준비된 문은 SQL 텍스트를 키로 하여 `src/db/index.js`에 캐시됩니다.
- **`ws`**는 실시간 콘솔 및 통계 스트림을 전달합니다. 둘 다 **중개(brokered)**됩니다. 서버당 하나의 업스트림 `docker logs --follow` (또는 `docker stats`)가 있으며, 이는 한 번 디먹싱(demuxed)되어 모든 연결된 탭으로 분산됩니다. 뷰어당 하나의 업스트림이 아니라, 콘솔 중개자는 늦게 참여하는 탭을 위해 작은 재생 버퍼를 유지하고 공유 스트림을 지연시키지 않기 위해 소켓이 너무 뒤처진 구독자를 삭제합니다.
- **dockerode**는 앱이 Docker와 통신하는 유일한 방법입니다. 엔드포인트는 플랫폼별로 자동 감지됩니다(Windows 명명된 파이프 대 Unix 소켓).
- **모든 영구 상태는 하나의 디렉토리**(`$DATA_DIR`, 기본값 `./data`) 아래에 저장됩니다. 해당 디렉토리를 복사하면 전체 패널이 마이그레이션됩니다.

## 계층 구조

의존성은 한 방향으로 흐릅니다:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (미들웨어 포함)│   입력 파싱 및 검증, 응답 형식 지정
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   도메인 로직 (실제 기능)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   인프라스트럭처
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - 도메인별 라우터 (`servers`, `players`, `worlds`, `crashes`, `blueprints`, `files`, …)가 `web/app.js`에 마운트됩니다. 라우터는 zod로 유효성을 검사하고, 서비스를 호출하며, JSON을 반환하거나 뷰를 렌더링합니다. 비즈니스 로직은 여기에 속하지 않습니다. 두 개의 라우터가 **공개 영역**에 `requireAuth` 전에 마운트됩니다: `routes/status.js` (서버별 HTML 상태 페이지, 선택 사항) 및 `routes/apiV1.js` (`/api/v1`, `services/apiTokens.js`에서 관리자가 발급한 Bearer 토큰으로 인증되는 읽기 전용 JSON API, 설정에서 활성화되지 않으면 비활성화됨; `docs/public-api.md` 참조).
- **`services/`** - 앱의 핵심입니다. 각 서비스는 하나의 도메인을 소유하며 인프라 및 다른 서비스에 의존할 수 있습니다.
- **`docker/`** - dockerode 래퍼: `connect` (엔드포인트 감지 + 데몬 상태), `containers` (바인드 마운트, 메모리/CPU 제한 및 레이블 포함 생성/시작/중지/다시 생성), `logs`, `stats`, `images`, 그리고 Docker 이벤트를 기록 및 충돌 감지로 변환하는 `watcher`.
- **`db/`** - SQLite 래퍼 및 마이그레이션 실행기.
- **`storage/`** - `./data` 부트스트랩, **경로 가드** (`safeJoin`, 파일 안전 백본), 백그라운드 크기 인덱서 + 할당량 적용.

교차 기능:

- **`config/`** - 환경 구성 및 **필드 카탈로그**: 서버 설정의 단일 진실 공급원입니다. 모든 itzg 환경 변수가 카탈로그화됩니다 (레이블, 도움말, 유형, 단위, 기본값, 유효성 검사, 섹션, 위험 플래그). 마법사, 설정 양식 및 zod 유효성 검사는 모두 여기서 파생되므로, 새로운 설정을 노출하는 것은 데이터 변경이지 새로운 UI 배관이 아닙니다.
- **`events/`** - `recordEvent()`는 기록 로그의 유일한 진입점입니다. 수명 주기 이벤트는 컨테이너 로그 발췌를 `data/logs/<id>/events/`로 캡처합니다.
- **`ws/`** - 인증된 콘솔 + 통계 웹소켓 (업그레이드 시 세션 쿠키 확인, `Origin` 확인하여 사이트 간 하이재킹 차단), 서버별 중개 (런타임 구조 참조).
- **`logger.js` + `instrument.js`** - `require('./logger')(label)`는 모듈별 [Pino](https://getpino.io) 로거를 반환합니다. 레벨은 `LOG_LEVEL`에서 가져옵니다. `makeFailureThrottle()`은 영구적으로 실패하는 백그라운드 루프를 로그 한 줄과 "복구됨" 한 줄로 유지합니다. `src/utils/logSanitize.js`는 구조화된 메타데이터에서 자격 증명 형식의 키와 웹훅 토큰을 제거합니다. `src/config/logLevel.js`는 공유 레벨 허용 목록입니다 (로거가 존재하기 전에 요구 사항 주기를 피하기 위해 별도로 유지됨). `src/instrument.js`는 `src/server.js`에서 가장 먼저 로드되는 잠재적인 Sentry 시퀀스입니다. `src/web/middleware/requestLog.js`는 요청당 하나의 액세스 로그 줄을 작성합니다 (`/healthz` 및 정적 자산은 건너뜀). ESLint는 `src/**` 아래에서 `no-console`을 강제하며, `preflight.js`, `instrument.js`, `config/index.js`는 로거가 존재하기 전에 실행되므로 예외입니다.
- **속도 제한** - `src/web/middleware/rateLimit.js`는 `express-rate-limit`를 `/api` (`RATE_LIMIT_API_PER_MIN`, 기본값 1200) 및 로그인 / 2FA / 설정 POST (`RATE_LIMIT_AUTH_PER_15MIN`, 기본값 100) 앞에 배치합니다. `0`은 제한기를 비활성화합니다. `req.ip`를 키로 사용하므로 프록시 뒤에서는 `TRUST_PROXY`가 중요합니다. `/api/v1`은 자체 토큰별 제한기 (`RATE_LIMIT_PUBLIC_API_PER_MIN`, 기본값 120)를 가지며, Bearer 토큰의 해시를 키로 사용하고 IP를 대체로 사용합니다. `src/web/middleware/auth.js`의 별도 계정별 소프트 카운터는 로그인 잠금 (IP별 및 계정 전역, 감소)을 처리합니다.

## 주요 도메인 동작

- **모드팩은 항상 고정됩니다.** 이미지는 고정되지 않은 팩을 재시작할 때마다 자동 업그레이드하므로, 패널은 설치 시 "최신"을 구체적인 버전 ID로 해석하고 고정합니다. 업그레이드는 명시적인 오케스트레이션 흐름 (`updates/`)입니다: 미리보기 → 업데이트 전 백업 → 정상 종료 → 재고정 → 재생성 → 상태 모니터 → 원클릭 롤백.
- **사용자 지정 모드 오버레이**는 패널에서 관리됩니다: 사용자가 추가한 모드는 중복 제거된 라이브러리에 저장되고 서버에 하드 링크되어 팩 업데이트 시에도 유지됩니다. 비활성화는 클래스 인식입니다.
- **포트**는 기본 체계에서 할당됩니다 (게임은 `PORT_GAME_START`부터, RCON = 게임 + `PORT_RCON_OFFSET`, Bedrock은 `PORT_BEDROCK_START`부터). 사용 가능 여부를 확인하고 DB에 예약됩니다.
- **디스크 할당량**은 Docker가 바인드 마운트 사용량을 제한할 수 없으므로 패널에서 강제됩니다: 인덱서는 디렉토리별 크기를 캐시하고 디스크 증가 작업은 이를 기반으로 제한됩니다.
- **비밀** (RCON 비밀번호, API 키, TOTP 비밀, Discord 웹훅 URL)은 `$DATA_DIR/.secret-key` (모드 `0600`, 자동 생성)에 대한 전용 무작위 키를 사용하여 AES-256-GCM으로 암호화됩니다. 이는 `SESSION_SECRET`와 독립적입니다. `SESSION_SECRET`에서 파생된 키는 전용 키가 존재하기 전에 작성된 값에 대한 복호화 전용 폴백으로 유지되며, `src/services/secretsMigration.js`는 부팅 시 한 번 해당 값들을 전용 키 아래에서 다시 암호화합니다. `.secret-key`가 존재하지만 파싱되지 않으면 부팅 오류가 발생합니다 (절대 자동으로 다시 생성되지 않음). 청사진은 내보낼 때 모든 비밀을 제거합니다.

## 데이터 및 와이어 형식

- **`data/panel.db`** - SQLite 데이터베이스. 매일 `VACUUM INTO`를 통해 `data/backups/_panel/`로 스냅샷됩니다 (최신 14개 보관). `PRAGMA integrity_check`는 부팅 시 실행됩니다.
- **`data/.session-secret`** - 자동 생성된 쿠키 서명 비밀. 첫 실행 시 `SESSION_SECRET`가 설정되지 않은 경우 생성됩니다. 이를 삭제하면 비밀이 순환됩니다 (세션이 무효화됨).
- **`data/.secret-key`** - 전용 32바이트 암호화 키 (모드 `0600`), 첫 실행 시 자동 생성. `SESSION_SECRET`와 독립적입니다. 이를 삭제하면 저장된 모든 자격 증명이 복호화 불가능해지므로 백업과 함께 보관해야 합니다.
- **청사진 (`.mcserver.zip`)** - 구성, 리소스, 고정된 팩 참조, 오버레이 매니페스트 (소스 URL + sha256), 선택적 월드를 설명하는 `manifest.json`이 포함된 zip 파일입니다. 가져오기 시 각 모드를 다시 다운로드하고 해시를 확인하며 새 포트를 할당합니다.
- **패널에서 생성된 Docker 컨테이너**는 watcher가 찾을 수 있도록 이름이 지정되고 레이블이 지정됩니다. 패널은 컨테이너의 전체 수명 주기를 소유합니다.

## 부팅 순서

1. 가장 먼저 `require('./instrument')` (Sentry 시퀀스)를 실행하고, 그 다음 `require('./preflight')`를 실행하여 지원되지 않는 Node 버전에 대해 명확하게 실패합니다.
2. 구성을 로드합니다. `.session-secret` **및** `.secret-key`를 확인/생성합니다.
3. `ensureDataRoot()` - `./data` 레이아웃을 생성하고 `tmp/`를 삭제합니다.
4. DB 마이그레이션을 실행하고, `PRAGMA integrity_check`를 실행합니다 (실패 시 `data/backups/_panel`을 가리키며 크게 로깅됨).
5. 레거시 `SESSION_SECRET` 키로 암호화된 비밀을 `.secret-key` 아래에서 다시 암호화합니다 (`secretsMigration`).
6. 시작 청사진을 시드합니다 (보호됨).
7. HTTP + WS 서버를 시작합니다. 노출된 바인드에서 첫 실행 `/setup` PIN을 출력합니다.
8. 부팅 후 런타임 가드를 설치합니다 (처리되지 않은 오류를 잡음; `MSM_EXIT_ON_FATAL=1`은 관리되는 배포를 위해 강제 종료함).
9. 백그라운드 서비스를 시작합니다: WS 중개자, 스토리지 인덱서, 충돌 + 인벤토리 watcher, 스케줄러, Discord 이벤트 브리지, 그리고 **일일 유지 관리 타이머** (오래된 분석 행 정리 + `panel.db` 스냅샷).
10. **백그라운드에서** Docker를 초기화합니다. 데몬이 다운되어 있어도 UI는 완전히 사용할 수 있습니다. Docker 기능은 데몬에 연결되면 활성화됩니다. 연결되면 `refreshStatuses({ boot })`는 캐시된 상태를 조정하고, 패널 재시작 전에 실행 중이었지만 다시 시작되지 않을 서버에 대해 일회성 `offline-after-restart` 이벤트를 발생시키며, 부팅 루프는 `auto_start` 서버를 시작하고 중단 중에 발견된 충돌 서버를 복구합니다 (`auto_restart` 서버, 충돌 루프 백오프 존중).

> instrument-before-preflight 순서는 의도적인 절충입니다. 이를 통해 향후 Sentry 배선이 런타임을 먼저 패치할 수 있으며, 매우 오래된 Node 버전에 대한 메시지가 약간 덜 친절해지는 비용이 발생합니다.

## 빌드 파이프라인

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild → `public/dist/js/`, 코드 분할 포함 ESM). `postinstall`은 **CSS만** 실행합니다. `public/css/app.css` 및 `public/dist/`는 gitignore된 빌드 아티팩트입니다. Dockerfile 빌드 단계는 전체 `pnpm run build`를 실행하고 `public/`를 런타임 이미지에 복사합니다. 정적 자산은 핑거프린트된 파일의 경우 `immutable`/long-cache, CSS/JS의 경우 short-cache, HTML 및 `/api`의 경우 `no-cache`로 제공됩니다.
