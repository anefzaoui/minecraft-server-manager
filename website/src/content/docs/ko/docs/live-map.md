---
title: '실시간 지도'
description: '서버 월드의 BlueMap 실시간 3D 지도를 클릭 한 번으로 활성화하고, 패널 로그인으로만 제공됩니다.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← 문서 인덱스로 돌아가기](/docs/)

서버의 **월드 → 지도** 탭은 플레이어 위치와 모든 차원을 포함하여 [BlueMap](https://bluemap.bluecolored.de/) (무료 오픈 소스)으로 그려지는 실시간 확대/축소 가능한 3D 월드 지도를 보여줍니다. 패널이 이를 설치하고 구성하며 제공하므로, 포트를 열거나 설정 파일을 편집할 필요가 없습니다.

## 활성화하기

1. 서버를 열고 **월드 → 지도**로 이동합니다.
2. **실시간 지도 활성화**를 누릅니다. 패널은 Modrinth에서 서버 로더 및 Minecraft 버전과 일치하는 BlueMap 빌드를 설치하고, BlueMap의 리소스 다운로드를 승인하며, 무료 포트를 할당합니다.
3. 서버를 다시 시작합니다 (변경 사항은 다음 시작 시 적용되며, 서버는 재시작 대기 상태로 표시됩니다).

BlueMap은 백그라운드에서 렌더링되므로 새 지도가 첫 타일을 그리는 데 몇 분이 걸립니다. 그때까지 탭에는 지도가 아직 준비되지 않았다고 표시되며 자동으로 다시 확인합니다. 준비가 되면 **전체 화면**을 눌러 자체 브라우저 탭에서 지도를 엽니다.

모드 로더(Fabric, Quilt, Forge, NeoForge)가 있는 서버와 플러그인 서버(Paper, Purpur 및 기타 Paper 계열, Spigot), 모드팩 서버에서도 작동합니다. Vanilla 서버에는 BlueMap 빌드가 없으며 탭에 그렇게 표시됩니다.

## 누가 볼 수 있나요

지도는 패널의 로그인 뒤에서만 제공됩니다. 패널에서 서버를 볼 수 있는 사람은 누구나 해당 지도를 열 수 있으며, 다른 사람은 열 수 없습니다. BlueMap 자체 포트는 인터넷에 공개되지 않습니다 ([포트 개요](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). 지도를 켜거나 끄려면 서버의 **설정** 권한이 필요합니다 ([사용자 및 역할](/docs/users-and-roles/#per-server-permissions)).

패널 자체가 Docker에서 실행될 때 서버 컨테이너 내부의 BlueMap에 접근합니다. [README](https://github.com/anefzaoui/minecraft-server-manager#installation)에서 리버스 프록시 설정에 대한 자세한 내용을 설명합니다.

## 비활성화하기

**지도 비활성화**는 패널이 설치한 BlueMap jar 파일을 제거하고 포트를 해제합니다. 이 역시 다음 재시작부터 적용됩니다. 월드 자체는 그대로 유지되며, 렌더링된 지도 타일은 서버 폴더에 남아 있다가 **파일** 탭에서 삭제할 수 있습니다.

관련 항목: [월드 및 파일](/docs/worlds-and-files/), [초대 및 상태 페이지](/docs/invites-and-status-page/).
