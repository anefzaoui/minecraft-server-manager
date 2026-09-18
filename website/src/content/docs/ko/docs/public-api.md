---
title: 'Public API'
description: '패널 외부에서 서버 상태를 가져오기 위한 작고 읽기 전용 HTTP API입니다.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← 이전 문서 인덱스로](/docs/)

패널 외부에서 서버 상태를 가져오기 위한 작고 읽기 전용 HTTP API입니다. 상태 대시보드, 업타임 모니터, Discord 봇, 홈 자동화 규칙 등에 사용할 수 있습니다. 이 API는 패널 자체에서 제공하며 패널 자체 페이지와 동일한 실시간 데이터를 반환합니다(메모리 내 캐시에서). 따라서 이 API를 폴링해도 Docker에 전혀 영향을 주지 않습니다.

이 기능은 **관리자가 사용하기 전까지 비활성화되어 있으며 관리자만 접근할 수 있습니다.** 토큰이 존재하기 전까지는 아무것도 노출되지 않습니다.

## 활성화하기

**설정 → 공개 API → 새 키**. 키 이름을 지정하고, 접근 범위를 선택합니다(모든 서버 또는 특정 서버 그룹). 선택적으로 만료일을 설정할 수 있습니다. 전체 키(Bearer 토큰)는 **한 번만** 대화 상자에 표시됩니다. 나중에 식별을 위해 짧은 접두사만 저장되므로 지금 복사해야 합니다.

![Public API settings](/docs/images/settings-public-api.png)

첫 번째 키를 생성하면 API가 자동으로 활성화됩니다(**외부 앱이 상태를 읽도록 허용** 스위치는 일시 중지 컨트롤입니다. 키를 취소하지 않고 서비스를 중지하려면 이 스위치를 끕니다). 언제든지 동일한 테이블에서 키를 취소할 수 있습니다. 해당 키를 사용하는 클라이언트는 즉시 접근 권한을 잃습니다.

토큰은 SHA-256 해시로 저장되며(절대 일반 텍스트로 저장되지 않음), 패널 재시작 후에도 유지되며, 범위가 지정된 서버보다 오래 지속됩니다(삭제된 서버는 해당 토큰의 결과에서 간단히 제외됩니다).

## 인증

토큰을 Bearer 인증 정보로 전송합니다.

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

쿠키는 없으며 **CORS도 지원하지 않습니다**. 이 API는 브라우저 앱이 아닌 서버 간 통신 및 CLI 호출용입니다. 패널이 리버스 프록시 뒤에 있다면 프록시가 `Authorization` 헤더를 전달하는지 확인하세요.

실패 시 `{ "ok": false, "error": "..." }`와 함께 `401`을 반환합니다. `GET`(또는 `HEAD`) 외의 다른 메서드는 `405`를 반환합니다. 알 수 없는 경로는 `404`를 반환합니다. API가 비활성화된 경우 모든 경로는 `404`를 반환합니다.

## 속도 제한

각 토큰은 자체 예산을 가지며, `RATE_LIMIT_PUBLIC_API_PER_MIN`(기본값 `120` 요청/분, `0`은 제한기 비활성화)입니다. 제한을 초과하면 `429`를 반환합니다. 유효한 토큰을 전혀 제시하지 않는 요청(누락, 잘못된 형식, 취소됨 또는 만료됨)은 클라이언트 IP당 별도로 해당 숫자의 5배로 제한되므로, 토큰을 순환하여 프로빙해도 예산을 우회할 수 없습니다.

## 엔드포인트

### `GET /api/v1/servers`

토큰이 범위로 지정된 모든 서버입니다.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

하나의 서버, `server` 키 아래에 동일한 객체가 있습니다. 알 수 없는 ID **및** 토큰이 범위로 지정되지 않은 서버(존재 여부 확인 불가)의 경우 `404`를 반환하고, 잘못된 형식의 ID의 경우 `400`을 반환합니다.

## 응답 필드

| 필드            | 의미                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `total`         | 이 토큰으로 볼 수 있는 서버 수(범위 필터 적용 후).                                              |
| `online`        | 그중 `running` 상태인 서버 수입니다.                                                            |
| `id`            | 고정 서버 ID (`srv_...`).                                                                       |
| `name`          | 표시 이름.                                                                                      |
| `type`          | itzg 서버 유형 (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                     |
| `state`         | `running`, `starting`, `stopped`, 또는 `crashed` - 패널의 내부 상태에 대한 안정적인 요약입니다. |
| `cpuPct`        | 최근 CPU 사용률(%), 서버가 실행 중이 아닐 경우 `null`입니다.                                    |
| `memoryMb`      | MB 단위의 상주 메모리, `null`일 수 있습니다.                                                    |
| `memoryLimitMb` | MB 단위의 구성된 컨테이너 메모리 제한, `null`일 수 있습니다.                                    |
| `uptimeSeconds` | 컨테이너가 시작된 이후의 초, `null`일 수 있습니다.                                              |
| `players`       | `{ online, max }` 또는 서버가 플레이어 목록을 보고할 때까지 `null`입니다.                       |

## 예시

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
