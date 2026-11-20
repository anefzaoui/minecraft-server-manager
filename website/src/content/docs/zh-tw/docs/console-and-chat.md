---
title: '主控台與聊天指令'
description: '主控台分頁會即時串流伺服器日誌，並提供一個指令方塊，讓您輸入任何伺服器指令。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← 返回文件索引](/docs/)

## 即時主控台

**主控台 (Console)** 標籤可即時串流伺服器日誌，並提供一個指令方塊，用於傳送任何伺服器指令。無需 `docker exec`，也無需 SSH。輸出會內嵌顯示，包含顏色等所有格式。傳送指令需要該伺服器的 Console 權限；若無此權限，您仍可監看日誌。

在日誌上方，您可以依文字（或 `/正規表達式/`）和層級（INFO、WARN、ERROR）篩選日誌行，而 **下載 (Download)** 則提供最近的輸出、完整的 `latest.log`，或將所有日誌檔打包成 zip 檔。

![主控台](/docs/images/server-console.png)

主控台也是面板讀取伺服器狀態的地方：它會監看日誌以分類啟動階段（「載入模組中」、「生成世界中」、「啟動完成」），並呼叫 `list` 來追蹤誰在線上，因此儀表板和伺服器卡片將始終反映實際情況。

這種輪詢會在每個週期開啟一個短暫的 RCON 連線，伺服器日誌會顯示為一對 `Thread RCON Client … started` / `shutting down`，大約每 20 秒一次，以及（在核心或外掛程式會回顯的伺服器上）每次唯讀輪詢的 `Rcon issued server command: …` 行（用於玩家計數的 `list`，以及在 World Controls 開啟時讀取的 `time query …` 和 `gamerule <name>`）。日誌上方的 **隱藏主控台雜訊 (Hide Console Noise)** 開關會過濾掉這些行（以及 RCON 監聽器啟動行）。此選項預設開啟並會記住每個瀏覽器的設定；關閉它即可查看原始串流。

從面板傳送的指令可以根據每個伺服器的標籤（**宣告為… (Announce as…)** 方塊）在遊戲中顯示，讓玩家知道是操作員而非神秘主控台執行的操作。

## 聊天

**主控台 → 聊天 (Console → Chat)** 可在伺服器運行時將訊息傳送至遊戲中：**樣式化 (Styled)** 訊息會套用顏色和格式，可發送給所有人或單一線上玩家；**純文字 (Plain)** 則會向所有人廣播簡單的 `[Server]` 訊息。

![主控台 → 聊天](/docs/screenshots/04-chat.png)

## 聊天指令

聊天指令（**主控台 → 指令 (Console → Commands)**）允許玩家透過在遊戲聊天中輸入前置指令來觸發面板動作，例如輸入 `!spawn` 進行隨機傳送。偵測是基於日誌的，執行透過伺服器進行，因此**無需安裝任何模組**。

![聊天指令](/docs/images/chat-commands.png)

每個指令包含：

- 一個**觸發器 (trigger)**（例如 `spawn`），在伺服器的**前置字 (prefix)**（預設為 `!`，一或兩個字元，絕不為 `/`）之後輸入。
- 一個**動作 (action)**：隨機傳送、傳送到結構、傳送到生物群系，或執行原始主控台指令。
- 一個**權限等級 (permission level)**：所有人、白名單玩家，或僅限操作員。
- 每位玩家的**冷卻時間 (cooldown)**（預設 30 秒），以及可自訂的待處理/成功/失敗訊息，包含 `{distance}` 等佔位符。

### 安全注意事項

可能損壞伺服器的指令（`stop`、`op`、`ban`、`whitelist` 等）僅允許用於**僅限操作員**的觸發器。即使這些指令嵌套在 `execute … run …` 鏈中，面板也會進行檢查，因此低權限的觸發器無法偷偷執行危險指令。僅僅提及這些詞彙的普通聊天文字（例如 `say` 訊息）則不受影響。
