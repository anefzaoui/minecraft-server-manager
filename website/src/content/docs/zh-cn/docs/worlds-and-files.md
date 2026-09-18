---
title: '世界和文件'
description: '“世界”页面用于管理您服务器的世界数据：切换活动世界、上传或下载世界。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← 返回文档索引](/docs/)

## World

**World** 页面用于管理服务器的世界数据：切换活动世界、上传或下载世界。

![Worlds](/docs/images/worlds.png)

## 文件管理器

在服务器的 **World** 部分下，**Files** 标签页是该服务器数据目录的完整浏览器内文件管理器。列出、读取、编辑、创建、重命名、移动、复制、删除和上传文件：您通常通过 SSH 完成的所有操作，现在都可以通过浏览器完成。

![File manager](/docs/images/server-files.png)

文本文件将在编辑器中打开，但有 2 MB 的限制；较大的文件可以下载。上传支持一次上传多个文件。

### 保持在沙盒内

所有文件操作都限制在服务器自己的数据目录内。面板会解析每个路径并拒绝任何试图逃逸的操作：`..` 遍历、绝对路径，甚至是指向目录外的符号链接（包括尚未存在的悬空链接）。模组或插件无法通过链接欺骗文件管理器在主机上的其他位置进行读写。

## Mods

对于安装了模组的服务器，**Mods** 标签页（在服务器侧边栏中有一个单独的组）用于管理模组集：浏览和添加模组，以及查看已安装的模组。模组和模组包的更新会显示在 [Updates](/docs/updates/) 页面上。

### 添加模组

![Mods](/docs/images/mods.png)

四种添加方式，均来自 Mods 标签页的工具栏：

- **搜索模组** - 搜索 **Modrinth 或 CurseForge**（在“设置 → API 密钥”中存储 API 密钥后，“CurseForge”选项卡会显示），在插件服务器上还可以搜索 **Hangar**（PaperMC 自有的插件注册表）和 **SpigotMC**（通过 Spiget 的 CDN 代理）- 这两者都无需 API 密钥。所有搜索结果都会根据服务器的加载器和 Minecraft 版本进行过滤；Quilt 服务器也会自动显示标记为 fabric 的构建，因为 Quilt 可以运行 Fabric 模组。已安装在服务器上的模组会显示一个 **Installed** 徽章。如果 CurseForge 作者禁止自动下载 - 或者 SpigotMC 资源托管在站外 - 面板会提前告知并提供 **Open page** + **Upload jar** 的选项，而不是在安装过程中失败。

  ![Hangar search](/docs/images/mods-search-hangar.png)

- **导入 zip** - 一个按钮，三种格式，自动检测：
  - **Modrinth 模组包 (`.mrpack`)**：每个固定的文件都会通过哈希查找规范化回其 Modrinth 项目（因此导入的模组会保留真实名称、图标，并保持可更新状态；Modrinth 未知的安装文件将从模组包自身的 URL 安装），在下载过程中会根据模组包的 sha512 校验和进行验证，并显示适合的验证结果。客户端专用文件会被可见地跳过，并且可以应用覆盖树（`overrides/`，然后是 `server-overrides/` - 服务器特定的副本优先）。

    ![mrpack import](/docs/images/mrpack-import.png)

  - **CurseForge 模组包导出**（CurseForge 应用生成的 zip，包含 `manifest.json`）：每个固定的模组都会批量解析，并显示警告（加载器/MC 版本与此服务器不匹配、模组已在 CurseForge 上下架、需要手动下载的模组），并以真实的进度进行安装。模组包的 `overrides/`（配置文件、脚本）也可以选择性地应用 - 任何将被覆盖的文件都会先备份到服务器文件夹内的 `.import-backups/<timestamp>/`。
  - **您自己收集的 jar 文件组成的普通 zip**：每个 jar 文件都会被识别（Modrinth 哈希匹配 → CurseForge 指纹 → jar 文件自身的元数据），并与服务器进行比较 - _匹配 / 加载器错误 / MC 版本错误 / 已安装 / 未识别_ - 因此您可以在任何安装之前选择真正属于的内容。
- **通过链接添加** - 粘贴几乎任何内容：Modrinth、CurseForge、Hangar 或 SpigotMC 项目页面，GitHub 仓库或发布 URL（仅提供 `owner/repo` 也可以 - GitHub 安装会优先选择最新的稳定版本并跳过 `-sources`/`-javadoc` 副文件名 jar），一个裸的 Modrinth slug，或任何直接的 `.jar` URL。面板会解析适合服务器加载器和 MC 版本的正确构建。

  ![Add by link](/docs/images/mods-add-by-link.png)

- **上传 jar**（来自搜索回退或待下载解析器）- 上传的 jar 文件会以相同的方式进行识别，因此它们会保留其真实名称、版本、图标，并可进行更新检查。

每次从注册表中安装都会在下载时进行**校验和验证**：流会根据注册表发布的最高强度的摘要（sha512 → sha256 → sha1 → md5）进行检查，不匹配则在任何文件落地服务器之前中止。

整个 zip 文件（包括 `.mrpack`）也可以**创建服务器**：在向导的 _From modpack_ 标签页中，上传它，模组包清单（或识别出的 jar 文件中的多数投票）将填充加载器、Minecraft 版本和加载器版本。
