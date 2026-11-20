---
title: '入门'
description: '安装 Minecraft Server Manager 并完成首次运行设置：系统检查、您的时区以及管理员账户。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← 返回文档索引](/docs/)

## 首次运行设置

首次打开面板时，一个简短的设置向导将引导您完成：

1.  **系统检查** 确保 Docker 可访问，Node.js 版本足够新，并且数据文件夹可写。即使 Docker 尚未运行，您也可以继续；创建和启动服务器将等到 Docker 运行后再进行。
2.  **创建您的管理员账户**。这是在您添加更多账户之前唯一存在的账户，并且拥有完全控制权。选择一个用户名（2 到 32 个字符）和至少 8 个字符的密码。创建完成后，您将立即登录。
3.  **面板配置**（可选）：一个用于在连接地址中向玩家显示的公共域名、一个 CurseForge API 密钥以及您的时区。所有这些都可以在稍后在 **设置** 中更改。

最后一步提供 **创建服务器** 或 **转到仪表板** 的选项。

![首次运行设置的系统检查步骤](/docs/images/setup-system-check.png)

> **公开安装需要 PIN 码保护。** 如果您将面板绑定到非回环地址（`PANEL_HOST` 不是 `127.0.0.1`），设置页面还会要求输入一个 **6 位 PIN 码**。面板会在启动时将其打印到控制台。输入该 PIN 码以及您的用户名和密码。这可以防止陌生人在端口被抢先访问时冒领管理员账户。一旦管理员账户存在，PIN 码就会消失。

## 登录

设置完成后，面板将受到登录屏幕的保护。输入您的用户名和密码继续。

![登录](/docs/images/login.png)

如果您的账户启用了 [双因素身份验证](/docs/two-factor-authentication/)，在输入密码后，您将被要求输入来自身份验证器应用程序的 6 位数字代码。

## 导航指南

所有内容都从左侧边栏展开：

- **仪表板** - 一览所有服务器（[详情](/docs/dashboard/)）。
- **服务器**、**模组包**、**世界**、**蓝图** - 创建和管理服务器及其内容。
- **更新**、**备份**、**计划任务**、**存储**、**活动** - 操作方面：哪些已过时、您的快照、自动化、磁盘使用情况和审计日志。
- **权限**（底部，仅限管理员）：每个用户在每个服务器上可以执行的操作（[详情](/docs/users-and-roles/#per-server-permissions)）。
- **设置**（底部，仅限管理员）：API 密钥、面板配置、新服务器的默认设置、[备份保留策略](/docs/backups/#retention)、用户、登录安全以及公共 API。

在这些下方，边栏列出了您的服务器。打开一个服务器会显示其自己的选项卡：**概览**、**控制台**、**玩家**、**模组**、**世界**、**备份**、**监控** 和 **设置**，其中大部分带有相关的子选项卡（例如，**设置 → 配置** 包含服务器的设置及其游戏端口）。请参阅 [单个服务器](/docs/servers/#a-single-server)。

顶部栏包含 **创建服务器** 按钮、一个 **主题切换器**（深色/浅色）以及您的 **账户菜单**，您可以在其中更改头像、管理 [双因素身份验证](/docs/two-factor-authentication/) 或退出登录。

## 在手机或平板电脑上

每个页面都首先为窄屏幕布局，然后逐渐变宽：边栏隐藏在菜单按钮后面，数据表堆叠成卡片，工具栏换行，世界控件栏折叠成一个卡片，您在需要时打开它。按钮和芯片具有实际的触摸目标大小。没有仅限桌面的内容。

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="手机上的仪表板" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="手机上的服务器概览" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="手机上的控制台" width="180">
  <img src="/docs/images/mobile/mods.png" alt="手机上的模组选项卡" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="手机上的版本兼容性" width="180">
  <img src="/docs/images/mobile/settings.png" alt="手机上的设置" width="180">
</p>

## 您需要什么

面板通过 Docker 来运行服务器，因此需要访问 Docker 守护进程（Docker Desktop 或 Docker Engine 套接字）。当 Docker 可访问时，仪表板上的 Docker 图块会显示 **已连接** 及其版本。如果 Docker 未运行，面板仍可运行。您只是无法在守护进程启动之前启动服务器。

## 后续步骤

- [创建您的第一个服务器 →](/docs/servers/)
- [使用 2FA 保护您的账户 →](/docs/two-factor-authentication/)
