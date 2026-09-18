---
title: '架構'
description: 'Minecraft Server Manager 是一個單一處理序、伺服器渲染的 Node.js 應用程式。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← 返回文件索引](/docs/)

Minecraft Server Manager 是一個單一程序、伺服器渲染的 Node.js 應用程式。它使用
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) 映像檔來管理以 Docker 容器執行的
Minecraft 伺服器，透過其 API 與 Docker daemon 通訊（絕不會透過 shell 命令執行 `docker` CLI）。

## 執行階段結構

- **Express + Handlebars** 在伺服器端渲染頁面。沒有 SPA；`public/js/` 中的瀏覽器 JS 是手工編寫的漸進增強。esbuild 步驟 (`pnpm run build:js`) 會將其打包並最小化到 `public/dist/js/`；應用程式在該 bundle 存在時提供該 bundle，否則提供原始來源，因此即使沒有建置也能正常執行開發。
- **`node:sqlite`**（內建於 Node；面板需要 Node ≥ 24）是資料庫——同步、零原生模組、WAL 模式。一個小型版本化遷移運行器會在啟動時套用 `src/db/migrations/*`。準備好的語句會快取在 `src/db/index.js` 中，以 SQL 文字為鍵。
- **`ws`** 承載即時主控台和統計資料串流。兩者都經過**代理**：每個伺服器一個上游 `docker logs --follow`（或 `docker stats`），一次解碼並分發給每個連線的標籤頁，而不是每個檢視者一個上游。主控台代理會為晚加入的標籤頁保留一個小型重播緩衝區，並在某個訂閱者的 socket 落後太多時將其捨棄，而不是延遲共享串流。
- **dockerode** 是應用程式與 Docker 通訊的唯一方式。端點會根據平台自動偵測（Windows 命名管道對 Unix socket）。
- **所有持久狀態都位於一個目錄下**（`$DATA_DIR`，預設為 `./data`）。複製該目錄即可遷移整個面板。

## 分層結構

依賴關係單向流動：

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   解析與驗證輸入，塑造回應
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   領域邏輯（實際功能）
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   基礎設施
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - 每個網域一個路由器（`servers`, `players`, `worlds`, `crashes`, `blueprints`, `files`, …），掛載在 `web/app.js` 中。路由器使用 zod 進行驗證，呼叫服務，並返回 JSON 或渲染視圖。商業邏輯不屬於這裡。兩個路由器掛載在**公開區域**，在 `requireAuth` 之前：`routes/status.js`（可選的每個伺服器 HTML 狀態頁面）和 `routes/apiV1.js`（`/api/v1`，一個唯讀 JSON API，透過管理員鑄造的 Bearer token 從 `services/apiTokens.js` 進行驗證，預設關閉，除非在設定中啟用；請參閱 `docs/public-api.md`）。
- **`services/`** - 應用程式的核心。每個服務負責一個網域，並可能依賴於基礎設施和其他服務。
- **`docker/`** - dockerode 包裝器：`connect`（端點偵測 + daemon 健康狀態）、`containers`（使用綁定掛載、記憶體/CPU 限制和標籤建立/啟動/停止/重新建立）、`logs`、`stats`、`images` 以及一個將 Docker 事件轉換為歷史記錄 + 當機偵測的 `watcher`。
- **`db/`** - SQLite 包裝器和遷移運行器。
- **`storage/`** - `./data` 引導程式、**路徑防護**（`safeJoin`，檔案安全骨幹）以及背景大小索引器 + 配額強制執行。

跨領域：

- **`config/`** - 環境設定加上**欄位目錄**：伺服器設定的唯一真相來源。每個 itzg 環境變數都已編目（標籤、說明、類型、單位、預設值、驗證、區段、危險標誌）。精靈、設定表單和 zod 驗證都源自於此，因此公開一個新設定只需變更資料，無需新的 UI 管道。
- **`events/`** - `recordEvent()` 是歷史記錄日誌的唯一入口點；生命週期事件也會將容器日誌摘錄擷取到 `data/logs/<id>/events/`。
- **`ws/`** - 經過驗證的主控台 + 統計資料 WebSockets（在升級時驗證 session cookie，檢查 `Origin` 以阻止跨站點劫持），每個伺服器代理（請參閱「執行階段結構」）。
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` 返回每個模組的
  [Pino](https://getpino.io) loggers；級別來自 `LOG_LEVEL`，`makeFailureThrottle()` 維持一個持續失敗的背景迴圈，最多記錄一行加上一行「已恢復」。
  `src/utils/logSanitize.js` 會從結構化中繼資料中 redaction 憑證形狀的鍵和 webhook token；`src/config/logLevel.js` 是共享的級別允許清單（單獨存放以避免與 `config` 產生 require 循環）。`src/instrument.js` 是一個休眠的 Sentry 介面，在 `src/server.js` 中首先載入。`src/web/middleware/requestLog.js` 為每個請求寫入一行存取日誌（跳過 `/healthz` 和靜態資產）。ESLint 在 `src/**` 下強制執行 `no-console`，豁免 `preflight.js`、`instrument.js` 和 `config/index.js`（它們在 logger 存在之前執行）。
- **速率限制** - `src/web/middleware/rateLimit.js` 將 `express-rate-limit` 放在 `/api`（`RATE_LIMIT_API_PER_MIN`，預設 1200）和登入 / 2FA / 設定 POST（`RATE_LIMIT_AUTH_PER_15MIN`，預設 100）前面；`0` 會停用限制器。它以 `req.ip` 為鍵，因此 `TRUST_PROXY` 在代理後面很重要。`/api/v1` 有自己的每個 token 限制器
  （`RATE_LIMIT_PUBLIC_API_PER_MIN`，預設 120），以 Bearer token 的雜湊值加上 IP 作為備用。`src/web/middleware/auth.js` 中一個獨立的每個帳戶軟計數器處理登入鎖定（每個 IP 和全域帳戶，遞減）。

## 關鍵網域行為

- **Modpacks 始終被釘選。** 映像檔會在每次重新啟動時自動升級未釘選的 packs，因此面板會在安裝時將「latest」解析為具體的版本 ID 並將其釘選。升級是一個明確協調的流程（`updates/`）：預覽 → 更新前備份 → 優雅停止 → 重新釘選 → 重新建立 → 健康監控 → 一鍵回滾。
- **自訂 Mod 疊加層**由面板管理：使用者新增的 Mod 會進入去重複的函式庫，並硬連結到伺服器中，以便在 pack 更新後仍然存在。停用是類別感知。
- **連接埠**從基本配置中分配（遊戲從 `PORT_GAME_START` 開始，RCON = 遊戲 + `PORT_RCON_OFFSET`，Bedrock 從 `PORT_BEDROCK_START` 開始），探測可用性，並在資料庫中保留。
- **磁碟配額**由面板強制執行，因為 Docker 無法限制綁定掛載的使用：索引器快取每個目錄的大小，磁碟增長操作會基於此進行門控。
- **秘密**（RCON 密碼、API 金鑰、TOTP 秘密、Discord webhook URL）在靜態時使用 AES-256-GCM 加密，使用 `$DATA_DIR/.secret-key` 處的專用隨機金鑰（模式 `0600`，自動生成）。它獨立於 `SESSION_SECRET`；一個從 `SESSION_SECRET` 派生的金鑰作為僅解密的回退，用於在專用金鑰存在之前寫入的值，並且 `src/services/secretsMigration.js` 在啟動時將這些值重新加密到專用金鑰下。
  存在的 `.secret-key` 但無法解析是一個嚴重的啟動錯誤（它絕不會被靜默地重新生成）。藍圖在匯出時會移除所有秘密。

## 資料與線路格式

- **`data/panel.db`** - SQLite 資料庫。每天透過 `VACUUM INTO` 快照到
  `data/backups/_panel/`（保留最新的 14 個）；啟動時執行 `PRAGMA integrity_check`。
- **`data/.session-secret`** - 自動生成的 cookie 簽名秘密，在第一次執行時如果 `SESSION_SECRET` 未設定則建立。刪除它會輪換秘密（這會使 session 失效）。
- **`data/.secret-key`** - 專用的 32 位元組靜態加密金鑰（模式 `0600`），在第一次執行時自動建立。獨立於 `SESSION_SECRET`；刪除它會使所有儲存的憑證無法解密，因此它應與您的備份一起存放。
- **藍圖 (`.mcserver.zip`)** - 一個 zip 檔案，包含 `manifest.json`，描述設定、資源、釘選的 pack 參考、疊加層資訊清單（來源 URL + sha256）、選擇的設定檔，以及可選的世界。匯入會重新下載並雜湊驗證每個 Mod，並分配新的連接埠。
- **由面板建立的 Docker 容器**會被命名和標記，以便 watcher 可以找到它們；面板擁有其完整的生命週期。

## 啟動順序

1. 在任何其他程式碼之前 `require('./instrument')`（Sentry 介面），然後 `require('./preflight')`
   以在不支援的 Node 版本上清晰失敗。
2. 載入設定；確保/生成 `.session-secret` **和** `.secret-key`。
3. `ensureDataRoot()` - 建立 `./data` 結構，清除 `tmp/`。
4. 執行 DB 遷移，然後 `PRAGMA integrity_check`（日誌記錄詳細，失敗時指向 `data/backups/_panel`）。
5. 將舊的 `SESSION_SECRET` 鍵加密的秘密重新加密到 `.secret-key` 下（`secretsMigration`）。
6. 填充啟動藍圖（已保護）。
7. 啟動 HTTP + WS 伺服器。在暴露的綁定上，顯示首次執行的 `/setup` PIN。
8. 安裝啟動後運行時防護（捕獲未處理的故障；`MSM_EXIT_ON_FATAL=1` 會使受監督的部署硬退出）。
9. 啟動背景服務：WS 代理、儲存索引器、當機 + 庫存監視器、排程器、Discord 事件橋接器以及**每日維護計時器**（修剪舊的分析行 + 快照 `panel.db`）。
10. **在背景中**初始化 Docker。即使 daemon 離線，UI 也完全可用；當 daemon 可達時，Docker 功能就會啟用。連接後，`refreshStatuses({ boot })` 會協調快取的狀態，為在面板重新啟動前已啟動但不會被重新啟動的伺服器發出一次性 `offline-after-restart` 事件，並且啟動迴圈會啟動 `auto_start` 伺服器並恢復在停機期間發現當機的 `auto_restart` 伺服器（尊重當機迴圈回退）。

> instrument-before-preflight 的順序是一個刻意的權衡：它允許未來的 Sentry 接線首先修補運行時，但代價是在非常舊的 Node 版本上顯示一個稍微不友善的訊息。

## 建置管線

`pnpm run build` = `build:css`（Tailwind → `public/css/app.css`）+ `build:js`（esbuild →
`public/dist/js/`，具有程式碼分割的 ESM）。`postinstall` 僅執行**CSS**。`public/css/app.css`
和 `public/dist/` 是 gitignored 的建置產物；Dockerfile 的建置階段會執行完整的
`pnpm run build` 並將 `public/` 複製到運行時映像檔中。靜態資產的快取策略為：指紋化的檔案為
`immutable`/長快取，CSS/JS 為短快取，HTML 和 `/api` 為 `no-cache`。
