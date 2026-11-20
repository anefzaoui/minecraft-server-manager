---
title: '서버별 Minecraft 챗봇'
description: '이 패널은 관리되는 각 Minecraft 서버에 대해 관리자가 구성한 챗봇을 제공하며, 서버 설정 → 챗봇 탭에서 설정할 수 있습니다.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← 문서 인덱스로 돌아가기](/docs/)

이 패널은 관리자가 각 Minecraft 서버에 대해 구성할 수 있는 챗봇을 제공하며, 서버의 **설정 → 챗봇** 탭에서 설정할 수 있습니다. 이 챗봇은 다른 LAN 호스트의 Ollama를 포함하여 OpenAI 호환 채팅 완료 엔드포인트에 연결됩니다. 각 서버는 자체 엔드포인트, 모델, 호출 이름, 페르소나, 대화 기록 정책, 아웃리치 메시지 및 권한 정책을 가집니다. 기본 호출 이름은 `@wizard`이며, 기본 페르소나는 고대의 장난기 많은 게임 내 마법사를 보여줍니다. 둘 다 편집 가능합니다.

![챗봇 설정](/docs/images/integrations-chatbot.png)

## 플레이어 경험

- 모든 플레이어는 대화 및 결정론적이며 Minecraft 버전을 인식하는 바닐라 레시피 도움을 위해 `@wizard <메시지>`(또는 구성된 호출 이름)를 사용할 수 있습니다.
- 접속 환영 메시지와 구성 가능한 일회성 플레이 세션 확인 메시지는 플레이어에게 챗봇이 사용 가능하다는 것을 상기시킵니다. `@wizard chat`은 짧은 옵트인 대화 창을 열고, `@wizard bye`는 창을 닫습니다.
- **기본 사용자**는 활성화된 자체/월드 권한을 호출할 수 있습니다. **권한 컨트롤러**는 다른 온라인 플레이어에게 영향을 미치는 별도로 검증된 작업을 호출할 수 있습니다. 두 그룹 모두에 속하지 않는 플레이어는 대화만 가능합니다.
- 기본 사용자의 자체 선물은 아이템 허용 목록을 사용합니다. 컨트롤러는 수량 제한 및 기타 권한 보호 장치를 조건으로 다른 플레이어에게 유효한 네임스페이스 바닐라 또는 모드 아이템을 줄 수 있습니다.

![챗봇 대화 기록](/docs/images/chatbot-transcripts.png)

## 디자인 및 보안

구성 및 대화 기록은 관리자만 접근할 수 있습니다. 모델은 원시 RCON 또는 임의 명령 실행을 절대 받지 않습니다. 메시지는 명시적 의도와 일치하는 단일 고정 도구만 노출합니다. 서버 코드는 권한, 인수, 플래그, 수량, 쿨다운 및 정확한 온라인 플레이어 이름을 검증한 후 기존 서비스 작업을 실행합니다. Minecraft 선택자는 거부되며, 플레이어 간 작업은 호출자를 대상으로 할 수 없으며, 권한은 드라이런 모드로 시작하고, 시도된 모든 권한은 감사됩니다. 지원되지 않는 도구 호출 모델은 대화만 가능하도록 대체됩니다.

응답은 Minecraft 채팅에 맞게 제한됩니다. 알려진 바닐라 레시피는 번들로 제공되는 버전별 레시피 데이터에서 가져오며 안정적인 2x2/3x3 행으로 렌더링됩니다. LLM은 레시피 레이아웃을 만드는 데 신뢰되지 않습니다. 알 수 없거나 모드화된 레시피는 답변을 조작하는 대신 플레이어에게 JEI/REI를 사용하도록 안내합니다.

## 주요 구현 파일

- `src/services/wizard.js`: 서버별 구성, OpenAI 호환 요청, 채팅 처리, 아웃리치, 대화 기록 보존 및 응답 제한.
- `src/services/wizardPowers.js`: 역할 확인, 의도별 도구 스키마, 유효성 검사, 실행, 쿨다운 및 권한 감사.
- `src/services/wizardRecipes.js`: 결정론적 버전별 레시피 조회 및 그리드 형식 지정. 레시피 및 아이템 데이터는 번들로 제공되는 [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) 패키지에서 가져옵니다. (이 문서의 이전 초안은 커밋된 적이 없는 `src/data/recipes/` 폴더를 가리켰습니다. 해당 폴더는 없으며 데이터는 패키지에 있습니다. "종속성 발자국" 참조.)
- `src/analytics/ingest.js`: 파싱된 접속, 퇴장 및 플레이어 채팅을 챗봇으로 전달합니다.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, 및 `views/partials/server/integrations.hbs` (`chatbot.hbs`를 통해): 관리자 API 및 서버별 설정 → 챗봇 탭.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js`, 및 `019_wizard_power_controllers.js`: 영구 스키마.
- `test/wizard.test.js`: 권한 부여, 도구 경계, 보존, 아웃리치 및 채팅 동작 테스트.

내부 `wizard` 라우트/모듈/테이블 이름은 업그레이드 및 API 호환성을 위해 유지됩니다. "chatbot"은 사용자 대면 제품 용어입니다. 마찬가지로 저장된 `power_testers_json` 필드는 UI의 **기본 사용자** 그룹에 해당합니다.

## 종속성 발자국 (`minecraft-data`)

레시피 도움말은 `minecraft-data` 패키지를 사용합니다. 디스크에서 크기가 크며(설치 시 약 429MB), 런타임 종속성이므로 개발 종속성이 아니기 때문에 프로덕션 이미지에 포함됩니다. 레시피 도움말이 네트워크 호출 없이 모든 Minecraft 릴리스에 대해 오프라인으로 작동하도록 의도적으로 유지하고 있습니다.

이것을 다음에 볼 사람(인간 또는 AI)을 위한 참고 사항입니다. 따라서 크기가 놀라지 않도록 하십시오.

- 현재는 Java(`pc`) 데이터만 사용됩니다. `wizardRecipes.js`는 `minecraftData.versions.pc`와 버전별 `recipes`, `items`, `blocks` 테이블을 읽습니다. 실제로 접근하는 파일은 모든 pc 버전에 걸쳐 약 15MB입니다.
- 패키지의 약 330MB는 `data/bedrock`이며, 현재 아무것도 읽지 않습니다. 의도적으로 그대로 두고 있습니다. 패널이 Bedrock Minecraft 지원을 추가하게 되면, Bedrock 레시피 및 아이템 데이터가 이미 있으므로 레시피 기능은 새로운 종속성을 추가하지 않고도 Bedrock 서버를 포함하도록 확장될 수 있습니다. `minecraftData.versions.bedrock`부터 시작하여 pc 경로와 동일한 모양을 따르십시오.
- Bedrock 지원이 시작되기 전에 크기를 줄여야 하는 경우, 이 리포지토리에 이미 패턴이 있습니다. `src/services/itemRegistry.js`는 필요할 때 jsDelivr CDN에서 `minecraft-data` 파일을 가져와 `api_cache`에 캐시합니다. 이 접근 방식 또는 몇 가지 일반적인 버전을 포함하는 작은 수작업으로 선택된 `src/data/recipes/` 하위 집합은 이미지를 크게 줄일 것입니다.

## 로컬 저장소 및 수동 검사

모든 설정 및 보존된 대화 기록은 패널 컨테이너 내부의 `/data/panel.db`에 있는 패널 SQLite 데이터베이스에 저장됩니다. 표준 Compose 마운트를 사용하면 호스트 경로는 `${DATA_DIR_HOST}/panel.db`입니다(예: `/opt/msm/data/panel.db`). 관련 테이블은 `wizard_configs`, `wizard_transcripts`, `wizard_outreach`이며, 권한 감사는 `events` 테이블의 `wizard-power` 유형 행에 저장됩니다. 선택적 LLM API 키는 패널의 상주 키인 데이터 폴더의 `.secret-key`( `SESSION_SECRET`과 별개)로 AES-256-GCM 암호화됩니다.

직접 SQLite 편집 전에 데이터베이스를 백업하고 패널을 중지하여 WAL이 안전하게 처리되도록 하십시오. 관리 UI/API를 사용하는 것이 검증 및 암호화를 적용하므로 선호됩니다. 라이브 데이터베이스를 복사할 때 `panel.db`, `panel.db-wal`, `panel.db-shm` 파일을 함께 보관하십시오.
