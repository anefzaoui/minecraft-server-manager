---
title: '每个服务器的 Minecraft 聊天机器人'
description: '此分支为每个托管的 Minecraft 服务器添加了一个由管理员配置的聊天机器人。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← 返回文档索引](/docs/)

此分支为每个托管的 Minecraft 服务器添加了一个由管理员配置的聊天机器人。它连接到
兼容 OpenAI 的聊天补全终端，包括局域网另一台主机上的 Ollama。每个服务器都有
自己的终端、模型、调用名称、角色、对话记录策略、外展消息和权限策略。默认调用是 `@wizard`，默认角色扮演的是一个古老而
有趣的巫师；两者均可编辑。

![聊天机器人设置](/docs/images/integrations-chatbot.png)

## 玩家体验

- 任何玩家都可以使用 `@wizard <消息>`（或配置的调用）进行对话，并获得
  确定性的、与 Minecraft 版本兼容的原版配方帮助。
- 加入问候语和可配置的一次性会话签到提醒玩家聊天机器人可用。`@wizard chat` 打开一个简短的加入对话窗口；`@wizard bye` 关闭它。
- **普通用户**可以调用已启用的自我/世界权限。**权限控制器**可以调用单独验证的操作，影响其他在线玩家。不属于任何一组的玩家
  只能进行对话。
- 普通用户的自我赠送使用物品允许列表。控制器可以赠送其他玩家任何有效的命名空间原版或模组物品，但需遵守数量限制和其他权限保护措施。

![聊天机器人对话记录](/docs/images/chatbot-transcripts.png)

## 设计与安全

配置和对话记录仅限管理员访问。模型永远不会接收原始 RCON 或任意
命令执行。一条消息仅暴露与其明确意图匹配的单个固定工具；
服务器代码在执行现有服务操作之前会验证授权、参数、标志、数量、冷却时间和确切的在线玩家姓名。Minecraft 选择器将被拒绝，跨玩家操作不能针对调用者，权限从试运行模式开始，并且每次尝试的权限都会被审计。不支持的工具调用模型将回退到仅对话模式。

回复内容受 Minecraft 聊天限制。已知的原版配方来自捆绑的版本化配方数据，并渲染为稳定的 2x2/3x3 网格；LLM 不被信任来生成配方布局。未知或模组配方将引导玩家访问 JEI/REI，而不是编造答案。

## 主要实现文件

- `src/services/wizard.js`：每个服务器的配置、兼容 OpenAI 的请求、聊天处理、
  外展、对话记录保留和响应限制。
- `src/services/wizardPowers.js`：角色检查、特定意图的工具模式、验证、执行、
  冷却时间和权限审计。
- `src/services/wizardRecipes.js`：确定性的版本化配方查找和网格格式化。配方
  和物品数据来自捆绑的 [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data)
  包。（本文档的早期草稿曾指向一个从未提交的 `src/data/recipes/` 文件夹；不存在这样的文件夹，数据位于该包中。请参阅“依赖性占用空间”。）
- `src/analytics/ingest.js`：将解析后的加入、离开和玩家聊天转发给聊天机器人。
- `src/web/routes/wizard.js`、`public/js/pages/integrations.js` 和
  `views/partials/server/integrations.hbs`：管理员 API 和每个服务器的集成 UI。
- `src/db/migrations/011_wizard_chat.js` 至 `019_wizard_power_controllers.js`：持久化模式。
- `test/wizard.test.js`：授权、工具边界、保留、外展和聊天行为测试。

内部 `wizard` 路由/模块/表名称保留用于升级和 API 兼容性；“chatbot”是面向用户的产品术语。同样，存储的 `power_testers_json` 字段映射到 UI 的**普通用户**组。

## 依赖性占用空间 (`minecraft-data`)

配方帮助使用 `minecraft-data` 包。它在磁盘上占用空间很大（安装后约 429 MB），并且由于它是运行时依赖项而非开发依赖项，因此它会包含在生产镜像中。我们特意保留它，以便配方帮助可以在没有网络调用的情况下离线工作，支持每个 Minecraft 版本。

给下一个查看此内容的人（人类或 AI）的说明，以便大小不会出乎意料：

- 目前只使用了 Java (`pc`) 数据。`wizardRecipes.js` 读取 `minecraftData.versions.pc`
  以及每个版本的 `recipes`、`items` 和 `blocks` 表。它实际触及的文件加起来大约为 15 MB，涵盖了所有 pc 版本。
- 该包中约 330 MB 是 `data/bedrock`，目前没有任何内容读取它。我们特意将其保留。如果面板将来添加了 Bedrock Minecraft 支持，Bedrock 的配方和物品数据已在此处，因此配方功能可以扩展以覆盖 Bedrock 服务器，而无需添加新的依赖项。从 `minecraftData.versions.bedrock` 开始，并遵循与 pc 路径相同的结构。
- 如果在 Bedrock 支持上线之前必须减小尺寸，此仓库中已有相应的模式。`src/services/itemRegistry.js` 在需要时从 jsDelivr CDN 获取 `minecraft-data` 文件，并将其缓存到 `api_cache` 中。采用这种方法，或者使用一个小的、精心挑选的 `src/data/recipes/` 子集来涵盖几个常用版本，都可以大大缩小镜像的体积。

## 本地存储和手动检查

所有设置和保留的对话记录都存储在面板容器内的面板 SQLite 数据库 `/data/panel.db` 中。使用标准的 Compose 挂载，主机路径为
`${DATA_DIR_HOST}/panel.db`（例如 `/opt/msm/data/panel.db`）。相关表是
`wizard_configs`、`wizard_transcripts` 和 `wizard_outreach`；权限审计是 `events` 表中类型为 `wizard-power` 的行。可选的 LLM API 密钥使用面板的 `SESSION_SECRET` 进行 AES-256-GCM 加密，通常持久化为 `${DATA_DIR_HOST}/.session-secret`。

在直接编辑 SQLite 之前备份数据库并停止面板，以安全地处理其 WAL。
推荐使用管理员 UI/API，因为它会应用验证和加密。复制实时数据库时，请将
`panel.db`、`panel.db-wal` 和 `panel.db-shm` 文件放在一起。
