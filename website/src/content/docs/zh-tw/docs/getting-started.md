---
title: '開始使用'
description: '安裝 Minecraft Server Manager 並完成首次執行設定：系統檢查、您的時區以及管理員帳戶。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← 返回文件索引](/docs/)

## 首次設定

首次開啟面板時，一個簡短的設定精靈會引導您完成：

1.  **系統檢查**：確保 Docker 可連線、Node.js 版本足夠新，以及資料夾具有寫入權限。即使 Docker 尚未執行，您仍可繼續；伺服器的建立與啟動將會等到 Docker 啟動後再進行。
2.  **建立您的管理員帳號**：這是您新增其他帳號前唯一存在的帳號，並擁有完全的控制權。請選擇一個使用者名稱（2 到 32 個字元）和一個至少 8 個字元的密碼。建立完成後，您將會立即登入。
3.  **面板設定**（選填）：提供一個公開網域供玩家顯示連線位址、CurseForge API 金鑰，以及您的時區。所有這些設定都可以在之後於「**設定**」中進行變更。

最後一步提供「**建立伺服器**」或「**前往儀表板**」的選項。

![首次設定的系統檢查步驟](/docs/images/setup-system-check.png)

> **公開安裝需要 PIN 碼保護。** 如果您將面板綁定到非本機迴環位址（`PANEL_HOST` 非 `127.0.0.1`），設定頁面還會要求輸入一個 **6 位數的 PIN 碼**。面板會在啟動時將此 PIN 碼輸出到其主控台。請在輸入您的使用者名稱和密碼時一併輸入。這可以防止陌生人在您之前連線到該埠口並聲稱管理員帳號。一旦管理員帳號建立，PIN 碼就會消失。

## 登入

設定完成後，面板將會受到登入畫面的保護。請輸入您的使用者名稱和密碼以繼續。

![登入](/docs/images/login.png)

如果您的帳號已啟用 [雙重驗證](/docs/two-factor-authentication/)，在輸入密碼後，系統會要求您輸入驗證器應用程式提供的 6 位數驗證碼。

## 導覽介面

所有功能都集中在左側的側邊欄：

- **儀表板**：一覽所有伺服器（[詳細資訊](/docs/dashboard/)）。
- **伺服器**、**模組包**、**世界**、**藍圖**：用於建立和管理伺服器及其內容。
- **更新**、**備份**、**排程**、**儲存空間**、**活動紀錄**：營運相關功能：哪些項目過期、您的快照、自動化、磁碟使用量以及稽核日誌。
- **權限**（位於底部，僅限管理員）：每個使用者在每個伺服器上可執行的操作（[詳細資訊](/docs/users-and-roles/#per-server-permissions)）。
- **設定**（位於底部，僅限管理員）：API 金鑰、面板設定、新伺服器的預設值、[備份保留設定](/docs/backups/#retention)、使用者、登入安全設定以及公開 API。

在這些項目下方，側邊欄會列出您的伺服器。開啟伺服器後會顯示其專屬分頁：**總覽**、**主控台**、**玩家**、**模組**、**世界**、**備份**、**監控**，以及**設定**，其中大部分還有相關的子分頁（例如，「**設定 → 設定檔**」包含伺服器的設定及其遊戲埠口）。請參閱 [單一伺服器](/docs/servers/#a-single-server)。

頂部列包含「**建立伺服器**」按鈕、「**佈景主題切換器**」（深色/淺色），以及您的「**帳戶選單**」，您可以在其中變更個人資料圖片、管理 [雙重驗證](/docs/two-factor-authentication/) 或登出。

## 手機或平板裝置上的使用

每個頁面都優先針對窄螢幕進行佈局，然後再擴展：側邊欄會隱藏在選單按鈕後方，資料表格會堆疊成卡片，工具列會換行，世界控制列會折疊成一個卡片，您需要時再開啟。按鈕和標籤具有實際的觸控目標大小。沒有任何功能僅限於桌面版。

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="手機上的儀表板" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="手機上的伺服器總覽" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="手機上的主控台" width="180">
  <img src="/docs/images/mobile/mods.png" alt="手機上的模組分頁" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="手機上的版本相容性" width="180">
  <img src="/docs/images/mobile/settings.png" alt="手機上的設定" width="180">
</p>

## 所需條件

面板透過 Docker 來執行伺服器，因此需要存取 Docker daemon（Docker Desktop 或 Docker Engine socket）。當 Docker 可連線時，儀表板上的 Docker 圖塊會顯示「**已連線**」及其版本。如果 Docker 未執行，面板仍可運作。只是在 Docker daemon 啟動前，您無法啟動伺服器。

## 後續步驟

- [建立您的第一個伺服器 →](/docs/servers/)
- [使用 2FA 保護您的帳號 →](/docs/two-factor-authentication/)
