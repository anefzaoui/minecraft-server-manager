---
title: '架构'
description: 'Minecraft Server Manager 是一个单进程、服务器渲染的 Node.js 应用程序。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← 返回文档索引](/docs/)

Minecraft Server Manager 是一个单进程、服务器端渲染的 Node.js 应用程序。它使用
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) 镜像管理作为 Docker 容器运行的 Minecraft 服务器，通过其 API 与 Docker 守护进程通信（绝不通过 shell 调用 `docker` CLI）。

## 运行时结构

- **Express + Handlebars** 在服务器端渲染页面。没有 SPA；`public/js/` 中的浏览器 JS 是手工编写的渐进增强。esbuild 步骤 (`pnpm run build:js`) 将其打包并最小化到 `public/dist/js/`；应用程序在存在该包时提供该包，否则提供原始源，因此在没有构建的情况下运行开发也能正常工作。
- **`node:sqlite`**（内置于 Node 中；面板需要 Node ≥ 24）是数据库——同步、零原生模块、WAL 模式。一个小的版本化迁移运行器在启动时应用 `src/db/migrations/*`。准备好的语句缓存在 `src/db/index.js` 中，以 SQL 文本为键。
- **`ws`** 承载实时控制台和统计信息流。两者都是**代理的**：每个服务器一个上游 `docker logs --follow`（或 `docker stats`），一次解复用并分发给每个连接的标签页，而不是每个查看器一个上游。控制台代理程序保留一个小的重放缓冲区供晚加入的标签页使用，并丢弃套接字落后太多的订阅者，而不是使共享流停滞。
- **dockerode** 是应用程序与 Docker 通信的唯一方式。端点根据平台自动检测（Windows 命名管道 vs. Unix 套接字）。
- **所有持久状态都位于一个目录下**（`$DATA_DIR`，默认为 `./data`）。复制该目录即可迁移整个面板。

## 分层

依赖关系单向流动：

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ 中间件) │   解析和验证输入，塑造响应
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   领域逻辑（实际功能）
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   基础设施
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - 每个域一个路由器（`players`、`worlds`、`crashes`、`blueprints`、`files` 等）。
  `web/app.js` 挂载顶级路由器（`api.js`，会话 JSON API，也包含核心服务器路由并挂载每个服务器的域路由器；`index.js`，页面；`auth`、`account`、`tasks` 等）。路由器使用 zod 进行验证，调用服务，并返回 JSON
  或渲染视图。业务逻辑不属于这里。在 `requireAuth` 之前，**公共区域**挂载了两个路由器：`routes/status.js`（可选的每个服务器 HTML 状态页面）和 `routes/apiV1.js`（`/api/v1`，一个只读 JSON API，由管理员生成的 Bearer 令牌通过 `services/apiTokens.js` 认证，默认禁用；参见 `docs/public-api.md`）。
- **`services/`** - 应用程序的核心。每个服务负责一个域，并可能依赖于基础设施和其他服务。
- **`docker/`** - dockerode 包装器：`connect`（端点检测 + 守护进程健康状况）、`containers`（创建/启动/停止/重新创建，带绑定挂载、内存/CPU 限制和标签）、`logs`、`stats`、`images`、`networks`（主机网络发现）、`hostPath`（将绑定路径重新根目录到 `DATA_DIR_HOST` 下），以及一个将 Docker 事件转换为历史记录 + 崩溃检测的 `watcher`。
- **`db/`** - SQLite 包装器和迁移运行器。
- **`storage/`** - `./data` 的引导程序，**路径保护程序**（`safeJoin`，文件安全骨干），以及后台大小索引器 + 配额强制执行。

跨领域：

- **`config/`** - 环境配置加上**字段目录**：服务器设置的唯一真相来源。每个 itzg 环境变量都已编目（标签、帮助、类型、单位、默认值、验证、部分、危险标志）。向导、设置表单和 zod 验证都源自它，因此公开新设置是一项数据更改，而不是新的 UI 管道。
- **`events/`** - `recordEvent()` 是历史日志的唯一入口点；生命周期事件还将容器日志摘录捕获到 `data/logs/<id>/events/`。
- **`ws/`** - 经过身份验证的控制台 + 统计信息 WebSockets（在升级时验证会话 cookie，检查 `Origin` 以阻止跨站劫持），每个服务器代理（参见“运行时结构”）。
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` 返回每个模块的
  [Pino](https://getpino.io) 日志记录器；级别来自 `LOG_LEVEL`，`makeFailureThrottle()` 将持续失败的后台循环限制为一条日志行加上一条“已恢复”行。
  `src/utils/logSanitize.js` 从结构化元数据中删除凭据格式的键和 Webhook 令牌；`src/config/logLevel.js` 是共享的级别允许列表（分开存放以避免与 `config` 产生循环依赖）。`src/instrument.js` 是一个休眠的 Sentry 接口，在 `src/server.js` 中首先加载。`src/web/middleware/requestLog.js` 为每个请求写入一条访问日志行（跳过 `/healthz` 和静态资源）。ESLint 在 `src/**` 下强制执行 `no-console`，但豁免了 `preflight.js`、`instrument.js` 和 `config/index.js`（它们在日志记录器存在之前运行）。
- **速率限制** - `src/web/middleware/rateLimit.js` 将 `express-rate-limit` 放在 `/api`（`RATE_LIMIT_API_PER_MIN`，默认为 1200）和登录 / 2FA / 设置 POST 请求（`RATE_LIMIT_AUTH_PER_15MIN`，默认为 100）前面；`0` 禁用限制器。它以 `req.ip` 为键，因此 `TRUST_PROXY` 在代理后面很重要。`/api/v1` 有自己的限制器：一个每个客户端 IP 的上限（是每个令牌预算的五倍），在令牌验证之前运行，然后是一个每个令牌的预算（`RATE_LIMIT_PUBLIC_API_PER_MIN`，默认为 120），以经过验证的令牌 ID 为键。`src/web/middleware/auth.js` 中一个单独的每个账户软计数器处理登录锁定（每个 IP 和全局账户，衰减）。
- **授权**：两层。全局角色（`requireAuth` → `requireRole` / `requireWrite` 在 `src/web/middleware/auth.js` 中）控制面板范围的操作，并且是每个服务器的默认设置。每个服务器的权限（`src/services/permissions.js`，九个能力，存储为每个 `(user, server)` 的 JSON 列表在 `user_server_permissions` 中）细化了该默认设置，对于一个服务器；每个 `/api/servers/:id` 路由、子路由挂载、页面、WebSocket 和舰队范围的列表都通过 `src/web/middleware/serverAccess.js`（`serverScope`，挂载在 API 和页面路由器的 `/servers/:id` 前缀上，将没有 `view` 权限的服务器隐藏为 404；`requireCap(cap)` 指定路由所需的能力）。在请求体中命名其服务器的写入操作（计划、世界提取和安装、蓝图导出）对查看者仅通过 `requireWrite` 开放，并且每个此类路由本身都会检查能力。`test/permissions-routes.test.js` 遍历实时路由器堆栈，如果范围限定为服务器的写入路由、挂载或页面没有门禁，则失败。

## 关键领域行为

- **Modpacks 始终固定版本。** 镜像在每次重启时自动升级未固定的包，因此面板在安装时将“latest”解析为具体的版本 ID 并固定它。升级是一个明确的协调流程（`updates/`）：预览 → 更新前备份 → 优雅停止 → 重新固定 → 重新创建 → 健康监控 → 一键回滚。
- **自定义 Mod 覆盖层由面板管理**：用户添加的 Mod 会进入去重库，并硬链接到服务器，因此它们可以与包更新一起保留。禁用是按类别进行的。由于库保留了它下载的每个构建，因此更新会记录它替换的构建（`server_content.previous_*`），并且可以仅从本地文件恢复。禁用包 Mod 会写入包的排除环境变量；`packs.applyPack` 在同一包的版本更改时携带该变量以及其他包调整（`PACK_TUNING_KEYS`），并在包更改时将其删除。
- **Minecraft 版本升级必须“赢得”。** `services/compat.js` 扫描服务器的 Mod - 从面板安装的行解析，然后是 CurseForge 包清单，然后通过内容哈希与 Modrinth/CurseForge 进行匹配 - 并根据 CurseForge 的 `latestFilesIndexes`（每次请求 200 个项目）和 Modrinth 的每个项目版本列表（每个项目一个请求，这会使加载器和版本配对）构建每个项目的（加载器、Minecraft 版本）支持矩阵。更新检查器仅提供每个 Mod 支持的最新版本，并且在无法确定答案时根本不提供任何内容：无扫描、扫描不同版本或加载器、扫描从未完成、或注册表中无法识别的 jar。扫描仅手动进行，其进度和部分结果存储在 `version_compat` 中（不在内存中的 `services/tasks.js` 中），因此刷新或面板重启会恢复而不是挂在加载器上；`reconcileScans()` 在下次启动时将因关机而孤立的扫描标记为中断。
- **Mod 加载器版本就像其他所有内容一样被固定。** `services/loaderPin.js` 读取镜像自身安装清单（`.forge-manifest.json` 等）中已安装的构建，并写入固定版本：普通服务器上的加载器 itzg 变量（`FORGE_VERSION` 等），或 Forge 或 Fabric CurseForge 包上的 `CF_MOD_LOADER_VERSION`，它会覆盖包声明的版本。镜像的 CurseForge 安装程序会忽略 NeoForge 的此覆盖，而 Modrinth 和 FTB 包则没有，因此它们的加载器会跟随包。`packs.applyPack` 在包更新或回滚时会剥离所有 `CF_` 变量，从而与其余部分一起删除覆盖。类型化的构建首先与注册表的完整列表进行检查（`services/loaderVersions.js`；Forge 的来自其 maven 元数据，它会跳过数字；未命中时会再次检查注册表本身），然后更改是备份 → 固定（在备份后的环境变量上）→ 重建。
- **端口**从基本方案分配（游戏从 `PORT_GAME_START` 开始，RCON = 游戏 + `PORT_RCON_OFFSET`，Bedrock 从 `PORT_BEDROCK_START` 开始），探测可用性，并在数据库中保留。 “已占用”是所有服务器声明的并集（实时端口，加上下面的待定对），任何 Docker 容器发布的每个主机端口（`containers.publishedHostPorts`：正在运行容器的实时绑定加上每个已停止容器的配置绑定，因为面板自身容器内的 OS 绑定探测只能看到该容器的网络命名空间），以及 OS 探测。Docker 部分缓存 3 秒并有界：2.5 秒内无响应的列表仅丢弃 Docker 部分，缓慢的检查仅消耗该容器的端口。服务器创建和 `servers.changeGamePort` 通过一个仅覆盖选择和声明的序列化链选择端口（创建时的行写入，端口更改时的内存保留）；BlueMap 的端口选择器和额外的端口覆盖不在其中，也不咨询 Docker。现有服务器的端口更改（`servers.changeGamePort`，在服务器的操作锁下）会立即应用，因为 Docker 在容器创建时修复端口绑定：新的对（RCON 始终是游戏 + `PORT_RCON_OFFSET`）在内存中被检查和保留（`ports.reserve`，旧的和新的对都受其他选择的尊重）在端口锁下。它在其他设置等待重建时被拒绝（409 `PENDING_CHANGES`），因此它只会重建一个已经运行过的容器，在一个新端口上；并且正在运行的服务器仅在请求说 `restart: true` 时才更改（否则为 409 `NEEDS_CONFIRM`）。在触及任何内容之前，会拉取镜像并检查自定义容器名称。正在运行的服务器会被停止；然后新的对被写入 `pending_recreate = 1`（这样从那里崩溃的面板会留下诚实的“正在等待重建”消息），容器被移除，在新对上重建并启动。如果在停止后的任何步骤失败，`putBackOnOldPort` 会将旧对写回，在旧对上重建（如果它正在运行则重启）并记录失败的步骤；历史记录和警报会说明即使那也失败了，这会导致服务器停止直到有人启动它。`settings` 能力就足够了，包括正在运行的服务器。非管理员只能从 `PORT_GAME_START` 开始选择。
  （迁移 029 中的 `port_*_pending` 列属于早期未发布的版本设计，未使用；031 清除了它们。）锁冲突会以 `code: 'BUSY'` 回答 409，下面的重试调用者会检查这个而不是文本。崩溃自动重启（`watcher.restartAfterCrash`）和计划的备份或启动（`scheduler.runTaskWithRetry`）发现服务器正忙于其他操作时，会每 20 秒 / 60 秒重试最多 30 分钟，而包更新或回滚会以相同的方式重试其锁定的步骤（`opLock.retryWhileBusy`）；崩溃重启或等待中的计划启动会在有人停止、杀死或启动服务器后停止（`events.lifecycleActionSince`），并且崩溃重启在自动重启关闭或服务器消失时也会停止。计划的重启、停止和命令不会重试，并且一个等待上次运行的计划会跳过其下一次触发。
- **磁盘配额**由面板强制执行，因为 Docker 无法限制绑定挂载的使用：索引器缓存每个目录的大小，并且磁盘增长操作受其限制。
- **密钥**（RCON 密码、API 密钥、TOTP 密钥、Discord Webhook URL）在静态时使用 AES-256-GCM 加密，使用 `$DATA_DIR/.secret-key`（模式 `0600`，自动生成）上的专用随机密钥。它独立于 `SESSION_SECRET`；一个 `SESSION_SECRET` 派生的密钥被保留为仅解密的回退，用于在专用密钥存在之前写入的值，并且 `src/services/secretsMigration.js` 在启动时一次性在专用密钥下重新加密这些值。存在的但无法解析的 `.secret-key` 是一个严重的启动错误（它永远不会被静默地重新生成）。蓝图在导出时会剥离所有密钥。
- **`server.properties` 由面板拥有但被环境变量覆盖。** itzg 镜像在每次启动时都会重新断言每个由环境变量支持的属性（`OVERRIDE_SERVER_PROPERTIES` 默认为 true），因此面板直接编辑的值——世界控件的 PvP/难度、白名单切换、文件编辑器——将在下次启动时被静默地恢复，除非匹配的环境变量被移除并且容器被重新创建。每个直接属性写入都通过 `writeServerProperties()`（整个文件）或 `setServerProperty()`（单个键）在 `src/services/servers.js` 中完成，它会原子地重写文件，取消设置每个更改键后面的环境变量（通过目录字段上的 `prop:` 属性，在测试中针对镜像自身的属性定义进行检查），并标记 `pending_recreate`。难度会写入文件并发送到 RCON，因为专用服务器会在每次启动时重新应用 `difficulty` 属性。Minecraft 本身会在 `whitelist on/off` 时从其启动时值重新保存 server.properties，这会撤销在服务器运行时进行的编辑，因此正在运行的白名单切换会先快照文件，然后写回仅更改了 `white-list` 的文件。环境变量在创建时保持完全可配置（向导会渲染它们并一次性应用）；它们仅在面板首次编辑底层属性时取消固定。MOTD 具有相同的约定：直接编辑 `motd` 文件会取消设置它，因此最后写入的生效。

## 数据和线格式

- **`data/panel.db`** - SQLite 数据库。每天通过 `VACUUM INTO` 快照到 `data/backups/_panel/`（保留最新的 14 个）；启动时运行 `PRAGMA integrity_check`。
- **`data/.session-secret`** - 自动生成的 cookie 签名密钥，在首次运行时创建（如果 `SESSION_SECRET` 未设置）。删除它会轮换密钥（这将使会话失效）。
- **`data/.secret-key`** - 专用的 32 字节静态加密密钥（模式 `0600`），在首次运行时自动创建。独立于 `SESSION_SECRET`；删除它会使所有存储的凭据无法解密，因此它属于您的备份。
- **蓝图 (`.mcserver.zip`)** - 一个 zip 文件，包含 `manifest.json`（描述配置、资源、固定的包引用、覆盖清单（源 URL + sha256））、选定的配置文件，以及可选的世界。导入会重新下载并哈希验证每个 Mod，并分配新的端口。
- **面板创建的 Docker 容器**会被命名和标记，以便观察程序可以找到它们；面板拥有它们的完整生命周期。

## 启动顺序

1. `require('./instrument')`（Sentry 接口）在所有其他之前，然后 `require('./preflight')` 以清晰地在不支持的 Node 版本上失败。
2. 加载配置；确保/生成 `.session-secret` **和** `.secret-key`。
3. `ensureDataRoot()` - 创建 `./data` 布局，清空 `tmp/`。
4. 运行 DB 迁移，然后 `PRAGMA integrity_check`（会大声记录，失败时指向 `data/backups/_panel`）。
5. 在 `.secret-key` 下重新加密任何遗留的 `SESSION_SECRET` 密钥（`secretsMigration`）。
6. 一次性从环境变量导入 API 密钥（`apiKeys.importFromEnvOnce()`），固定任何仍携带未固定 Modpack 选择器的服务器（`packPins.pinUnpinnedServers()`），将上次进程中断的兼容性扫描标记为中断（`compat.reconcileScans()`），然后播种启动器蓝图（受保护）。
7. 启动 HTTP + WS 服务器。在暴露的绑定上，打印首次运行的 `/setup` PIN。
8. 安装启动后运行时保护程序（捕获未捕获的故障；`MSM_EXIT_ON_FATAL=1` 使其在受监督的部署中硬退出）。
9. 启动后台服务：WS 代理、存储索引器、崩溃 + 库存观察程序、调度器、Discord 事件桥、聊天机器人外展观察程序，以及**每日维护计时器**（修剪旧的分析行、聊天机器人记录、事件历史（365 天）和 API 缓存行，然后快照 `panel.db`）。
10. **在后台**初始化 Docker。即使守护进程关闭，UI 也完全可用；当 Docker 变得可访问时，Docker 功能会亮起。连接后，`refreshStatuses({ boot })` 协调缓存的状态，为在面板重启前启动但不会被恢复的服务器发出一次性 `offline-after-restart` 事件，然后启动循环启动 `auto_start` 服务器，并恢复在中断期间发现崩溃的 `auto_restart` 服务器（尊重崩溃循环回退）。

> instrument-before-preflight 的顺序是一个有意的权衡：它允许未来的 Sentry 接线首先修补运行时，代价是在非常古老的 Node 上出现一个不太友好的消息。

## 构建管道

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`，带代码拆分的 ESM)。`postinstall` 运行**仅 CSS**。`public/css/app.css`
和 `public/dist/` 是 gitignored 的构建产物；Dockerfile 的构建阶段运行完整的
`pnpm run build` 并将 `public/` 复制到运行时镜像中。静态资源被提供为
`immutable`/长缓存的指纹文件，短缓存的 CSS/JS，以及 HTML 和 `/api` 的 `no-cache`。
