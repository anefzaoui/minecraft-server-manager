---
title: 'Modpacks'
description: '将 CurseForge、Modrinth、FTB 和 GT New Horizons 的 Modpacks 安装为服务器，并始终固定到确切的 Modpack 版本。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← 返回文档索引](/docs/)

**Modpacks** 页面（以及[创建向导](/docs/servers/)中的**从 Modpack 安装**选项卡）会将 modpack 安装为服务器，并且始终**固定到确切的版本**，因此重启永远不会在您不知情的情况下升级 modpack。

![Modpacks](/docs/images/modpacks.png)

## 支持的平台

- **CurseForge**: 按名称搜索。需要 CurseForge API 密钥（在**设置 → API 密钥**下添加）。
- **Modrinth**: 按名称搜索。
- **FTB**: Feed The Beast modpack，仅通过 API 安装（需要数字 pack ID 和显式 version ID）。面板目前还不会检查 FTB modpack 的更新。
- **GT New Horizons**: 1.7.10 专家级 modpack，从 GTNH 自有发布索引安装。GTNH 为每个 modpack 版本选择其 Java 运行时（2.8.0+ 版本通过捆绑的 lwjgl3ify 补丁在**Java 25**上运行，旧版本在 Java 21 或 17 上运行），并且创建向导会将服务器的 RAM 和磁盘调整到合理的最小值。
- **自定义 zip**: 完全不是已发布的 modpack。上传一个**CurseForge modpack 导出文件**（CurseForge 应用为手动选择的模组集生成的包含 `manifest.json` 的 zip 文件）、一个**Modrinth `.mrpack`** 文件，或者**任何包含 mod jar 的 zip 文件**。面板会批量解析 manifest（或通过哈希/指纹/元数据识别每个 jar），预览兼容的模组，并一次性安装所有内容，包括 modpack 的 `overrides/` 配置文件（如果您选择启用）。作者不允许自动下载的模组将显示为浏览器链接和手动上传插槽，而不是导致安装失败。

## 固定版本的工作原理

当您选择一个 modpack 时，面板会解析确切的版本，记录下来，然后进行安装。在**更新**页面上，当有新版本可用时会通知您（除非服务器的[更新策略](#update-policy)设置为**仅手动**）；升级是一个经过深思熟虑、有保护措施的操作，包含更新前的备份和回滚。稳定版追踪服务器永远不会提供测试版。服务器自身的**版本**选项卡回答了另一半问题：它实际拥有的模组可以跟随哪些未来的 Minecraft 版本（[更新](/docs/updates/#minecraft-version-compatibility)）。

Mod 加载器版本也随 modpack 一起提供：服务器安装 modpack 声明的 Forge、NeoForge 或 Fabric 版本。如果一个 Forge 或 Fabric CurseForge modpack 声明的版本对其自身模组来说太旧，**版本**选项卡可以覆盖它，直到 modpack 被修复；modpack 更新会移除覆盖，因为新版本会声明自己的版本（[更改 Mod 加载器版本](/docs/updates/#changing-the-mod-loader-version)）。

在非常旧的面板版本（0.9.7 之前）上创建的服务器可能会处于_未固定_状态，这意味着容器镜像在每次启动时都会悄悄安装最新的 modpack 版本。面板现在会在启动时修复这些：它会将每个服务器固定到实际安装的版本（从面板自己的记录或镜像的安装 manifest 中读取，绝不是新解析的“latest”），并记录一个事件。如果它无法确定已安装的版本，服务器的设置页面会显示一个警告，并附带一个**选择版本…**按钮（适用于 CurseForge、Modrinth 和 GTNH modpack），该按钮会打开[版本选择器](#changing-the-pack-version)；任何尝试保存未固定 modpack 配置的操作都会被直接拒绝。

## 更新策略

每个服务器在其**设置 → 配置**选项卡上都有一个**更新策略**卡片，所有三个选项都名副其实：

- **仅手动**（默认）：没有任何东西会自行更改，服务器将完全不出现在更新徽章和更新页面上。这是“别管我”模式：非常适合您手动调整或导入的、您永远不想被触碰的 modpack。它不会锁定版本：[**更改版本…**](#changing-the-pack-version) 在所有策略下都可用。要接收新版本通知并一键应用，请选择**通知我**。
- **通知我**：每日检查会在更新页面和徽章上显示可用更新；应用更新始终需要您手动点击。
- **自动更新**：在计划的每日检查后，待处理的**modpack**更新将通过与手动升级相同的保护路径进行应用：更新前备份、健康状况监控，以及在新版本启动失败时自动回滚。会跳过所有会导致服务器迁移到不同 Minecraft 版本的更新，并记录一个事件：面板拒绝为您做出永久转换世界的决定。手动**立即检查**按钮仅执行检查；它们从不触发自动更新。

## 升级 Modpack

从已固定的服务器，您可以一次性升级到新版本。面板会先进行备份，切换固定版本，重建服务器（如果新版本需要不同的运行时则重新解析 Java），并监控首次启动，为像 GTNH 这样下载几 GB 数据并在首次启动时构建包含数百个模组的世界的大型 modpack 提供充足的时间窗口。

## 更改 Modpack 版本

要运行特定版本，无论是更新还是更旧的版本，请使用服务器**概览**选项卡上 modpack 卡片中的**更改版本…**。在**Modpacks**页面上，打开已安装 modpack 的卡片会提供相同的选择：在下拉列表中选择一个版本，然后点击**切换到此版本**。两者都需要服务器的**内容**权限，并且都适用于 CurseForge、Modrinth 和 GTNH modpack（FTB modpack 尚无版本列表）。列表显示 CurseForge 和 Modrinth 的 25 个最新版本，以及 GTNH 的所有发布版本。

切换过程与升级过程相同，都经过保护路径：更新前备份、新的固定版本、重建以及受监控的首次启动，如果服务器未能正常启动，则提供一键回滚。您的自定义模组会被保留，您禁用的 modpack 模组也会被保留，以及 modpack 的其他安装设置（强制添加的模组、要忽略的文件、额外项目）。安装不同的 modpack 会重置这些设置，因为它们只对创建它们的 modpack 有意义。

每个版本都会列出其运行的 Minecraft 版本，并与您的世界最后保存的版本进行比较：

- **相同的 Minecraft 版本**：在正常确认后切换。回退到旧的 modpack 版本可能会导致该版本没有的模组的方块和物品丢失，因此无论如何备份都会保留在备份选项卡中。
- **更新的 Minecraft 版本**：在发出警告“世界将被永久转换”的确认后允许。首次备份是返回旧世界的唯一途径。
- **旧的 Minecraft 版本**：不可用。Minecraft 无法加载比上次保存世界时使用的版本更旧的版本，因此面板会拒绝操作，而不是留下一个启动时崩溃的服务器。
