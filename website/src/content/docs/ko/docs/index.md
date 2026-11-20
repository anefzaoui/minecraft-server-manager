---
title: '문서'
description: 'itzg/docker-minecraft-server를 위한 완전한 자체 호스팅 제어판입니다.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)를 위한 완전한 자체 호스팅 제어판입니다. 브라우저에서 Minecraft 서버를 생성, 실행 및 관리할 수 있습니다. 명령줄이나 YAML 파일 수동 편집이 필요 없습니다.

![대시보드](/docs/images/dashboard.png)

## 시작하기

- **[시작하기](/docs/getting-started/)** - 최초 설정, 로그인 및 탐색 방법.
- **[대시보드](/docs/dashboard/)** - 모든 서버, 플레이어 및 활동을 한눈에 볼 수 있는 화면.

## 서버 실행

- **[서버 생성 및 관리](/docs/servers/)** - 생성 마법사, 서버 유형, 버전 및 서버별 설정.
- **[콘솔 및 채팅 명령](/docs/console-and-chat/)** - 실시간 콘솔 및 플레이어로서 실행되는 사용자 지정 게임 내 채팅 명령.
- **[모드팩](/docs/modpacks/)** - CurseForge, Modrinth, FTB 및 GT New Horizons 팩을 정확한 버전에 고정하여 설치합니다.
- **[월드 및 파일](/docs/worlds-and-files/)** - 월드를 전환하고, 모드를 관리하고, 브라우저에서 직접 파일을 편집합니다.
- **[월드 축소](/docs/world-shrink/)** - 아무도 방문하지 않는 청크를 제거하여 디스크 공간을 확보합니다. 백업의 일부로 또는 독립적으로 수행할 수 있습니다.
- **[실시간 지도](/docs/live-map/)** - 패널 로그인 뒤에 있는 월드의 원클릭 BlueMap 3D 지도.
- **[초대 및 상태 페이지](/docs/invites-and-status-page/)** - 친구를 위한 주소, 초대 문구 및 클라이언트 모드팩, 그리고 공개 상태 페이지.

## 데이터 및 자동화

- **[서버별 챗봇](/docs/chatbot/)** - 로컬/OpenAI 호환 대화, 아웃리치, 저장된 대화 기록 및 제한된 게임 플레이 권한.
- **[백업](/docs/backups/)** - 원클릭 스냅샷, 예약 백업, 보관할 백업 수(패널 전체 또는 서버별), 복원.
- **[청사진](/docs/blueprints/)** - 서버의 전체 구성을 캡처하고 이를 기반으로 새 서버를 생성합니다.
- **[예약 작업](/docs/schedules/)** - cron 기반 재시작, 백업 및 명령 실행.
- **[저장 공간](/docs/storage/)** - 서버별 디스크 사용량 및 패널에서 강제 적용하는 할당량.
- **[업데이트](/docs/updates/)** - 새 서버, 팩, 이미지 및 모드 버전을 추적하고, 모드에서 지원하는 Minecraft 버전을 확인하고, 모드 업데이트를 되돌립니다.
- **[활동 로그](/docs/activity/)** - 발생한 모든 작업에 대한 감사 추적.
- **[통합](/docs/integrations/)** - Discord 웹훅 알림 및 알림 카테고리.
- **[공개 API](/docs/public-api/)** - 패널 외부에서 서버 상태를 가져오기 위한 읽기 전용, 토큰 인증 HTTP API.

## 계정 및 보안

- **[사용자 및 역할](/docs/users-and-roles/)** - 관리자, 운영자, 뷰어별 권한 및 이를 세분화하는 서버별 권한.
- **[2단계 인증](/docs/two-factor-authentication/)** - 인증 앱으로 로그인을 보호합니다.

## 가이드

이 패널에 국한되지 않는, 모든 Minecraft 서버 소유자가 직면하는 질문들입니다.

- **[서버에 필요한 RAM 용량은 얼마인가요?](/docs/guide-server-memory/)** - 설정해야 할 두 가지 숫자와 유휴 서버가 12GB로 표시되는 이유.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - 어떤 것을 실행해야 하는지, 그리고 선택의 기반이 되는 플러그인/모드 차이점.
- **[서버가 시작되지 않습니다](/docs/guide-server-wont-start/)** - 로그 읽기 및 대부분의 실패 원인.
- **[실제로 복원되는 백업](/docs/guide-backups/)** - 일관된 복사본, 함께 보관해야 할 다른 항목, 필요하기 전에 테스트하는 방법.
- **[서버를 다른 호스트로 이전하기](/docs/guide-moving-a-server/)** - 다운타임을 줄이고 인벤토리를 유지하는 순서.

## 내부 구조

- **[아키텍처](/docs/architecture/)** - 패널이 어떻게 구성되는지.
- **[웹사이트](/docs/website/)** - minecraft-server-manager.com이 이 저장소에서 어떻게 빌드, 번역 및 배포되는지.

---

> 이 문서의 스크린샷은 패널의 다크 테마에서 촬영되었습니다. 패널은 운영 체제가 라이트 테마를 선호하지 않는 한 다크 테마로 시작됩니다. 상단 표시줄의 테마 전환기를 사용하여 전환할 수 있습니다.
