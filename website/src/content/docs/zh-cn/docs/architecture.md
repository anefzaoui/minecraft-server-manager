---
title: '架构'
description: 'Minecraft Server Manager 是一个单进程、服务器渲染的 Node.js 应用程序。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← 返回文档索引](/docs/)

Minecraft Server Manager 是一个单进程、服务器渲染的 Node.js 应用程序。它使用
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) 镜像管理作为 Docker 容器运行的
Minecraft 服务器，通过其 API 与 Docker 守护进程通信（绝不通过 shell 调用 `docker` CLI）。

## 运行时结构

- **Express + Handlebars** 在服务器端渲染页面。没有 SPA；`public/js/` 中的浏览器 JS 是手工编写的渐进增强。esbuild 步骤 (`pnpm run build:js`) 会将其打包并最小化到 `public/dist/js/`；当该文件存在时，应用程序会提供该捆绑包，否则提供原始源文件，因此在没有构建的情况下运行开发版本也能正常工作。
- **`node:sqlite`**（内置于 Node 中；面板需要 Node ≥ 24）是数据库——同步、零原生模块、WAL 模式。一个小的版本化迁移运行器会在启动时应用 `src/db/migrations/*`。准备好的语句缓存在 `src/db/index.js` 中，以 SQL 文本作为键。
- **`ws`** 用于实时控制台和统计信息流。两者都是**代理的**：每个服务器一个上游 `docker logs --follow`（或 `docker stats`），只解复用一次并分发给每个连接的标签页，而不是每个查看器一个上游。控制台代理程序保留一个小的重放缓冲区供晚加入的标签页使用，并丢弃其套接字落后太多的订阅者，而不是使共享流停滞。
- **dockerode** 是应用程序与 Docker 通信的唯一方式。端点会根据平台自动检测（Windows 命名管道 vs. Unix 套接字）。
- **所有持久化状态都位于一个目录下**（`$DATA_DIR`，默认为 `./data`）。复制该目录即可迁移整个面板。

## 分层结构

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

- **`web/routes/`** - 每个域一个路由器（`servers`, `players`, `worlds`, `crashes`, `blueprints`, `files`, …），在 `web/app.js` 中挂载。路由器使用 zod 进行验证，调用服务，并返回 JSON 或渲染视图。业务逻辑不属于此处。两个路由器挂载在**公共区域**，在 `requireAuth` 之前：`routes/status.js`（可选的每个服务器 HTML 状态页面）和 `routes/apiV1.js`（`/api/v1`，一个由管理员生成的 Bearer 令牌通过 `services/apiTokens.js` 进行身份验证的只读 JSON API，默认禁用，请参阅 `docs/public-api.md`）。
- **`services/`** - 应用程序的核心。每个服务负责一个域，并可能依赖于基础设施和其他服务。
- **`docker/`** - dockerode 包装器：`connect`（端点检测 + 守护进程健康状况）、`containers`（创建/启动/停止/重新创建，带绑定挂载、内存/CPU 限制和标签）、`logs`、`stats`，以及一个 `watcher`，它将 Docker 事件转换为历史记录 + 崩溃检测。
- **`db/`** - SQLite 包装器和迁移运行器。
- **`storage/`** - `./data` 引导程序，**路径保护器**（`safeJoin`，文件安全骨干），以及后台大小索引器 + 配额强制执行。

横切关注点：

- **`config/`** - 环境配置加上**字段目录**：服务器设置的唯一真相来源。每个 itzg 环境变量都已编目（标签、帮助、类型、单位、默认值、验证、部分、危险标志）。向导、设置表单和 zod 验证都源自于此，因此公开一个新设置只需更改数据，而无需新的 UI 管道。
- **`events/`** - `recordEvent()` 是历史日志的唯一入口点；生命周期事件还会捕获容器日志摘录到 `data/logs/<id>/events/`。
- **`ws/`** - 经过身份验证的控制台 + 统计信息 WebSockets（升级时验证会话 cookie，检查 `Origin` 以阻止跨站劫持），按服务器代理（参见“运行时结构”）。
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` 返回一个每个模块的
  [Pino](https://getpino.io) 日志记录器；级别来自 `LOG_LEVEL`，`makeFailureThrottle()` 保持一个持续失败的后台循环，只输出一条日志行加上一条“已恢复”行。
  `src/utils/logSanitize.js` 会从结构化元数据中删除凭据形状的键和 webhook 令牌；`src/config/logLevel.js` 是共享的级别允许列表（单独存放以避免与 `config` 产生循环依赖）。`src/instrument.js` 是一个休眠的 Sentry 接口，在 `src/server.js` 中最先加载。`src/web/middleware/requestLog.js` 为每个请求写入一条访问日志行（跳过 `/healthz` 和静态资源）。ESLint 在 `src/**` 下强制执行 `no-console`，但 `preflight.js`、`instrument.js` 和 `config/index.js` 除外（它们在日志记录器存在之前运行）。
- **速率限制** - `src/web/middleware/rateLimit.js` 将 `express-rate-limit` 放在 `/api`（`RATE_LIMIT_API_PER_MIN`，默认为 1200）和登录/2FA/设置 POST 请求（`RATE_LIMIT_AUTH_PER_15MIN`，默认为 100）前面；`0` 会禁用限制器。它以 `req.ip` 作为键，因此在代理后面时 `TRUST_PROXY` 很重要。`/api/v1` 有自己的每个令牌限制器
  （`RATE_LIMIT_PUBLIC_API_PER_MIN`，默认为 120），以 Bearer 令牌的哈希作为键，并以 IP 作为备用。`src/web/middleware/auth.js` 中一个单独的每个账户软计数器处理登录锁定（按 IP 和全局账户，衰减）。

## 关键领域行为

- **Modpacks 始终被固定。** 镜像会在每次重启时自动升级未固定的包，因此面板会在安装时将“latest”解析为具体的版本 ID 并固定它。升级是一个显式的协调流程（`updates/`）：预览 → 更新前备份 → 正常停止 → 重新固定 → 重新创建 → 健康监控 → 一键回滚。
- **自定义 Mod 覆盖层由面板管理**：用户添加的 Mod 会进入去重库，并被硬链接到服务器中，以便在包更新后得以保留。禁用是按类别进行的。
- **端口**从基本方案分配（游戏从 `PORT_GAME_START` 开始向上，RCON = 游戏 + `PORT_RCON_OFFSET`，Bedrock 从 `PORT_BEDROCK_START` 开始），探测可用性，并在数据库中保留。
- **磁盘配额**由面板强制执行，因为 Docker 无法限制绑定挂载的使用：索引器缓存每个目录的大小，磁盘增长操作会根据这些大小进行限制。
- **密钥**（RCON 密码、API 密钥、TOTP 密钥、Discord webhook URL）在静态存储时使用 AES-256-GCM 加密，使用 `$DATA_DIR/.secret-key` 处的专用随机密钥（模式 `0600`，自动生成）。它独立于 `SESSION_SECRET`；一个从 `SESSION_SECRET` 派生的密钥作为仅解密的回退，用于在专用密钥存在之前写入的值，并且 `src/services/secretsMigration.js` 在启动时将这些值重新加密到专用密钥下。
  一个存在的 `.secret-key` 但无法解析会导致启动错误（它永远不会被静默地重新生成）。导出蓝图时会剥离所有密钥。

## 数据和传输格式

- **`data/panel.db`** - SQLite 数据库。每天通过 `VACUUM INTO` 快照到
  `data/backups/_panel/`（保留最新的 14 个）；启动时运行 `PRAGMA integrity_check`。
- **`data/.session-secret`** - 自动生成的 cookie 签名密钥，在首次运行时创建（如果
  `SESSION_SECRET` 未设置）。删除它会轮换密钥（这将使会话失效）。
- **`data/.secret-key`** - 专用的 32 字节静态加密密钥（模式 `0600`），在首次运行时自动创建。独立于 `SESSION_SECRET`；删除它将使所有存储的凭据无法解密，因此它应该与您的备份一起存放。
- **蓝图 (`.mcserver.zip`)** - 一个 zip 文件，包含 `manifest.json`（描述配置、资源、固定的包引用、覆盖层清单（源 URL + sha256）、选定的配置文件，以及可选的世界）。导入会重新下载并哈希验证每个 Mod，并分配新的端口。
- **由面板创建的 Docker 容器**会被命名和标记，以便观察程序可以找到它们；面板拥有它们的完整生命周期。

## 启动顺序

1. 最先 `require('./instrument')`（Sentry 接口），然后 `require('./preflight')` 以清晰地报告不支持的 Node 版本。
2. 加载配置；确保/生成 `.session-secret` **和** `.secret-key`。
3. `ensureDataRoot()` - 创建 `./data` 布局，清空 `tmp/`。
4. 运行数据库迁移，然后运行 `PRAGMA integrity_check`（会大声记录，失败时指向 `data/backups/_panel`）。
5. 将任何旧的 `SESSION_SECRET` 密钥加密的密钥重新加密到 `.secret-key` 下（`secretsMigration`）。
6. 填充启动蓝图（受保护）。
7. 启动 HTTP + WS 服务器。在暴露的绑定上，打印首次运行时的 `/setup` PIN。
8. 安装启动后运行时保护程序（捕获未捕获的故障；`MSM_EXIT_ON_FATAL=1` 使其在受监督的部署中硬退出）。
9. 启动后台服务：WS 代理、存储索引器、崩溃 + 库存观察程序、调度器、Discord 事件桥，以及**每日维护计时器**（修剪旧的分析行 + 快照
   `panel.db`）。
10. **在后台**初始化 Docker。即使守护进程关闭，UI 仍然完全可用；当 Docker 变得可访问时，Docker 功能才会启用。连接后，`refreshStatuses({ boot })` 会协调缓存的状态，为在面板重启前运行但不会被重新启动的服务器发出一次性的 `offline-after-restart` 事件，并启动 `auto_start` 服务器以及恢复在中断期间发现崩溃的 `auto_restart` 服务器（尊重崩溃循环回退）。

> instrument-before-preflight 的顺序是一个刻意的权衡：它允许未来的 Sentry 接线首先修补运行时，代价是在非常旧的 Node 版本上显示一个不太友好的消息。

## 构建流水线

`pnpm run build` = `build:css`（Tailwind → `public/css/app.css`）+ `build:js`（esbuild →
`public/dist/js/`，带代码拆分的 ESM）。`postinstall` **仅**运行 CSS。`public/css/app.css`
和 `public/dist/` 是 gitignore 的构建产物；Dockerfile 的构建阶段运行完整的
`pnpm run build` 并将 `public/` 复制到运行时镜像中。静态资源被提供为
`immutable`/长缓存（针对指纹文件），短缓存（针对 CSS/JS），以及 `no-cache`（针对 HTML 和
`/api`）。
