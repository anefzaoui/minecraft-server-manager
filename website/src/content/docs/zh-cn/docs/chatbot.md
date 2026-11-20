---
title: '每个服务器的 Minecraft 聊天机器人'
description: '该面板为每个托管的 Minecraft 服务器提供了一个由管理员配置的聊天机器人，可在服务器的“设置”→“聊天机器人”选项卡中进行设置。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← 返回文档索引](/docs/)

该面板为每个托管的 Minecraft 服务器提供了一个由管理员配置的聊天机器人，设置在服务器的 **设置 → 聊天机器人** 选项卡中。它连接到兼容 OpenAI 的 chat-completions 端点，包括局域网另一台主机上的 Ollama。每个服务器都有自己的端点、模型、调用名称、角色、对话记录策略、外展消息和权限策略。默认调用是 `@wizard`，默认角色扮演的是一个古老而有趣的地下城巫师；两者都可以编辑。

![Chatbot settings](/docs/images/integrations-chatbot.png)

## 玩家体验

- 任何玩家都可以使用 `@wizard <消息>`（或配置的调用名称）进行对话，并获得确定性的、与 Minecraft 版本兼容的原版配方帮助。
- 加入问候语和可配置的一次性游戏会话签到提醒玩家聊天机器人可用。`@wizard chat` 打开一个简短的加入对话窗口；`@wizard bye` 关闭它。
- **普通用户**可以调用已启用的自我/世界权限。**权限控制器**可以调用单独验证的操作，影响其他在线玩家。不属于任何一组的玩家只能进行对话。
- 普通用户的自我赠送使用物品允许列表。控制器可以给其他玩家任何有效的命名空间原版或模组物品，但需遵守数量限制和其他权限保护措施。

![Chatbot transcripts](/docs/images/chatbot-transcripts.png)

## 设计和安全

配置和对话记录仅限管理员访问。模型永远不会接收原始 RCON 或任意命令执行。消息只暴露与其明确意图匹配的单个固定工具；服务器代码在执行现有服务操作之前会验证授权、参数、标志、数量、冷却时间和确切的在线玩家姓名。Minecraft 选择器将被拒绝，跨玩家操作不能针对调用者，权限以“试运行”模式开始，并且每次尝试的权限都会被审计。不支持的工具调用模型将回退到仅对话模式。

回复内容限制在 Minecraft 聊天范围内。已知的原版配方来自捆绑的版本化配方数据，并以稳定的 2x2/3x3 网格形式显示；不信任 LLM 来发明配方布局。未知或模组配方将引导玩家到 JEI/REI，而不是编造答案。

## 主要实现文件

- `src/services/wizard.js`: 每个服务器的配置、兼容 OpenAI 的请求、聊天处理、外展、对话记录保留和响应限制。
- `src/services/wizardPowers.js`: 角色检查、特定意图的工具模式、验证、执行、冷却时间和权限审计。
- `src/services/wizardRecipes.js`: 确定性的版本化配方查找和网格格式化。配方和物品数据来自捆绑的 [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) 包。（本文档的早期草稿指向了一个从未提交的 `src/data/recipes/` 文件夹；不存在这样的文件夹，数据存在于包中。请参阅“依赖项占用空间”。）
- `src/analytics/ingest.js`: 将解析后的加入、离开和玩家聊天转发给聊天机器人。
- `src/web/routes/wizard.js`、`public/js/pages/integrations.js` 和 `views/partials/server/integrations.hbs`（通过 `chatbot.hbs`）：管理员 API 和每个服务器的“设置 → 聊天机器人”选项卡。
- `src/db/migrations/011_wizard_chat.js`、`013_wizard_invocation_name.js`、`015_wizard_powers.js`、`017_wizard_outreach.js` 和 `019_wizard_power_controllers.js`: 持久化模式。
- `test/wizard.test.js`: 授权、工具边界、保留、外展和聊天行为测试。

内部的 `wizard` 路由/模块/表名称保留用于升级和 API 兼容性；“chatbot”是面向用户的产品术语。同样，存储的 `power_testers_json` 字段映射到 UI 的 **普通用户**组。

## 依赖项占用空间 (`minecraft-data`)

配方帮助使用 `minecraft-data` 包。它在磁盘上占用空间很大（安装后约 429 MB），并且由于它是运行时依赖项而不是开发依赖项，因此它会包含在生产镜像中。我们特意保留它，以便配方帮助可以离线工作，支持每个 Minecraft 版本，而无需进行网络调用。

给下一个查看此内容的人（人类或 AI）的注意事项，以免尺寸出乎意料：

- 目前只使用 Java (`pc`) 数据。`wizardRecipes.js` 读取 `minecraftData.versions.pc` 以及每个版本的 `recipes`、`items` 和 `blocks` 表。它实际触及的文件加起来大约是每个 pc 版本 15 MB。
- 该包中约 330 MB 是 `data/bedrock`，目前没有任何内容读取它。我们特意将其保留。如果面板将来添加了 Bedrock Minecraft 支持，Bedrock 的配方和物品数据已经在这里，因此配方功能可以扩展到覆盖 Bedrock 服务器，而无需添加新的依赖项。从 `minecraftData.versions.bedrock` 开始，并遵循与 pc 路径相同的结构。
- 如果在 Bedrock 支持上线之前必须减小尺寸，此仓库中已经有相应的模式。`src/services/itemRegistry.js` 在需要时从 jsDelivr CDN 获取 `minecraft-data` 文件，并将其缓存到 `api_cache` 中。采用这种方法，或者使用一个涵盖几个常用版本的小型手工挑选的 `src/data/recipes/` 子集，都可以大大减小镜像尺寸。

## 本地存储和手动检查

所有设置和保留的对话记录都存储在面板容器内的面板 SQLite 数据库 `/data/panel.db` 中。使用标准的 Compose 挂载，主机路径是 `${DATA_DIR_HOST}/panel.db`（例如 `/opt/msm/data/panel.db`）。相关表是 `wizard_configs`、`wizard_transcripts` 和 `wizard_outreach`；权限审计是 `events` 表中的行，类型为 `wizard-power`。可选的 LLM API 密钥使用面板的静态密钥（数据文件夹中的 `.secret-key`，与 `SESSION_SECRET` 分开）进行 AES-256-GCM 加密。

在直接编辑 SQLite 之前备份数据库并停止面板，以安全地处理其 WAL。首选使用管理员 UI/API，因为它会应用验证和加密。复制实时数据库时，请将 `panel.db`、`panel.db-wal` 和 `panel.db-shm` 文件放在一起。
