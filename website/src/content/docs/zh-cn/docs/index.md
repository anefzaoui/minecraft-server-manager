---
title: '文档'
description: '一个完整的、自托管的 itzg/docker-minecraft-server 控制面板。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

一个完整的、自托管的 Minecraft 服务器管理面板，适用于 [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server)。通过浏览器创建、运行和管理 Minecraft 服务器。无需命令行，无需手动编辑 YAML。

![Dashboard](/docs/images/dashboard.png)

## 入门

- **[入门指南](/docs/getting-started/)** - 首次运行设置、登录以及熟悉界面。
- **[仪表板](/docs/dashboard/)** - 一目了然地查看所有服务器、玩家和活动。

## 运行服务器

- **[创建和管理服务器](/docs/servers/)** - 创建向导、服务器类型、版本以及每个服务器的设置。
- **[控制台和聊天命令](/docs/console-and-chat/)** - 实时控制台，以及作为玩家运行的自定义游戏内聊天命令。
- **[模组包](/docs/modpacks/)** - 安装 CurseForge、Modrinth、FTB 和 GT New Horizons 模组包，始终固定到精确版本。
- **[世界和文件](/docs/worlds-and-files/)** - 在浏览器中直接切换世界、管理模组和编辑文件。
- **[缩小世界](/docs/world-shrink/)** - 通过移除无人访问的区块来回收磁盘空间，可单独进行或作为备份的一部分。

## 数据和自动化

- **[每个服务器的聊天机器人](/docs/chatbot/)** - 本地/兼容 OpenAI 的对话、外联、保留的对话记录以及受限的游戏玩法权限。
- **[备份](/docs/backups/)** - 一键快照、计划备份和恢复。
- **[蓝图](/docs/blueprints/)** - 捕获服务器的整个配置，并从中创建新的服务器。
- **[计划任务](/docs/schedules/)** - 由 cron 驱动的重启、备份和命令。
- **[存储](/docs/storage/)** - 每个服务器的磁盘使用情况和面板强制配额。
- **[更新](/docs/updates/)** - 跟踪新的服务器、模组包、镜像和模组版本。
- **[活动日志](/docs/activity/)** - 所有发生事件的审计跟踪。
- **[集成](/docs/integrations/)** - Discord 网页钩子通知和警报类别。
- **[公共 API](/docs/public-api/)** - 一个只读的、通过令牌认证的 HTTP API，用于从面板外部获取服务器状态。

## 账户和安全

- **[用户和角色](/docs/users-and-roles/)** - 管理员、操作员和查看者，以及各自的权限。
- **[双因素认证](/docs/two-factor-authentication/)** - 使用身份验证器应用程序保护您的登录。

## 底层原理

- **[架构](/docs/architecture/)** - 面板的组成方式。
- **[网站](/docs/website/)** - minecraft-server-manager.com 如何从该仓库构建、翻译和部署。

---

> 这些文档中的截图是在面板的暗色主题下截取的。除非您的操作系统偏好浅色主题，否则面板默认以暗色主题启动；使用顶栏中的主题切换器进行切换。
