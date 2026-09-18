---
title: '예약'
description: '예약 페이지는 cron 표현식을 사용하여 반복 작업을 자동화합니다.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← 문서 색인으로 돌아가기](/docs/)

**스케줄** 페이지는 cron 표현식을 사용하여 반복 작업을 자동화합니다. 외부 cron이나 스크립트가 필요 없습니다.

![Schedules](/docs/images/schedules.png)

## 스케줄링 가능한 항목

- **재시작** - 장시간 실행되는 서버를 건강하게 유지하기 위한 야간 재시작.
- **백업** - 정기적인 스냅샷 ([백업](/docs/backups/) 페이지에서 `scheduled`로 태그됨).
- **명령어** - 스케줄에 따라 모든 서버 명령어를 실행합니다.
- **업데이트 확인** - 주기적으로 오래된 항목을 새로 고칩니다.

각 스케줄은 특정 서버(또는 전역적으로 패널)를 대상으로 하며, 자체 cron 표현식으로 실행되고, 삭제하지 않고 활성화하거나 비활성화할 수 있습니다. 마지막 실행 시간이 표시되어 제대로 작동하는지 확인할 수 있습니다.
