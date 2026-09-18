---
title: '入门'
description: '首次打开面板时，它会要求您创建一个管理员帐户。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← 返回文档索引](/docs/)

## 首次设置

首次打开面板时，它会要求您创建一个管理员帐户。这是您添加更多帐户之前存在的唯一帐户，并且拥有完全控制权。

选择一个用户名和至少 8 个字符的密码。就是这样：您已登录并直接进入仪表板。

> **暴露的安装需要 PIN 码保护。** 如果您将面板绑定到非回环地址（`PANEL_HOST` 不是 `127.0.0.1`），设置页面还会要求您输入一个 **6 位 PIN 码**。面板会在启动时将其打印到控制台。输入它以及您的用户名和密码。这可以防止在端口上抢先一步的陌生人声明管理员帐户。一旦管理员帐户存在，PIN 码就会消失。

## 登录

设置完成后，面板将受到登录屏幕的保护。输入您的用户名和密码继续。

![Sign in](/docs/images/login.png)

如果您的帐户启用了[双因素身份验证](/docs/two-factor-authentication/)，在输入密码后，系统会要求您输入来自身份验证器应用程序的 6 位数字代码。

## 导航

所有内容都集中在左侧边栏：

- **仪表板** - 一目了然地查看所有服务器（[详情](/docs/dashboard/)）。
- **服务器**、**Modpacks**、**Worlds**、**Blueprints** - 创建和管理服务器及其内容。
- **Updates**、**Backups**、**Schedules**、**Storage**、**Activity** - 操作方面：哪些已过时、您的快照、自动化、磁盘使用情况和审计日志。
- **设置**（底部）：用户、API 密钥和面板配置。

顶部栏包含 **创建服务器** 按钮、**主题切换器**（深色/浅色）以及您的 **帐户菜单**，您可以在其中管理[双因素身份验证](/docs/two-factor-authentication/)或退出登录。

## 在手机或平板电脑上

每个页面都首先为窄屏幕布局，然后在此基础上扩展：侧边栏隐藏在菜单按钮后面，数据表堆叠成卡片，工具栏换行，世界控件栏折叠成一个卡片，您在需要时打开它。按钮和芯片具有实际的触摸目标大小。没有仅限桌面的内容。

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="手机上的仪表板" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="手机上的服务器概览" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="手机上的控制台" width="180">
  <img src="/docs/images/mobile/mods.png" alt="手机上的 Mods 选项卡" width="180">
  <img src="/docs/images/mobile/settings.png" alt="手机上的设置" width="180">
</p>

## 您需要什么

面板通过 Docker 来运行服务器，因此需要访问 Docker 守护进程（Docker Desktop 或 Docker Engine 套接字）。当 Docker 可访问时，仪表板上的 Docker 图块会显示 **Connected** 及其版本。如果不可访问，面板仍会运行。在守护进程启动之前，您将无法启动服务器。

## 后续步骤

- [创建您的第一个服务器 →](/docs/servers/)
- [使用 2FA 保护您的帐户 →](/docs/two-factor-authentication/)
