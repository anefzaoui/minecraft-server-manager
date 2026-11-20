---
title: '아키텍처'
description: 'Minecraft Server Manager는 단일 프로세스, 서버 렌더링 Node.js 애플리케이션입니다.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← 문서 인덱스로 돌아가기](/docs/)

Minecraft Server Manager는 단일 프로세스, 서버 렌더링 Node.js 애플리케이션입니다. 이 애플리케이션은
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) 이미지를 사용하여 Docker 컨테이너로 실행되는 Minecraft 서버를 관리하며,
`docker` CLI를 셸 명령으로 호출하는 대신 Docker 데몬의 API를 통해 통신합니다.

## 런타임 구조

- **Express + Handlebars**로 페이지를 서버 측에서 렌더링합니다. SPA는 없습니다. `public/js/`의 브라우저 JS는 수동으로 작성된 점진적 향상(progressive enhancement)입니다. esbuild 단계(`pnpm run build:js`)는 이를 번들링하고 최소화하여 `public/dist/js/`에 저장합니다. 앱은 번들이 존재할 때 해당 번들을 제공하고, 그렇지 않으면 원본 소스를 제공하므로 빌드 없이 개발 모드로 실행해도 작동합니다.
- **`node:sqlite`** (Node에 내장되어 있으며, 패널은 Node ≥ 24 필요)가 데이터베이스입니다. 동기식이며, 네이티브 모듈이 없고, WAL 모드를 사용합니다. 작은 버전 마이그레이션 실행기가 부팅 시 `src/db/migrations/*`를 적용합니다. 준비된 문은 SQL 텍스트를 키로 하여 `src/db/index.js`에 캐시됩니다.
- **`ws`**는 실시간 콘솔 및 통계 스트림을 전달합니다. 둘 다 **중개(brokered)**됩니다. 서버당 하나의 업스트림 `docker logs --follow` (또는 `docker stats`)를 사용하며, 이를 한 번 디먹싱(demuxed)하여 연결된 모든 탭으로 분산합니다. 뷰어당 하나의 업스트림을 사용하는 대신입니다. 콘솔 중개자는 나중에 참여하는 탭을 위해 작은 재생 버퍼를 유지하고, 공유 스트림을 지연시키지 않기 위해 소켓이 너무 뒤처진 구독자를 삭제합니다.
- **dockerode**는 앱이 Docker와 통신하는 유일한 방법입니다. 엔드포인트는 플랫폼별로 자동 감지됩니다 (Windows 명명 파이프 대 unix 소켓).
- **모든 영구 상태는 하나의 디렉토리**(`$DATA_DIR`, 기본값 `./data`) 아래에 저장됩니다. 이 디렉토리를 복사하면 전체 패널이 마이그레이션됩니다.

## 계층 구조

의존성은 한 방향으로 흐릅니다:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (미들웨어 포함)│   입력 파싱 및 검증, 응답 구성
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

- **`web/routes/`** - 도메인별 라우터 (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js`는 최상위 라우터(`api.js`, 핵심 서버 라우트를 포함하고 서버별 도메인 라우터를 마운트하는 세션 JSON API; `index.js`, 페이지; `auth`, `account`, `tasks`, …)를 마운트합니다. 라우터는 zod로 유효성을 검사하고, 서비스를 호출하며, JSON을 반환하거나 뷰를 렌더링합니다. 비즈니스 로직은 여기에 속하지 않습니다. 두 개의 라우터가 **공개 영역**에 마운트됩니다. `requireAuth` 이전입니다: `routes/status.js` (선택적 서버별 HTML 상태 페이지) 및 `routes/apiV1.js` (`/api/v1`, 관리자가 발급한 Bearer 토큰으로 인증되는 읽기 전용 JSON API, `services/apiTokens.js`에서 제공, 설정에서 활성화되지 않으면 비활성화됨; `docs/public-api.md` 참조).
- **`services/`** - 앱의 핵심입니다. 각 서비스는 하나의 도메인을 소유하며 인프라스트럭처 및 다른 서비스에 의존할 수 있습니다.
- **`docker/`** - dockerode 래퍼: `connect` (엔드포인트 감지 + 데몬 상태), `containers` (바인드 마운트, 메모리/CPU 제한, 레이블 포함 생성/시작/중지/재생성), `logs`, `stats`, `images`, `networks` (호스트 네트워크 검색), `hostPath` (`DATA_DIR_HOST` 아래 바인드 경로 재루팅), 그리고 Docker 이벤트를 기록 및 충돌 감지로 변환하는 `watcher`.
- **`db/`** - SQLite 래퍼 및 마이그레이션 실행기.
- **`storage/`** - `./data` 부트스트랩, **경로 가드** (`safeJoin`, 파일 안전성 백본), 백그라운드 크기 인덱서 + 할당량 적용.

교차 기능:

- **`config/`** - 환경 설정 및 **필드 카탈로그**: 서버 설정의 단일 진실 공급원입니다. 모든 itzg 환경 변수가 카탈로그화됩니다 (레이블, 도움말, 유형, 단위, 기본값, 유효성 검사, 섹션, 위험 플래그). 마법사, 설정 양식 및 zod 유효성 검사는 모두 여기서 파생되므로, 새로운 설정을 노출하는 것은 데이터 변경이지 새로운 UI 배관이 아닙니다.
- **`events/`** - `recordEvent()`는 기록 로그의 유일한 진입점입니다. 수명 주기 이벤트는 컨테이너 로그 발췌를 `data/logs/<id>/events/`로 캡처합니다.
- **`ws/`** - 인증된 콘솔 + 통계 웹소켓 (세션 쿠키는 업그레이드 시 검증, `Origin`은 사이트 간 하이재킹 차단용으로 확인), 서버별 중개 (런타임 구조 참조).
- **`logger.js` + `instrument.js`** - `require('./logger')(label)`는 모듈별 [Pino](https://getpino.io) 로거를 반환합니다. 레벨은 `LOG_LEVEL`에서 가져옵니다. `makeFailureThrottle()`은 지속적으로 실패하는 백그라운드 루프를 하나의 로그 라인과 "복구됨" 라인으로 유지합니다. `src/utils/logSanitize.js`는 구조화된 메타데이터에서 자격 증명 모양의 키와 웹훅 토큰을 제거합니다. `src/config/logLevel.js`는 공유 레벨 허용 목록입니다 (로거가 존재하기 전에 `config`와의 요구 사항 순환을 피하기 위해 별도로 유지됨). `src/instrument.js`는 비활성 Sentry 심으로, `src/server.js`에서 가장 먼저 로드됩니다. `src/web/middleware/requestLog.js`는 각 요청에 대해 하나의 액세스 로그 라인을 작성합니다 (`/healthz` 및 정적 자산 제외). ESLint는 `src/**` 아래에서 `no-console`을 강제하며, `preflight.js`, `instrument.js`, `config/index.js`는 로거가 존재하기 전에 실행되므로 예외입니다.
- **속도 제한** - `src/web/middleware/rateLimit.js`는 `express-rate-limit`를 `/api` (`RATE_LIMIT_API_PER_MIN`, 기본값 1200) 및 로그인 / 2FA / 설정 POST (`RATE_LIMIT_AUTH_PER_15MIN`, 기본값 100) 앞에 배치합니다. `0`은 제한기를 비활성화합니다. `req.ip`를 키로 사용하므로 프록시 뒤에서는 `TRUST_PROXY`가 중요합니다. `/api/v1`에는 자체 제한기가 있습니다: 토큰이 확인되기 전에 실행되는 클라이언트 IP당 제한 (토큰 예산의 5배), 그 다음 토큰당 예산 (`RATE_LIMIT_PUBLIC_API_PER_MIN`, 기본값 120), 확인된 토큰의 ID를 키로 사용합니다. `src/web/middleware/auth.js`의 별도 계정당 소프트 카운터는 로그인 잠금 (IP당 및 계정 전역, 감소)을 처리합니다.
- **권한 부여**: 두 계층. 전역 역할 (`requireAuth` → `requireRole` / `requireWrite` in `src/web/middleware/auth.js`)은 패널 전체 작업을 게이트하며 기본값으로 모든 서버에 적용됩니다. 서버별 권한 (`src/services/permissions.js`, `user_server_permissions`당 JSON 목록으로 저장된 9가지 기능)은 하나의 서버에 대해 이 기본값을 세분화합니다. 모든 `/api/servers/:id` 라우트, 하위 라우터 마운트, 페이지, 웹소켓 및 전체 목록은 `src/web/middleware/serverAccess.js` (`serverScope`, API 및 페이지 라우터의 `/servers/:id` 접두사에 마운트됨, `view` 권한이 없으면 서버를 404로 숨김; `requireCap(cap)`은 라우트가 필요로 하는 기능을 명시함)를 통과합니다. 본문에 서버 이름을 지정하는 쓰기 작업 (예약, 월드 추출 및 설치, 청사진 내보내기)은 `requireWrite`에 의해 해당 서버에 대해서만 열리며, 각 라우트는 자체적으로 기능을 확인합니다. `test/permissions-routes.test.js`는 라이브 라우터 스택을 탐색하고 서버 범위 쓰기 라우트, 마운트 또는 페이지에 게이트가 없으면 실패합니다.

## 주요 도메인 동작

- **모드팩은 항상 고정됩니다.** 이미지는 재시작할 때마다 고정되지 않은 팩을 자동으로 업그레이드하므로, 패널은 설치 시점에 "최신"을 특정 버전 ID로 해석하고 고정합니다. 업그레이드는 명시적으로 조정된 흐름입니다 (`updates/`): 미리보기 → 업데이트 전 백업 → 정상 종료 → 재고정 → 재생성 → 상태 모니터 → 원클릭 롤백.
- **사용자 정의 모드 오버레이**는 패널에서 관리합니다. 사용자가 추가한 모드는 중복 제거된 라이브러리에 저장되고 서버에 하드 링크되어 팩 업데이트 시에도 유지됩니다. 비활성화는 클래스별로 인식됩니다. 라이브러리는 다운로드한 모든 빌드를 유지하므로, 업데이트는 교체된 빌드를 기록하고 (`server_content.previous_*`) 로컬 파일만으로 되돌릴 수 있습니다. 팩 모드를 비활성화하면 팩의 제외 환경 변수가 대신 작성됩니다. `packs.applyPack`은 동일한 팩의 버전 변경 시 해당 변수와 나머지 팩 튜닝 (`PACK_TUNING_KEYS`)을 전달하고, 팩이 변경되면 삭제합니다.
- **Minecraft 버전 업그레이드는 "획득"해야 합니다.** `services/compat.js`는 서버의 모드를 스캔합니다 (패널 설치 행에서 해석된 후, CurseForge 팩 매니페스트, 그 다음 Modrinth/CurseForge에 대한 콘텐츠 해시). 그리고 CurseForge의 `latestFilesIndexes` (요청당 200개 프로젝트)와 Modrinth의 프로젝트별 버전 목록 (프로젝트당 요청 하나, 로더와 버전이 쌍을 이루는 이유)에서 각 프로젝트의 (로더, Minecraft 버전) 지원 매트릭스를 구축합니다. 업데이트 검사기는 모든 모드가 지원하는 최신 버전만 제공하며, 답변을 확립할 수 없을 때는 아무것도 제공하지 않습니다: 스캔 없음, 다른 버전 또는 로더에 대한 스캔, 완료되지 않은 스캔, 또는 두 레지스트리 모두 인식하지 못하는 jar. 스캔은 수동으로만 가능하며, 진행 상황과 부분 결과는 `version_compat`에 저장됩니다 (메모리 내 `services/tasks.js`가 아님). 따라서 새로고침 또는 패널 재시작 시 중단된 상태에서 재개됩니다. `reconcileScans()`는 다음 부팅 시 종료로 인해 버려진 스캔을 표시합니다.
- **모드 로더 버전은 다른 모든 것과 마찬가지로 고정됩니다.** `services/loaderPin.js`는 이미지 자체의 설치 매니페스트 (`.forge-manifest.json` 등)에서 설치된 빌드를 읽고 고정값을 작성합니다: 일반 서버의 로더 itzg 변수 (`FORGE_VERSION`, …) 또는 Forge 또는 Fabric CurseForge 팩의 `CF_MOD_LOADER_VERSION`, 이는 팩이 선언한 버전을 재정의합니다. 이미지의 CurseForge 설치 프로그램은 NeoForge의 경우 해당 재정의를 무시하며, Modrinth 및 FTB 팩에는 해당 항목이 없으므로 로더는 팩을 따릅니다. `packs.applyPack`은 팩 업데이트 또는 롤백 시 모든 `CF_` 변수를 제거하여 재정의를 나머지 항목과 함께 삭제합니다. 형식화된 빌드는 먼저 레지스트리의 전체 목록과 비교됩니다 (`services/loaderVersions.js`; Forge의 경우 Maven 메타데이터에서 가져오며 숫자를 건너뜁니다. 누락된 경우 레지스트리 자체와 한 번 더 비교됩니다). 그런 다음 변경 사항은 백업 → 고정 (백업 후의 환경 변수 위) → 재생성 순서로 진행됩니다.
- **포트는** 기본 체계에서 할당됩니다 (게임은 `PORT_GAME_START`부터, RCON = 게임 + `PORT_RCON_OFFSET`, Bedrock은 `PORT_BEDROCK_START`부터). 사용 가능 여부를 확인하고 DB에 예약합니다. "사용 중"은 모든 서버의 주장 (실행 중인 포트, 보류 중인 쌍 포함), Docker 컨테이너가 게시하는 모든 호스트 포트 (`containers.publishedHostPorts`: 실행 중인 컨테이너의 실시간 바인딩 및 중지된 컨테이너의 구성된 바인딩, 왜냐하면 패널 자체 컨테이너 내부의 OS 바인드 프로브는 해당 컨테이너의 네트워크 네임스페이스만 볼 수 있기 때문) 및 OS 프로브의 합집합입니다. Docker 부분은 3초 동안 캐시되며 제한됩니다. 2.5초 안에 응답하지 않는 목록은 Docker 부분만 삭제하고, 느린 검사는 해당 컨테이너의 포트만 비용이 듭니다. 서버 생성 및 `servers.changeGamePort`는 선택 및 해당 주장만 다루는 단일 직렬화 체인을 통해 포트를 선택합니다 (생성의 행 쓰기, 메모리 내 예약; 포트 변경 시). BlueMap의 포트 선택기 및 추가 포트 재정의는 이 체인에 포함되지 않으며 Docker를 참조하지 않습니다. 기존 서버의 포트 변경 (`servers.changeGamePort`, 서버의 op 잠금 아래)은 즉시 적용됩니다. 왜냐하면 Docker는 컨테이너 생성 시 포트 바인딩을 수정하기 때문입니다. 새 쌍 (RCON은 항상 게임 + `PORT_RCON_OFFSET`)은 메모리 내에서 확인 및 예약됩니다 (`ports.reserve`, 이전 및 새 쌍 모두, 다른 모든 선택에서 존중됨). 포트 잠금 아래에 있습니다. 재빌드를 기다리는 다른 설정이 있는 동안에는 거부됩니다 (409 `PENDING_CHANGES`). 따라서 이미 실행된 컨테이너만 재빌드되며, 실행 중인 서버는 요청 시 `restart: true`일 때만 변경됩니다 (그렇지 않으면 409 `NEEDS_CONFIRM`). 이미지는 풀링되고 사용자 정의 컨테이너 이름이 아무것도 건드리기 전에 확인됩니다. 실행 중인 서버는 중지됩니다. 그런 다음 새 쌍은 `pending_recreate = 1`로 기록됩니다 (따라서 거기서 패널 충돌이 발생하면 "재빌드 보류 중"이라는 정직한 메시지가 남음). 컨테이너가 제거되고 새 쌍으로 재빌드된 후 시작됩니다. 중지 후 단계 중 하나라도 실패하면 `putBackOnOldPort`는 이전 쌍을 다시 작성하고, 재빌드하고 (실행 중이었다면 재시작), 해당 쌍에 기록하며 실패한 단계를 기록합니다. 기록 및 경고는 이것조차 실패했는지 여부를 알려주며, 이는 사람이 시작할 때까지 서버가 중지된 상태로 남게 됩니다. `settings` 기능만 있으면 실행 중인 서버도 포함됩니다. 비관리자는 `PORT_GAME_START`부터만 선택할 수 있습니다.
  (마이그레이션 029의 `port_*_pending` 열은 이전, 미출시 디자인에 속하며 사용되지 않습니다; 031에서 삭제됩니다.) 잠금 충돌은 409를 `code: 'BUSY'`로 응답하며, 재시도하는 호출자는 단어 대신 이를 확인합니다. 충돌 자동 재시작 (`watcher.restartAfterCrash`) 및 예약된 백업 또는 시작 (`scheduler.runTaskWithRetry`)은 서버가 다른 작업으로 바쁜 경우 20초 / 60초마다 최대 30분 동안 재시도하며, 팩 업데이트 또는 롤백은 동일한 방식으로 잠긴 단계를 재시도합니다 (`opLock.retryWhileBusy`). 충돌 재시작 또는 대기 중인 예약 시작은 누군가가 서버를 중지, 종료 또는 시작한 이후 (`events.lifecycleActionSince`) 포기하며, 충돌 재시작은 자동 재시작이 꺼져 있거나 서버가 사라진 경우에도 포기합니다. 예약된 재시작, 중지 및 명령은 재시도되지 않으며, 마지막 실행이 아직 대기 중인 예약은 다음 발사를 건너뜁니다.
- **디스크 할당량**은 Docker가 바인드 마운트 사용량을 제한할 수 없기 때문에 패널에서 강제됩니다. 인덱서가 디렉토리별 크기를 캐싱하고 디스크 증가 작업은 이에 따라 제한됩니다.
- **비밀 정보** (RCON 비밀번호, API 키, TOTP 비밀, Discord 웹훅 URL)는 `$DATA_DIR/.secret-key` (모드 `0600`, 자동 생성)에 대한 전용 무작위 키를 사용하여 AES-256-GCM으로 암호화됩니다. `SESSION_SECRET`와는 독립적입니다. `SESSION_SECRET`에서 파생된 키는 전용 키가 존재하기 전에 작성된 값에 대한 복호화 전용 폴백으로 유지되며, `src/services/secretsMigration.js`는 부팅 시 한 번 해당 값들을 전용 키 아래에 다시 암호화합니다. 존재하는 `.secret-key`가 파싱되지 않으면 부팅 오류가 발생합니다 (절대 자동으로 다시 생성되지 않음). 청사진은 내보낼 때 모든 비밀 정보를 제거합니다.
- **`server.properties`는 패널 소유이지만 환경 변수로 가려집니다.** itzg 이미지는 각 시작 시 환경 변수 기반 속성을 다시 적용합니다 (`OVERRIDE_SERVER_PROPERTIES` 기본값 true). 따라서 패널이 직접 편집한 값 (월드 컨트롤 PvP/난이도, 화이트리스트 토글, 파일 편집기)은 해당 환경 변수가 제거되고 컨테이너가 재생성되지 않으면 다음 시작 시 조용히 되돌려집니다. 모든 직접 속성 쓰기는 `src/services/servers.js`의 `writeServerProperties()` (전체 파일) 또는 `setServerProperty()` (단일 키)를 통해 이루어지며, 파일이 원자적으로 다시 작성되고, 변경된 각 키 뒤의 환경 변수가 해제되고 (`prop:` 속성을 통해 카탈로그 필드에, 이미지 자체의 속성 정의에 대해 테스트에서 확인됨), `pending_recreate` 플래그가 지정됩니다. 난이도는 파일에 기록되고 RCON으로도 전송됩니다. 왜냐하면 전용 서버는 부팅 시마다 `difficulty` 속성을 다시 적용하기 때문입니다. Minecraft 자체는 부팅 시 값에서 `server.properties`를 다시 저장합니다 (`whitelist on/off` 시), 이는 서버가 실행 중일 때 편집한 내용을 되돌릴 수 있습니다. 따라서 실행 중인 화이트리스트 토글은 먼저 파일을 스냅샷하고 `white-list`만 변경하여 다시 작성합니다. MOTD도 동일한 계약입니다: 직접 `motd` 파일 편집은 이를 해제하므로 마지막 쓰기가 우선합니다.

## 데이터 및 와이어 형식

- **`data/panel.db`** - SQLite 데이터베이스. 매일 `VACUUM INTO`를 통해 `data/backups/_panel/`로 스냅샷됩니다 (최신 14개 보관). 부팅 시 `PRAGMA integrity_check`가 실행됩니다.
- **`data/.session-secret`** - 자동 생성된 쿠키 서명 비밀 키. 첫 실행 시 `SESSION_SECRET`가 설정되지 않은 경우 생성됩니다. 이를 삭제하면 비밀 키가 순환됩니다 (세션이 무효화됨).
- **`data/.secret-key`** - 전용 32바이트 저장 암호화 키 (모드 `0600`), 첫 실행 시 자동 생성됩니다. `SESSION_SECRET`와 독립적입니다. 이를 삭제하면 저장된 모든 자격 증명이 해독 불가능해지므로 백업과 함께 보관해야 합니다.
- **청사진 (`.mcserver.zip`)** - 설정, 리소스, 고정된 팩 참조, 오버레이 매니페스트 (소스 URL + sha256), 선택된 설정 파일, 그리고 선택적으로 월드를 설명하는 `manifest.json`이 포함된 zip 파일입니다. 가져오기 시 각 모드를 다시 다운로드하고 해시 검증하며 새 포트를 할당합니다.
- **패널에서 생성된 Docker 컨테이너**는 감시자가 찾을 수 있도록 이름이 지정되고 레이블이 지정됩니다. 패널은 컨테이너의 전체 수명 주기를 소유합니다.

## 부팅 시퀀스

1. 가장 먼저 `require('./instrument')` (Sentry 심)을 실행한 다음, 지원되지 않는 Node 버전에 대해 명확하게 실패하도록 `require('./preflight')`를 실행합니다.
2. 설정을 로드합니다. `.session-secret` **및** `.secret-key`를 확인/생성합니다.
3. `ensureDataRoot()` - `./data` 레이아웃을 생성하고 `tmp/`를 삭제합니다.
4. DB 마이그레이션을 실행한 다음 `PRAGMA integrity_check`를 실행합니다 (크게 로깅하며, 실패 시 `data/backups/_panel`을 가리킴).
5. 레거시 `SESSION_SECRET`-키 암호화된 비밀 정보를 `.secret-key` 아래에 다시 암호화합니다 (`secretsMigration`).
6. 환경에서 API 키를 한 번 가져옵니다 (`apiKeys.importFromEnvOnce()`). 아직 고정되지 않은 모드팩 선택기를 사용하는 서버를 고정합니다 (`packPins.pinUnpinnedServers()`). 이전 프로세스에서 실행 중이던 버전 호환성 스캔을 중단된 것으로 표시합니다 (`compat.reconcileScans()`). 그런 다음 시작 청사진을 시드합니다 (보호됨).
7. HTTP + WS 서버를 시작합니다. 노출된 바인드 시, 첫 실행 `/setup` PIN을 출력합니다.
8. 부팅 후 런타임 가드를 설치합니다 (처리되지 않은 오류를 잡음; `MSM_EXIT_ON_FATAL=1`은 관리형 배포를 위해 강제 종료함).
9. 백그라운드 서비스를 시작합니다: WS 중개자, 스토리지 인덱서, 충돌 + 인벤토리 감시자, 스케줄러, Discord 이벤트 브리지, 챗봇 아웃리치 감시자, **일일 유지 관리 타이머** (오래된 분석 행, 챗봇 대화 기록, 이벤트 기록 (365일) 및 API 캐시 행 정리, 그런 다음 `panel.db` 스냅샷).
10. **백그라운드에서** Docker를 초기화합니다. 데몬이 다운된 동안에도 UI는 완전히 사용할 수 있습니다. Docker 기능은 연결 가능해지면 활성화됩니다. 연결되면 `refreshStatuses({ boot })`는 캐시된 상태를 조정하고, 패널이 재시작되기 전에 실행 중이었으나 다시 시작되지 않을 서버에 대해 일회성 `offline-after-restart` 이벤트를 발생시키며, 부팅 루프는 `auto_start` 서버를 시작하고 중단 중에 충돌한 것으로 발견된 `auto_restart` 서버를 복구합니다 (충돌 루프 백오프 존중).

> 사전 검사 전에 계측을 수행하는 순서는 의도적인 절충입니다. 이를 통해 향후 Sentry 배선이 런타임을 먼저 패치할 수 있으며, 매우 오래된 Node에 대한 메시지가 약간 덜 친절하다는 단점이 있습니다.

## 빌드 파이프라인

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, 코드 분할 포함 ESM). `postinstall`은 **CSS만** 실행합니다. `public/css/app.css` 및 `public/dist/`는 gitignore된 빌드 아티팩트입니다. Dockerfile 빌드 단계는 전체 `pnpm run build`를 실행하고 `public/`를 런타임 이미지에 복사합니다. 정적 자산은 지문이 찍힌 파일의 경우 `immutable`/long-cache, CSS/JS의 경우 short-cache, HTML 및 `/api`의 경우 `no-cache`로 제공됩니다.
