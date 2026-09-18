---
title: '更新'
description: '更新页面在一个地方跟踪您集群中过时的内容：'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← 返回文档索引](/docs/)

**更新**页面在一个地方跟踪您集群中所有过时的内容：

- **Modpack** 版本（[modpacks](/docs/modpacks/)）与 Modrinth / CurseForge / GTNH 发布索引进行对比。
- 您自行添加的**自定义内容**——模组、数据包、资源包、插件——每个都与其来源进行对比：Modrinth、CurseForge、Hangar、SpigotMC (Spiget) 或 GitHub Releases。GitHub 查询使用 ETag 重新验证，因此每日检查几乎不会触及其速率限制。
- **Docker 镜像**过时：每个运行容器的镜像 ID 与新拉取的标签进行对比（同一标签在不同服务器上会去重），提供仅重建的升级选项。
- **独立版本固定**：对于没有托管包的服务器，将显式的 `mc_version` 固定版本与 Mojang 的清单进行对比，并将显式的加载器构建环境变量（`PAPER_BUILD`、`FORGE_VERSION` 等）与加载器的注册表进行对比。Paper 构建来自 PaperMC 当前的 **Fill v3 API**（旧的 v2 端点已停止接收新的 Minecraft 版本）。

![Updates](/docs/images/updates.png)

## 工作原理

面板将每个服务器的固定版本与上游来源进行对比，并列出任何有新发布的项。一个匹配计数也会出现在 [仪表板](/docs/dashboard/) 的“可用更新”磁贴上。

检查按需运行，也可以安排（[Schedules](/docs/schedules/)）。更新**策略**是每个服务器独立的：您决定面板是仅通知您，还是让一切保持手动。

## 应用更新

更新永远不会是静默的。当您选择升级一个包时，面板会：

1. 进行一次**更新前备份**（因此是可逆的；每个服务器保留最近的 10 个更新前备份）。
2. 固定确切的新版本。
3. 重建容器，如有必要则重新解析 Java 运行时。
4. 监控首次启动，并为每个平台设置时间预算。

如果容器未能健康启动，您将回滚到更新前备份。一个稳定跟踪的服务器永远不会被提供测试版，并且更新日志链接指向实际的按版本 diff，如果来源提供了的话。如果更新失败，并且集成了 Discord [告警](/docs/integrations/)，则会触发告警。
