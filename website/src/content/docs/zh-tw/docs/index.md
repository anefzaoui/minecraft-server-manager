---
title: '文件'
description: '為 itzg/docker-minecraft-server 提供完整、自行託管的控制面板。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

一個完整的、自行託管的控制面板，用於 [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)。從您的瀏覽器創建、運行和管理 Minecraft 伺服器。無需命令列，無需手動編輯 YAML。

![Dashboard](/docs/images/dashboard.png)

## 開始

- **[入門](/docs/getting-started/)** - 首次運行設置、登錄和熟悉介面。
- **[儀表板](/docs/dashboard/)** - 所有伺服器、玩家和活動的一目了然的概覽。

## 運行伺服器

- **[創建與管理伺服器](/docs/servers/)** - 創建嚮導、伺服器類型、版本和每個伺服器的設定。
- **[主控台與聊天指令](/docs/console-and-chat/)** - 即時主控台，以及以玩家身份運行的自訂遊戲內聊天指令。
- **[模組包](/docs/modpacks/)** - 安裝 CurseForge、Modrinth、FTB 和 GT New Horizons 模組包，始終固定到確切版本。
- **[世界與檔案](/docs/worlds-and-files/)** - 在瀏覽器中交換世界、管理模組和編輯檔案。
- **[縮減世界](/docs/world-shrink/)** - 通過移除無人訪問的區塊來回收磁碟空間，單獨或作為備份的一部分。
- **[即時地圖](/docs/live-map/)** - 一鍵式 BlueMap 3D 世界地圖，位於面板登錄後方。
- **[邀請與狀態頁面](/docs/invites-and-status-page/)** - 位址、邀請文字和客戶端模組包供朋友使用，以及公開的狀態頁面。

## 資料與自動化

- **[每個伺服器的聊天機器人](/docs/chatbot/)** - 本機/OpenAI 相容的對話、外展、保留的記錄以及受限的遊戲玩法權力。
- **[備份](/docs/backups/)** - 一鍵快照、計劃備份、保留數量（面板範圍或每個伺服器）以及還原。
- **[藍圖](/docs/blueprints/)** - 捕獲伺服器的整個配置並從中創建新的伺服器。
- **[排程](/docs/schedules/)** - cron 驅動的重啟、備份和指令。
- **[儲存空間](/docs/storage/)** - 每個伺服器的磁碟使用量和面板強制配額。
- **[更新](/docs/updates/)** - 追蹤新的伺服器、模組包、映像和模組版本，檢查您的模組支援哪些 Minecraft 版本，以及撤銷模組更新。
- **[活動記錄](/docs/activity/)** - 所有事件的審計記錄。
- **[整合](/docs/integrations/)** - Discord webhook 通知和通知類別。
- **[公開 API](/docs/public-api/)** - 一個只讀的、經過 token 身份驗證的 HTTP API，用於從面板外部獲取伺服器狀態。

## 帳戶與安全性

- **[用戶與角色](/docs/users-and-roles/)** - 管理員、操作員和查看者，各自的功能以及細化它們的每個伺服器權限。
- **[雙重認證](/docs/two-factor-authentication/)** - 使用身份驗證應用程式保護您的登錄。

## 指南

與此面板無關：每個 Minecraft 伺服器所有者都會遇到的問題。

- **[伺服器需要多少 RAM？](/docs/guide-server-memory/)** - 要設置的兩個數字，以及為什麼閒置伺服器會顯示為 12 GB。
- **[Vanilla、Paper、Fabric、Forge、NeoForge、Quilt](/docs/guide-choosing-a-loader/)** - 運行哪個，以及選擇背後的插件/模組差異。
- **[您的伺服器無法啟動](/docs/guide-server-wont-start/)** - 閱讀日誌，以及導致大多數失敗的少數原因。
- **[真正能還原的備份](/docs/guide-backups/)** - 一致的副本，還需要保留什麼，以及在需要之前進行測試。
- **[將伺服器移至另一台主機](/docs/guide-moving-a-server/)** - 保持停機時間短暫和庫存完整的順序。

## 底層原理

- **[架構](/docs/architecture/)** - 面板是如何組成的。
- **[網站](/docs/website/)** - minecraft-server-manager.com 如何從此儲存庫構建、翻譯和部署。

---

> 這些文件中的螢幕截圖是在面板的暗黑主題下拍攝的。除非您的作業系統偏好淺色主題，否則面板會以暗黑主題啟動；請使用頂部欄中的主題切換器進行切換。
