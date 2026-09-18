---
title: '计划任务'
description: '计划任务页面使用cron表达式自动化重复性任务。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← 返回文档索引](/docs/)

**计划任务**页面使用cron表达式自动化重复性任务。无需外部cron，无需脚本。

![计划任务](/docs/images/schedules.png)

## 可以计划的任务

- **重启** - 夜间重启以保持长时间运行的服务器健康。
- **备份** - 定期快照（在[备份](/docs/backups/)页面中标记为`scheduled`）。
- **命令** - 按计划运行任何服务器命令。
- **更新检查** - 定期刷新过时的内容。

每个计划任务都针对特定服务器（或全局面板），运行自己的cron表达式，并且可以启用或禁用而无需删除。将显示上次运行时间，以便您确认它已触发。
