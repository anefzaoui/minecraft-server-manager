---
title: '实时地图'
description: '一键开启服务器世界的 BlueMap 实时 3D 地图，仅通过面板登录提供服务。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← 返回文档索引](/docs/)

服务器的 **世界 → 地图** 选项卡显示了一个由 [BlueMap](https://bluemap.bluecolored.de/)（免费开源）绘制的、可缩放的实时 3D 世界地图，包含玩家位置和所有维度。面板会安装、配置并托管它；你无需为其开放端口或编辑配置文件。

## 开启地图

1. 打开服务器，然后进入 **世界 → 地图**。
2. 按下 **启用实时地图**。面板将从 Modrinth 安装与服务器加载器和 Minecraft 版本匹配的 BlueMap 构建版本，为你接受 BlueMap 的资源下载，并为其选择一个空闲端口。
3. 重启服务器（更改将在下次启动时生效，并且服务器将被标记为等待启动）。

BlueMap 在后台渲染，因此绘制第一批图块需要几分钟时间。在此之前，选项卡会显示地图尚未就绪，并会自动重新检查。一旦地图就绪，**全屏** 按钮将在其自己的浏览器标签页中打开地图。

它适用于带有模组加载器（Fabric、Quilt、Forge、NeoForge）的服务器和插件服务器（Paper、Purpur 及 Paper 系列的其他版本、Spigot），包括模组包服务器。原版服务器没有 BlueMap 构建版本，选项卡会显示此信息。

## 谁可以看到地图

地图仅通过面板提供服务，并受其登录验证保护：任何能在面板中查看服务器的人都可以打开其地图，其他人则不行。BlueMap 的端口本身不应暴露给互联网（[端口一览](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)）。开启或关闭地图需要服务器的 **设置** 权限（[用户与角色](/docs/users-and-roles/#per-server-permissions)）。

当面板本身在 Docker 中运行时，它会访问服务器容器内的 BlueMap；[README](https://github.com/anefzaoui/minecraft-server-manager#installation) 文件解释了反向代理设置的详细信息。

## 关闭地图

**禁用地图** 会移除面板安装的 BlueMap jar 文件并释放其端口，同样从下次重启开始生效。世界本身不受影响；渲染的地图图块会保留在服务器文件夹中，直到你在 **文件** 选项卡中删除它们。

相关：[世界与文件](/docs/worlds-and-files/)、[邀请与状态页面](/docs/invites-and-status-page/)。
