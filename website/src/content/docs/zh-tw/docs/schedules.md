---
title: '排程'
description: '排程頁面使用 cron 表達式自動執行重複性任務。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← 返回文件索引](/docs/)

**排程**頁面可使用 cron 表達式自動執行重複性任務。無需外部 cron，也無需腳本。

![排程](/docs/images/schedules.png)

## 可排程的項目

- **重啟** - 夜間重啟以保持伺服器長期穩定運行。
- **備份** - 定期快照（在 [備份](/docs/backups/) 頁面中標記為 `scheduled`）。
- **指令** - 按排程執行任何伺服器指令。
- **檢查更新** - 定期刷新過期內容。

每個排程都針對特定伺服器（或全域面板），使用自己的 cron 表達式運行，並且可以啟用或禁用，無需刪除。最後運行時間會顯示出來，以便您確認其是否已執行。
