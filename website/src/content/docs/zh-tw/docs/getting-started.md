---
title: '開始使用'
description: '首次開啟面板時，系統會要求您建立一個管理員帳戶。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← 返回文件索引](/docs/)

## 首次設定

首次開啟面板時，系統會要求您建立一個管理員帳戶。這是您建立的唯一帳戶，擁有完全的控制權。

請選擇一個使用者名稱和至少 8 個字元的密碼。這樣就完成了：您已登入並直接進入儀表板。

> **公開安裝需要 PIN 碼保護。** 如果您將面板綁定到非迴環位址（`PANEL_HOST` 不是 `127.0.0.1`），設定頁面還會要求您輸入一個 **6 位數 PIN 碼**。面板會在啟動時將其列印到主控台中。請與您的使用者名稱和密碼一起輸入。這樣可以防止陌生人在您之前存取埠時竊取管理員帳戶。PIN 碼在管理員帳戶建立後就會消失。

## 登入

設定完成後，面板將受到登入畫面的保護。輸入您的使用者名稱和密碼即可繼續。

![登入](/docs/images/login.png)

如果您帳戶啟用了 [雙重驗證](/docs/two-factor-authentication/)，在輸入密碼後，系統會要求您輸入驗證器應用程式提供的 6 位數驗證碼。

## 導覽

所有功能都集中在左側側邊欄：

- **儀表板** - 一覽所有伺服器（[詳細資訊](/docs/dashboard/)）。
- **伺服器**、**模組包**、**世界**、**藍圖** - 建立和管理伺服器及其內容。
- **更新**、**備份**、**排程**、**儲存空間**、**活動記錄** - 操作相關功能：哪些內容已過期、您的快照、自動化、磁碟使用量和稽核日誌。
- **設定**（底部）：使用者、API 金鑰和面板設定。

頂部列有「**建立伺服器**」按鈕、「**主題切換**」（深色/淺色）以及您的「**帳戶選單**」，您可以在其中管理 [雙重驗證](/docs/two-factor-authentication/) 或登出。

## 在手機或平板電腦上使用

每個頁面都優先針對狹窄螢幕進行佈局，然後再擴展：側邊欄會隱藏在選單按鈕後面，資料表格會堆疊成卡片，工具列會換行，世界控制列會折疊成一個卡片，您需要時再開啟。按鈕和晶片具有實際的觸控目標大小。沒有任何功能僅限桌面版使用。

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="手機上的儀表板" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="手機上的伺服器概覽" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="手機上的主控台" width="180">
  <img src="/docs/images/mobile/mods.png" alt="手機上的模組分頁" width="180">
  <img src="/docs/images/mobile/settings.png" alt="手機上的設定" width="180">
</p>

## 您需要什麼

面板透過 Docker 來執行伺服器，因此需要存取 Docker守護程式（Docker Desktop 或 Docker Engine socket）。當 Docker 可存取時，儀表板上的 Docker 圖塊會顯示「**已連線**」及其版本。如果無法存取，面板仍會執行。直到 Docker 守護程式啟動後，您才能啟動伺服器。

## 後續步驟

- [建立您的第一個伺服器 →](/docs/servers/)
- [使用 2FA 保護您的帳戶 →](/docs/two-factor-authentication/)
