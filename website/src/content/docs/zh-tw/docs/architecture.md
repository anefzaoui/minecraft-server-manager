---
title: '架構'
description: 'Minecraft Server Manager 是一個單一處理序、伺服器渲染的 Node.js 應用程式。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← 返回文件索引](/docs/)

Minecraft Server Manager 是一個單進程、伺服器渲染的 Node.js 應用程式。它使用
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) 映像檔來管理以 Docker 容器形式執行的
Minecraft 伺服器，透過其 API 與 Docker daemon 通訊（絕不透過 `docker` CLI 執行命令）。

## 執行階段結構

- **Express + Handlebars** 在伺服器端渲染頁面。沒有 SPA；`public/js/` 中的瀏覽器 JS 是手寫的漸進增強。esbuild 步驟 (`pnpm run build:js`) 會將其打包並最小化到 `public/dist/js/`；應用程式在該 bundle 存在時提供該 bundle，否則提供原始來源，因此即使沒有建置也能正常執行開發。
- **`node:sqlite`**（內建於 Node；面板需要 Node ≥ 24）是資料庫——同步、零原生模組、WAL 模式。一個小型版本化遷移執行器會在啟動時套用 `src/db/migrations/*`。準備好的語句會快取在 `src/db/index.js` 中，以 SQL 文字為鍵。
- **`ws`** 負責即時主控台和統計資料串流。兩者都經過**代理**：每個伺服器一個上游 `docker logs --follow`（或 `docker stats`），一次解碼並分發給每個連線的標籤，而不是每個檢視者一個上游。主控台代理會為晚加入的標籤保留一個小型重播緩衝區，並在某個訂閱者的 socket 落後太多時將其捨棄，而不是延遲共用串流。
- **dockerode** 是應用程式與 Docker 互動的唯一方式。端點會根據平台自動偵測（Windows 命名管道與 unix socket）。
- **所有持久狀態都位於一個目錄下**（`$DATA_DIR`，預設為 `./data`）。複製該目錄即可遷移整個面板。

## 層級結構

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

- **`web/routes/`** - 每個領域一個路由器（`players`, `worlds`, `crashes`, `blueprints`, `files`, …）。
  `web/app.js` 掛載頂層路由器（`api.js`，包含核心伺服器路由並掛載每個伺服器領域路由器的 session JSON API；`index.js`，頁面；`auth`, `account`, `tasks`, …）。路由器使用 zod 進行驗證，呼叫服務，並返回 JSON 或渲染視圖。商業邏輯不屬於這裡。兩個路由器掛載在**公開區域**，在 `requireAuth` 之前：`routes/status.js`（可選的每個伺服器 HTML 狀態頁面）和 `routes/apiV1.js`（`/api/v1`，一個由管理員鑄造的 Bearer token 透過 `services/apiTokens.js` 驗證的唯讀 JSON API，預設關閉，除非在設定中啟用；請參閱 `docs/public-api.md`）。
- **`services/`** - 應用程式的核心。每個服務負責一個領域，並可能依賴基礎設施和其他服務。
- **`docker/`** - dockerode 包裝器：`connect`（端點偵測 + daemon 健康狀態）、`containers`（建立/啟動/停止/重新建立，包含綁定掛載、記憶體/CPU 限制和標籤）、`logs`、`stats`、`images`、`networks`（主機網路發現）、`hostPath`（將綁定路徑重新根目錄到 `DATA_DIR_HOST` 下），以及一個將 Docker 事件轉換為歷史記錄 + 當機偵測的 `watcher`。
- **`db/`** - SQLite 包裝器和遷移執行器。
- **`storage/`** - `./data` 的引導程式，**路徑防護**（`safeJoin`，檔案安全骨幹），以及背景大小索引器 + 配額強制執行。

跨領域：

- **`config/`** - 環境設定加上**欄位目錄**：伺服器設定的唯一真相來源。每個 itzg 環境變數都已編目（標籤、說明、類型、單位、預設值、驗證、區段、危險標誌）。精靈、設定表單和 zod 驗證都源自於此，因此公開一個新設定只需變更資料，無需新的 UI 管道。
- **`events/`** - `recordEvent()` 是歷史記錄日誌的唯一進入點；生命週期事件也會將容器日誌片段擷取到 `data/logs/<id>/events/`。
- **`ws/`** - 已驗證的主控台 + 統計資料 WebSockets（升級時驗證 session cookie，檢查 `Origin` 以阻止跨站點劫持），每個伺服器代理（參見「執行階段結構」）。
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` 返回每個模組的
  [Pino](https://getpino.io) 日誌記錄器；層級來自 `LOG_LEVEL`，`makeFailureThrottle()` 將持續失敗的背景迴圈限制為一行日誌加上一條「已恢復」訊息。
  `src/utils/logSanitize.js` 會從結構化中繼資料中 redaction 憑證格式的金鑰和 webhook token；`src/config/logLevel.js` 是共用的層級允許清單（單獨存放以避免與 `config` 產生 require 迴圈）。`src/instrument.js` 是一個休眠的 Sentry 介面，在 `src/server.js` 中最先載入。`src/web/middleware/requestLog.js` 為每個請求寫入一行存取日誌（跳過 `/healthz` 和靜態資產）。ESLint 在 `src/**` 下強制執行 `no-console`，豁免 `preflight.js`, `instrument.js`, 和 `config/index.js`（它們在日誌記錄器存在之前執行）。
- **速率限制** - `src/web/middleware/rateLimit.js` 將 `express-rate-limit` 置於 `/api`（`RATE_LIMIT_API_PER_MIN`，預設 1200）和登入 / 2FA / 設定 POST（`RATE_LIMIT_AUTH_PER_15MIN`，預設 100）之前；`0` 會停用限制器。它以 `req.ip` 為鍵，因此 `TRUST_PROXY` 在代理後面很重要。`/api/v1` 有自己的限制器：一個每個用戶端 IP 的上限（是每個 token 配額的五倍），在 token 驗證之前執行，然後是一個每個 token 的配額（`RATE_LIMIT_PUBLIC_API_PER_MIN`，預設 120），以驗證 token 的 ID 為鍵。
  `src/web/middleware/auth.js` 中一個獨立的每個帳戶軟計數器處理登入鎖定（每個 IP 和全域帳戶，遞減）。
- **授權**：兩層。全域角色（`requireAuth` → `requireRole` / `requireWrite` 在
  `src/web/middleware/auth.js` 中）控制面板範圍的操作，並且是每個伺服器的預設。每個伺服器的權限（`src/services/permissions.js`，九個能力，儲存在 `user_server_permissions` 中每個 `(user, server)` 的 JSON 列表中）細化了該預設，用於一個伺服器；每個
  `/api/servers/:id` 路由、子路由掛載、頁面、WebSocket 和全伺服器列表都經過
  `src/web/middleware/serverAccess.js`（`serverScope`，掛載在 API 和頁面路由器的 `/servers/:id` 前綴上，隱藏沒有 `view` 權限的伺服器並返回 404；`requireCap(cap)` 指定路由所需的權限）。
  在主體中命名其伺服器的寫入操作（排程、世界提取和安裝、藍圖匯出）僅對檢視者開放 `requireWrite`，並且每個此類路由本身都會檢查權限。`test/permissions-routes.test.js` 遍歷即時路由堆疊，如果伺服器範圍的寫入路由、掛載或頁面沒有閘道，則會失敗。

## 主要領域行為

- **Modpack 始終固定版本。** 映像檔會在每次重新啟動時自動升級未固定的套件，因此面板會在安裝時將「latest」解析為具體的版本 ID 並固定。升級是一個明確協調的流程（`updates/`）：預覽 → 更新前備份 → 優雅停止 → 重新固定 → 重新建立 → 健康監控 → 一鍵回滾。
- **自訂 Mod 疊加層由面板管理**：使用者新增的 Mod 會進入去重圖書館，並硬連結到伺服器，因此它們可以在套件更新後保留。停用是按類別進行的。由於圖書館保留了它下載的每個建置，因此更新會記錄它取代的建置（`server_content.previous_*`），並且可以僅從本地檔案還原。停用套件 Mod 會寫入套件的排除環境變數；`packs.applyPack` 會在相同套件的版本變更時攜帶該變數以及其餘的套件調整（`PACK_TUNING_KEYS`），並在套件變更時將其捨棄。
- **Minecraft 版本升級必須「贏得」**。`services/compat.js` 會掃描伺服器的 Mod——從面板安裝的列解析，然後是 CurseForge 套件清單，然後透過內容雜湊與 Modrinth/CurseForge 進行雜湊比對——並根據 CurseForge 的 `latestFilesIndexes`（每次請求 200 個專案）和 Modrinth 的每個專案版本列表（每個專案一個請求，這會將載入器和版本配對起來）為每個專案建置一個（載入器，Minecraft 版本）支援矩陣。更新檢查器僅提供每個 Mod 支持的最新版本，並且在無法確定答案時根本不提供任何內容：沒有掃描、掃描不同版本或載入器、掃描未完成，或是一個註冊表中無法識別的 jar。掃描僅為手動，其進度和部分結果位於 `version_compat` 中（不在記憶體中的 `services/tasks.js`），因此重新整理或面板重新啟動會恢復而不是掛起在旋轉圖示上；`reconcileScans()` 會在下次啟動時將因關閉而孤立的掃描標記為中斷。
- **Mod 載入器版本就像其他所有東西一樣被固定**。`services/loaderPin.js` 會讀取映像檔自身安裝清單中的已安裝建置（`.forge-manifest.json` 和類似檔案），並寫入固定版本：純伺服器上的載入器 itzg 變數（`FORGE_VERSION`, …），或 Forge 或 Fabric CurseForge 套件上的 `CF_MOD_LOADER_VERSION`，這會覆蓋套件聲明的版本。映像檔的 CurseForge 安裝程式會忽略 NeoForge 的此覆蓋，而 Modrinth 和 FTB 套件則沒有，因此它們的載入器會跟隨套件。`packs.applyPack` 會在套件更新或回滾時刪除所有 `CF_` 變數，這會與其餘部分一起捨棄覆蓋。類型化的建置會首先與註冊表的完整列表進行檢查（`services/loaderVersions.js`；Forge 的來自其 maven 中繼資料，它會跳過數字；錯過的會再檢查一次與註冊表本身），然後變更會備份 → 固定（在備份後處於的環境變數之上）→ 重建。
- **埠**是從基本方案分配的（遊戲從 `PORT_GAME_START` 開始，RCON = 遊戲 + `PORT_RCON_OFFSET`，Bedrock 從 `PORT_BEDROCK_START` 開始），探測可用性，並在資料庫中保留。「已佔用」是每個伺服器聲明的聯合（即時埠，加上待處理的一對），任何 Docker 容器發布的每個主機埠（`containers.publishedHostPorts`：執行中容器的即時綁定加上每個已停止容器的已設定綁定，因為面板自身容器內的作業系統綁定探測只能看到該容器的網路命名空間），以及作業系統探測。Docker 部分會快取 3 秒並有界限：一個在 2.5 秒內無回應的列表只會捨棄 Docker 部分，而緩慢的檢查只會花費該容器的埠。伺服器建立和 `servers.changeGamePort` 透過一個僅涵蓋選擇和其聲明的序列化鏈（建立的列寫入，埠變更的記憶體保留）來選擇埠；BlueMap 的埠選擇器和額外埠覆蓋不在其中，也不會諮詢 Docker。現有伺服器的埠變更（`servers.changeGamePort`，在伺服器操作鎖下）會一次性套用，因為 Docker 在容器建立時修復埠綁定：新的配對（RCON 始終是遊戲 + `PORT_RCON_OFFSET`）會在記憶體中檢查並保留（`ports.reserve`，舊的和新的配對，由其他所有選擇器遵守），並在埠鎖下。它會被拒絕（409 `PENDING_CHANGES`），因為其他設定正在等待重建，所以它只會重建一個已經執行過的容器，使用新的埠；而執行的伺服器僅在請求包含 `restart: true` 時才會變更（否則為 409 `NEEDS_CONFIRM`）。在觸碰任何內容之前，會拉取映像檔並檢查自訂容器名稱。執行的伺服器會被停止；然後新的配對會以 `pending_recreate = 1` 寫入（這樣從那裡開始的面板當機就會留下一個誠實的「重建待處理」），容器會被移除，使用新的配對重建並啟動。如果停止後的任何步驟失敗，`putBackOnOldPort` 會將舊配對寫回，使用它重建（如果它正在執行則重新啟動）並記錄失敗的步驟；歷史記錄和警報會說明即使那樣也失敗了，這會使伺服器停止直到有人啟動它。`settings` 能力就足夠了，包括正在執行的伺服器。非管理員只能從 `PORT_GAME_START` 開始選擇。
  （遷移 029 中的 `port_*_pending` 列屬於早期未發布的設計，未使用；031 會清除它們。）鎖定衝突會回應 409 並帶有 `code: 'BUSY'`，這會被下面的重試呼叫者檢查而不是文字。當機自動重啟
  （`watcher.restartAfterCrash`）和排程的備份或啟動（`scheduler.runTaskWithRetry`）發現伺服器正忙於其他操作時，會每 20 秒 / 60 秒重試最多 30 分鐘，而套件更新或回滾會以相同方式重試其鎖定的步驟（`opLock.retryWhileBusy`）；當機重啟或等待中的排程啟動一旦有人停止、殺死或啟動了伺服器（自 `events.lifecycleActionSince` 起）就會放棄，並且當機重啟也會在自動重啟關閉或伺服器消失時放棄。排程的重啟、停止和命令不會重試，而一個仍在等待上次執行的排程會跳過其下一次觸發。
- **磁碟配額**由面板強制執行，因為 Docker 無法限制綁定掛載的使用：索引器會快取每個目錄的大小，並且磁碟增長操作會受到這些的限制。
- **密鑰**（RCON 密碼、API 金鑰、TOTP 密鑰、Discord webhook URL）會在靜態時使用 AES-256-GCM 加密，使用 `$DATA_DIR/.secret-key` 下的專用隨機金鑰（模式 `0600`，自動生成）。它獨立於 `SESSION_SECRET`；一個 `SESSION_SECRET` 派生的金鑰會作為僅解密的備用，用於在專用金鑰存在之前寫入的值，並且 `src/services/secretsMigration.js` 會在啟動時一次性將這些重新加密到專用金鑰下。
  一個存在的 `.secret-key` 但無法解析會導致嚴重的啟動錯誤（它永遠不會被靜默地重新生成）。藍圖在匯出時會捨棄所有密鑰。
- **`server.properties` 由面板擁有但被環境變數覆蓋。** itzg 映像檔會在每次啟動時重新斷言每個由環境變數支援的屬性（`OVERRIDE_SERVER_PROPERTIES` 預設為 true），因此面板直接編輯的值——例如世界控制的 PvP/難度、白名單開關、檔案編輯器——會在下次啟動時被靜默地還原，除非移除匹配的環境變數並重新建立容器。每個直接屬性寫入都會透過 `src/services/servers.js` 中的 `writeServerProperties()`（整個檔案）或 `setServerProperty()`（單個鍵）進行，它會原子地重寫檔案，取消設定每個變更金鑰後面的環境變數（透過目錄欄位上的 `prop:` 屬性，在測試中與映像檔自身的屬性定義進行比對），並標記 `pending_recreate`。難度會寫入檔案並透過 RCON 發送，因為專用伺服器會在每次啟動時重新套用 `difficulty` 屬性。Minecraft 本身會在每次啟動時從其啟動時的值重新儲存 server.properties，這會在 `whitelist on/off` 時發生，這會撤銷在伺服器執行時進行的編輯，因此正在執行的白名單開關會先快照檔案並將其寫回，只變更 `white-list`。環境
  變數在建立時仍然完全可配置（精靈會渲染它們並一次性套用）；它們只會在面板第一次編輯底層屬性時取消固定。MOTD 也是相同的合約：直接編輯 `motd` 檔案會取消設定它，因此最後一次寫入獲勝。

## 資料與線路格式

- **`data/panel.db`** - SQLite 資料庫。每天透過 `VACUUM INTO` 快照到
  `data/backups/_panel/`（保留最新的 14 個）；啟動時執行 `PRAGMA integrity_check`。
- **`data/.session-secret`** - 自動生成的 cookie 簽名密鑰，如果 `SESSION_SECRET` 未設定，則在首次執行時建立。刪除它會輪換密鑰（這會使 session 失效）。
- **`data/.secret-key`** - 專用的 32 位元組靜態加密金鑰（模式 `0600`），首次執行時自動建立。獨立於 `SESSION_SECRET`；刪除它會使所有儲存的憑證無法解密，因此它屬於您的備份。
- **藍圖 (`.mcserver.zip`)** - 一個 zip 檔案，包含 `manifest.json`（描述設定、資源、固定的套件參考、疊加層清單（來源 URL + sha256）、選擇的設定檔），以及可選的世界。匯入會重新下載並雜湊驗證每個 Mod，並分配新的埠。
- **由面板建立的 Docker 容器**會被命名和標記，以便 watcher 可以找到它們；面板擁有它們的完整生命週期。

## 啟動順序

1. `require('./instrument')`（Sentry 介面）在所有其他之前，然後是 `require('./preflight')`，以便在不支援的 Node 版本上清晰地失敗。
2. 載入設定；確保/生成 `.session-secret` **和** `.secret-key`。
3. `ensureDataRoot()` - 建立 `./data` 結構，清除 `tmp/`。
4. 執行 DB 遷移，然後是 `PRAGMA integrity_check`（日誌記錄詳細，失敗時指向 `data/backups/_panel`）。
5. 將任何舊的 `SESSION_SECRET` 鍵加密的密鑰重新加密到 `.secret-key` 下（`secretsMigration`）。
6. 從環境一次性匯入 API 金鑰（`apiKeys.importFromEnvOnce()`），固定任何仍帶有未固定 Modpack 選擇器的伺服器（`packPins.pinUnpinnedServers()`），將先前進程留下的版本相容性掃描標記為中斷
   （`compat.reconcileScans()`），然後種子啟動藍圖（受保護）。
7. 啟動 HTTP + WS 伺服器。在暴露的綁定上，列印首次執行的 `/setup` PIN。
8. 安裝啟動後運行時防護（捕獲未處理的故障；`MSM_EXIT_ON_FATAL=1` 使其在受監督的部署中硬退出）。
9. 啟動背景服務：WS 代理、儲存索引器、當機 + 庫存監視器、排程器、Discord 事件橋、聊天機器人外展監視器，以及**每日維護計時器**（修剪舊的分析行、聊天機器人記錄、事件歷史記錄（365 天）和 API 快取行，然後快照
   `panel.db`）。
10. **在背景中**初始化 Docker。即使 daemon 關閉，UI 也完全可用；當 daemon 可達時，Docker 功能會亮起。連接後，`refreshStatuses({ boot })` 會協調快取的狀態，為在面板重新啟動前運行但不會被恢復的伺服器發出一次性的 `offline-after-restart` 事件，並且啟動迴圈會啟動
    `auto_start` 伺服器，並恢復在停機期間發現當機的 `auto_restart` 伺服器（尊重當機迴圈退避）。

> instrument-before-preflight 的順序是一個刻意的權衡：它允許未來的 Sentry 接線首先修補運行時，代價是在非常舊的 Node 上訊息稍微不那麼友好。

## 建置管線

`pnpm run build` = `build:css`（Tailwind → `public/css/app.css`）+ `build:js`（esbuild →
`public/dist/js/`，帶有程式碼分割的 ESM）。`postinstall` 僅執行**CSS**。`public/css/app.css`
和 `public/dist/` 是 gitignore 的建置產物；Dockerfile 的建置階段會執行完整的
`pnpm run build` 並將 `public/` 複製到運行時映像檔。靜態資產的服務方式是：指紋檔案為
`immutable`/長快取，CSS/JS 為短快取，HTML 和 `/api` 為 `no-cache`。
