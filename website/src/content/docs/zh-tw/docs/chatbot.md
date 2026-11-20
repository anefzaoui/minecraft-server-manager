---
title: '每台伺服器的 Minecraft 聊天機器人'
description: '此面板為每個管理的 Minecraft 伺服器提供一個由管理員設定的聊天機器人，可在伺服器的「設定」→「聊天機器人」標籤頁中進行設定。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← 返回文件索引](/docs/)

該面板為每個管理的 Minecraft 伺服器提供一個由管理員設定的聊天機器人，設定位於伺服器的「**設定 → 聊天機器人**」標籤頁。它會連接到一個與 OpenAI 相容的聊天補全端點，包括位於另一個 LAN 主機上的 Ollama。每個伺服器都有自己的端點、模型、調用名稱、角色、對話記錄策略、外展訊息和權力策略。預設的調用名稱是 `@wizard`，預設的角色是扮演一位古老、愛玩的遊戲內巫師；兩者皆可編輯。

![Chatbot settings](/docs/images/integrations-chatbot.png)

## 玩家體驗

- 任何玩家都可以使用 `@wizard <訊息>`（或已設定的調用名稱）進行對話，並獲得確定性的、與 Minecraft 版本相符的原版配方說明。
- 加入問候語和可設定的一次性遊戲會話簽到會提醒玩家聊天機器人可用。「`@wizard chat`」會開啟一個簡短的選擇加入對話視窗；「`@wizard bye`」會關閉它。
- **基礎使用者**可以調用已啟用的自我/世界權力。「**權力控制器**」可以調用單獨驗證過的、影響其他線上玩家的操作。不屬於這兩類的使用者僅限於對話。
- 基礎使用者之間的物品贈送使用物品允許清單。控制器可以給予其他玩家任何有效的命名空間原版或模組物品，但需遵守數量限制和其他權力安全措施。

![Chatbot transcripts](/docs/images/chatbot-transcripts.png)

## 設計與安全性

設定和對話記錄僅限管理員存取。模型永遠不會接收原始 RCON 或任意命令執行。訊息僅暴露與其明確意圖相符的單一固定工具；伺服器代碼會在執行現有服務操作前驗證授權、參數、標誌、數量、冷卻時間和確切的線上玩家名稱。Minecraft 選擇器會被拒絕，跨玩家操作無法鎖定呼叫者，權力以乾運行模式開始，並且每一次嘗試的權力都會被審計。不支援的工具調用模型將僅回退到對話模式。

回覆會限制在 Minecraft 聊天範圍內。已知的原版配方來自內建的版本化配方數據，並以穩定的 2x2/3x3 列呈現；LLM 不被信任來發明配方佈局。未知或模組配方會引導玩家前往 JEI/REI，而不是虛構答案。

## 主要實作檔案

- `src/services/wizard.js`：每個伺服器的設定、與 OpenAI 相容的請求、聊天處理、外展、對話記錄保留和回應限制。
- `src/services/wizardPowers.js`：角色檢查、意圖特定的工具綱要、驗證、執行、冷卻時間和權力審計。
- `src/services/wizardRecipes.js`：確定性的版本化配方查找和網格格式化。配方和物品數據來自內建的 [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) 套件。（此文件的一個早期草稿指向了一個從未提交的 `src/data/recipes/` 資料夾；不存在這樣的資料夾，數據位於該套件中。請參閱「依賴性佔用空間」。）
- `src/analytics/ingest.js`：將解析後的加入、離開和玩家聊天轉發給聊天機器人。
- `src/web/routes/wizard.js`、`public/js/pages/integrations.js` 和 `views/partials/server/integrations.hbs`（透過 `chatbot.hbs`）：管理員 API 和每個伺服器的「設定 → 聊天機器人」標籤頁。
- `src/db/migrations/011_wizard_chat.js`、`013_wizard_invocation_name.js`、`015_wizard_powers.js`、`017_wizard_outreach.js` 和 `019_wizard_power_controllers.js`：持久化綱要。
- `test/wizard.test.js`：授權、工具邊界、保留、外展和聊天行為測試。

內部 `wizard` 路由/模組/表格名稱保留用於升級和 API 相容性；「chatbot」是面向使用者的產品術語。同樣，儲存的 `power_testers_json` 欄位對應於 UI 的「**基礎使用者**」群組。

## 依賴性佔用空間 (`minecraft-data`)

配方說明使用 `minecraft-data` 套件。它在磁碟上佔用空間較大（安裝後約 429 MB），並且由於它是執行時期依賴項而非開發依賴項，因此它會包含在生產映像中。我們特意保留它，以便配方說明可以在離線狀態下為每個 Minecraft 版本正常工作，無需網路呼叫。

給下一個查看此內容的人（人類或 AI）的注意事項，以免尺寸造成驚訝：

- 目前僅使用 Java (`pc`) 數據。「`wizardRecipes.js`」讀取 `minecraftData.versions.pc` 以及每個版本的 `recipes`、`items` 和 `blocks` 表格。它實際觸及的文件加起來大約佔據每個 pc 版本 15 MB。
- 套件中約 330 MB 是 `data/bedrock`，目前沒有任何內容讀取它。我們特意將其保留。如果面板將來增加了對 Bedrock Minecraft 的支援，Bedrock 配方和物品數據已在此處，因此配方功能可以擴展以涵蓋 Bedrock 伺服器，而無需添加新的依賴項。從 `minecraftData.versions.bedrock` 開始，並遵循與 pc 路徑相同的結構。
- 如果在 Bedrock 支援落地之前尺寸必須縮小，此儲存庫中已有相應模式。`src/services/itemRegistry.js` 在需要時從 jsDelivr CDN 獲取 `minecraft-data` 文件，並將它們快取在 `api_cache` 中。採用這種方法，或一個涵蓋幾個常見版本的小型精選 `src/data/recipes/` 子集，都可以大大縮小映像尺寸。

## 本地儲存和手動檢查

所有設定和保留的對話記錄都儲存在面板容器內的面板 SQLite 資料庫 `/data/panel.db` 中。使用標準的 Compose 掛載，主機路徑為 `${DATA_DIR_HOST}/panel.db`（例如 `/opt/msm/data/panel.db`）。相關表格為 `wizard_configs`、`wizard_transcripts` 和 `wizard_outreach`；權力審計是 `events` 表格中的行，類型為 `wizard-power`。可選的 LLM API 金鑰使用面板的靜態金鑰進行 AES-256-GCM 加密，該金鑰位於數據夾中的 `.secret-key`（與 `SESSION_SECRET` 分開）。

在直接編輯 SQLite 之前備份資料庫並停止面板，以確保其 WAL 被安全處理。使用管理員 UI/API 是首選，因為它會應用驗證和加密。複製即時資料庫時，請將 `panel.db`、`panel.db-wal` 和 `panel.db-shm` 文件放在一起。
