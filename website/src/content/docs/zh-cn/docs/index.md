---
title: '文档'
description: '一个完整的、自托管的 itzg/docker-minecraft-server 控制面板。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

一个完整的、自托管的 Minecraft 服务器管理器控制面板，适用于 [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)。通过浏览器创建、运行和管理 Minecraft 服务器。无需命令行，无需手动编辑 YAML。

![Dashboard](/docs/images/dashboard.png)

## 入门

- **[快速入门](/docs/getting-started/)** - 首次运行设置、登录以及熟悉界面。
- **[仪表板](/docs/dashboard/)** - 一目了然地查看所有服务器、玩家和活动。

## 运行服务器

- **[创建和管理服务器](/docs/servers/)** - 创建向导、服务器类型、版本以及每个服务器的设置。
- **[控制台和聊天命令](/docs/console-and-chat/)** - 实时控制台，以及作为玩家运行的自定义游戏内聊天命令。
- **[模组包](/docs/modpacks/)** - 安装 CurseForge、Modrinth、FTB 和 GT New Horizons 包，始终固定到精确版本。
- **[世界和文件](/docs/worlds-and-files/)** - 在浏览器中直接切换世界、管理模组和编辑文件。
- **[缩小世界](/docs/world-shrink/)** - 通过移除无人访问的区块来回收磁盘空间，可单独执行或作为备份的一部分。
- **[实时地图](/docs/live-map/)** - 一键生成 BlueMap 3D 世界地图，位于面板登录之后。
- **[邀请和状态页面](/docs/invites-and-status-page/)** - 提供给朋友的服务器地址、邀请文本和客户端模组包，以及一个公开的状态页面。

## 数据和自动化

- **[每个服务器的聊天机器人](/docs/chatbot/)** - 本地/兼容 OpenAI 的对话、外联、保留的对话记录以及受限的游戏玩法权限。
- **[备份](/docs/backups/)** - 一键快照、计划备份、保留数量（全局或每个服务器），以及恢复。
- **[蓝图](/docs/blueprints/)** - 捕获服务器的整个配置，并从中创建新的服务器。
- **[计划任务](/docs/schedules/)** - 由 cron 驱动的重启、备份和命令。
- **[存储](/docs/storage/)** - 每个服务器的磁盘使用情况和面板强制配额。
- **[更新](/docs/updates/)** - 跟踪新的服务器、包、镜像和模组版本，检查您的模组支持哪些 Minecraft 版本，以及撤销模组更新。
- **[活动日志](/docs/activity/)** - 所有发生事件的审计跟踪。
- **[集成](/docs/integrations/)** - Discord 网页钩子通知和“警报”类别。
- **[公共 API](/docs/public-api/)** - 一个只读的、通过令牌认证的 HTTP API，用于从面板外部获取服务器状态。

## 账户和安全

- **[用户和角色](/docs/users-and-roles/)** - 管理员、操作员和查看者，各自的权限，以及细化这些权限的每个服务器权限。
- **[双因素身份验证](/docs/two-factor-authentication/)** - 使用身份验证器应用程序保护您的登录。

## 指南

与本面板无关：每个 Minecraft 服务器所有者都会遇到的问题。

- **[服务器需要多少 RAM？](/docs/guide-server-memory/)** - 需要设置的两个数字，以及为什么空闲服务器会显示为 12 GB。
- **[Vanilla、Paper、Fabric、Forge、NeoForge、Quilt](/docs/guide-choosing-a-loader/)** - 选择哪个运行，以及选择背后的插件/模组区别。
- **[您的服务器无法启动](/docs/guide-server-wont-start/)** - 阅读日志，以及导致大多数失败的少数原因。
- **[真正可恢复的备份](/docs/guide-backups/)** - 一致的副本，还需要保留什么，以及在需要之前进行测试。
- **[将服务器迁移到另一个主机](/docs/guide-moving-a-server/)** - 保持停机时间短和物品栏完整的顺序。

## 幕后

- **[架构](/docs/architecture/)** - 面板是如何构建的。
- **[网站](/docs/website/)** - minecraft-server-manager.com 是如何从这个仓库构建、翻译和部署的。

---

> 这些文档中的截图是在面板的暗色主题下截取的。除非您的操作系统偏好浅色主题，否则面板默认以暗色主题启动；使用顶栏中的主题切换器进行切换。
