---
title: '每台伺服器的 Minecraft 聊天機器人'
description: '此分支為每個受管理的 Minecraft 伺服器添加了一個由管理員配置的聊天機器人。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← 返回文件索引](/docs/)

此分支為每個管理的 Minecraft 伺服器新增了由管理員設定的聊天機器人。它連接到一個
OpenAI 相容的聊天補全端點，包括區域網路上的 Ollama。每個伺服器都有
自己的端點、模型、調用名稱、角色、對話記錄策略、外展訊息和權力策略。預設的調用是 `@wizard`，預設的角色是扮演一位古老、
活潑的巫師；兩者皆可編輯。

![Chatbot settings](/docs/images/integrations-chatbot.png)

## 玩家體驗

- 任何玩家都可以使用 `@wizard <訊息>`（或設定的調用名稱）進行對話，並獲得
  確定性、與 Minecraft 版本相符的原版配方協助。
- 加入問候語和可設定的一次性遊戲會話簽到會提醒玩家聊天機器人可用。`@wizard chat` 會開啟一個簡短的選擇加入對話視窗；`@wizard bye` 會關閉它。
- **基礎使用者**可以調用已啟用的自我/世界權力。**權力控制器**可以調用獨立驗證的、影響其他線上玩家的動作。不屬於這兩類的使用者只能進行對話。
- 基礎使用者自我贈送物品時使用物品允許清單。控制器可以給予其他玩家任何有效的、命名空間化的原版或模組物品，但需遵守數量限制和其他權力安全措施。

![Chatbot transcripts](/docs/images/chatbot-transcripts.png)

## 設計與安全性

設定和對話記錄僅限管理員存取。模型永遠不會接收原始 RCON 或任意
命令執行。訊息只會暴露與其明確意圖相符的單一固定工具；
伺服器代碼會在執行現有服務操作前驗證授權、參數、標誌、數量、冷卻時間和確切的線上玩家名稱。Minecraft 選擇器將被拒絕，跨玩家動作不能針對呼叫者，權力以乾運行模式開始，並且每一次嘗試的權力都會被稽核。不支援的工具調用模型將回退到僅對話模式。

回覆內容會限制在 Minecraft 聊天中。已知的原版配方來自捆綁的版本化配方資料，並以穩定的 2x2/3x3 列呈現；LLM 不被信任來自行設計配方佈局。未知或模組配方將引導玩家前往 JEI/REI，而不是虛構答案。

## 主要實作檔案

- `src/services/wizard.js`: 每伺服器設定、OpenAI 相容請求、聊天處理、
  外展、對話記錄保留和回應限制。
- `src/services/wizardPowers.js`: 角色檢查、意圖特定工具綱要、驗證、執行、
  冷卻時間和權力稽核。
- `src/services/wizardRecipes.js`: 確定性版本化配方查找和網格格式化。配方
  和物品資料來自捆綁的 [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data)
  套件。（此文件早期草稿曾指向一個從未提交的 `src/data/recipes/` 資料夾；
  該資料夾並不存在，資料位於該套件中。請參閱「依賴性足跡」。）
- `src/analytics/ingest.js`: 將解析後的加入、離開和玩家聊天轉發給聊天機器人。
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, 和
  `views/partials/server/integrations.hbs`: 管理員 API 和每伺服器整合使用者介面。
- `src/db/migrations/011_wizard_chat.js` 至 `019_wizard_power_controllers.js`: 持續性綱要。
- `test/wizard.test.js`: 授權、工具邊界、保留、外展和聊天行為測試。

內部 `wizard` 路由/模組/表格名稱保留用於升級和 API 相容性；
「chatbot」是面向使用者的產品術語。同樣，儲存的 `power_testers_json` 欄位對應
UI 的**基礎使用者**群組。

## 依賴性足跡 (`minecraft-data`)

配方協助使用 `minecraft-data` 套件。它在磁碟上佔用空間較大（安裝後約 429 MB），
並且因為它是執行時期依賴項而非開發依賴項，所以會包含在生產映像檔中。我們特意保留它，
以便配方協助可以在離線狀態下為每個 Minecraft 版本正常工作，無需網路呼叫。

給下一個查看此內容的人（人類或 AI）的注意事項，以免其大小出乎意料：

- 目前僅使用 Java (`pc`) 資料。`wizardRecipes.js` 讀取 `minecraftData.versions.pc`
  以及每個版本的 `recipes`、`items` 和 `blocks` 表格。它實際觸及的檔案加起來大約佔
  每個 pc 版本 15 MB。
- 套件中約有 330 MB 是 `data/bedrock`，目前沒有任何內容讀取它。我們特意將其保留。如果面板將來增加了對 Bedrock Minecraft 的支援，Bedrock 的配方和物品資料已經在這裡，因此配方功能可以在不增加新依賴項的情況下擴展到涵蓋 Bedrock 伺服器。從 `minecraftData.versions.bedrock` 開始，並遵循與 pc 路徑相同的結構。
- 如果在 Bedrock 支援落地之前必須縮減空間，此儲存庫中已有相應模式。`src/services/itemRegistry.js` 在需要時從 jsDelivr CDN 獲取 `minecraft-data` 檔案，並將其快取在 `api_cache` 中。採用這種方法，或使用一個涵蓋幾個常見版本的小型手動挑選的 `src/data/recipes/` 子集，都可以大大縮小映像檔的大小。

## 本地儲存和手動檢查

所有設定和保留的對話記錄都儲存在面板容器內 `/data/panel.db` 的面板 SQLite 資料庫中。使用標準的 Compose 掛載，主機路徑為
`${DATA_DIR_HOST}/panel.db`（例如 `/opt/msm/data/panel.db`）。相關表格是
`wizard_configs`、`wizard_transcripts` 和 `wizard_outreach`；權力稽核是 `events`
表格中類型為 `wizard-power` 的列。可選的 LLM API 金鑰使用面板的
`SESSION_SECRET` 進行 AES-256-GCM 加密，通常儲存為 `${DATA_DIR_HOST}/.session-secret`。

在直接編輯 SQLite 之前備份資料庫並停止面板，以便安全處理其 WAL。
建議使用管理員 UI/API，因為它會應用驗證和加密。複製即時資料庫時，請將
`panel.db`、`panel.db-wal` 和 `panel.db-shm` 檔案放在一起。
