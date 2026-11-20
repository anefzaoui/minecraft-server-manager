---
title: '世界与文件'
description: '世界库、世界上传与切换、模组与插件标签页，以及浏览器内文件管理器。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← 返回文档索引](/docs/)

## World

**Worlds** 页面是世界库：所有已保存的世界集中一处。**上传世界** 会接收一个 `.zip` 或 `.tar` 压缩包并自动从中找到世界；**保存到库** 会快照服务器的实时世界（在服务器运行时即可工作）；而库中的每个世界都可以通过 **安装到…** 下载或安装到任何服务器。安装时，可以选择替换服务器的当前世界（服务器必须已停止，并且当前世界会先被备份），或者将其 alongside 安装，以便稍后激活。每次安装前都会进行兼容性检查。

服务器自身的 **World → Worlds** 标签页会列出该服务器上的世界。从那里，您可以激活另一个世界（服务器必须已停止）、下载、复制、重命名或[收缩](/docs/world-shrink/)世界、将其复制到另一台服务器、删除未激活的世界，以及使用新的、保留的或自定义的种子重置当前激活的世界（会先提供安全备份）。下方是相同的库，带有 **安装到此处** 按钮。

![Worlds](/docs/images/worlds.png)

## 文件管理器

在服务器的 **World** 部分下，**Files** 标签页是一个完整的浏览器内文件管理器，用于管理该服务器的数据目录。您可以列出、读取、编辑、重命名、移动、复制、删除和上传文件，创建文件夹，以及在文件夹下使用 **在文件中查找** 搜索文本内容：您通常通过 SSH 完成的所有操作，现在都可以通过浏览器完成。

![File manager](/docs/images/server-files.png)

文本文件会在编辑器中打开，有 8 MB 的限制；较大的文件可以下载。上传最多支持一次上传 20 个文件。

### 保持在沙盒内

所有文件操作都限制在服务器自己的数据目录内。面板会解析每个路径并拒绝任何试图逃逸的操作：`..` 遍历、绝对路径，甚至是指向目录外的符号链接（包括尚未存在的悬空链接）。模组或插件无法通过链接欺骗文件管理器读取或写入主机上的其他位置。

## Mods

对于安装了模组和插件的服务器，**Mods** 标签页（在服务器侧边栏中有一个独立的组）用于管理模组集：浏览和添加模组，并查看已安装的模组。对于每个已安装的模组，您可以更新它（或忽略该更新）、[回滚](/docs/updates/#undoing-a-mod-update)它、禁用它或移除它；**全部更新** 按钮可以一次性应用所有可用更新并重启服务器。模组和模组包的更新也会显示在 [Updates](/docs/updates/) 页面上。

### 添加模组

![Mods](/docs/images/mods.png)

有四种添加方式，均从 Mods 标签页的工具栏进行：

- **搜索模组**：搜索 **Modrinth 或 CurseForge**（当在 **Settings → API Keys** 下存储了 API 密钥后，会出现 CurseForge 选项卡），对于插件服务器，还可以搜索 **Hangar**（PaperMC 自带的插件注册表）和 **SpigotMC**（通过 Spiget 的 CDN 代理），这两种方式无需 API 密钥。**Datapacks** 标签页会搜索 Modrinth 上的数据包。所有搜索结果都会根据服务器的加载器和 Minecraft 版本进行过滤（一个复选框还可以显示未列为兼容但可能可用的版本，风险自负）；Quilt 服务器会自动显示 fabric 标签的版本，因为 Quilt 可以运行 Fabric 模组。服务器上已有的结果会显示 **已安装** 徽章。如果 CurseForge 作者禁止自动下载（或 SpigotMC 资源托管在站外），面板会提前告知并提供 **打开 CurseForge**（或 **打开 SpigotMC**）+ **上传 Jar** 的路径，而不是在安装过程中失败。

  ![Hangar search](/docs/images/mods-search-hangar.png)

- **导入 Zip**：一个按钮，三种格式，自动检测：
  - **Modrinth 模组包 (`.mrpack`)**：所有固定的文件都会通过哈希查找重新映射回其 Modrinth 项目（因此导入的模组会保留真实名称、图标，并保持可更新状态；Modrinth 未知的安装文件将从包的 URL 安装），在下载过程中根据包的 sha512 校验和进行验证，并显示匹配结果。仅客户端的文件会被跳过并可见，并且可以应用覆盖树（`overrides/`，然后是 `server-overrides/`；服务器特定的副本优先）。

    ![mrpack import](/docs/images/mrpack-import.png)

  - **CurseForge 模组包导出**（CurseForge 应用生成的 zip 包，包含 `manifest.json`）：所有固定的模组都会批量解析，并显示警告（加载器/MC 版本与此服务器不匹配、文件已不在 CurseForge 上、需要手动下载的模组），然后以真实的进度条显示安装过程。包的 `overrides/`（配置文件、脚本）也可以选择性地应用；任何将被覆盖的文件都会先备份到服务器文件夹内的 `.import-backups/<timestamp>/` 目录中。
  - **您自己收集的 jar 文件组成的普通 zip 包**：每个 jar 文件都会被识别（Modrinth 哈希匹配 → CurseForge 指纹 → jar 文件自身的元数据），并根据服务器进行判断（_匹配 / 加载器错误 / MC 版本错误 / 已安装 / 未识别_），因此您可以在任何文件安装前选择真正需要的文件。
- **按 URL 添加**：粘贴几乎任何内容：Modrinth、CurseForge、Hangar 或 SpigotMC 项目页面，一个 GitHub 仓库或发布 URL（仅提供 `owner/repo` 也可以；GitHub 安装优先选择最新的稳定发布版本，并跳过 `-sources`/`-javadoc` 副文件 jar），一个裸露的 Modrinth slug，或任何直接的 `.jar` URL。面板会解析适合服务器加载器和 MC 版本的正确构建。

  ![Add by link](/docs/images/mods-add-by-link.png)

- **上传 Jar**（来自搜索回退或待下载解析器）：上传的 jar 文件会以相同方式识别，因此它们会保留真实名称、版本、图标，并变得可更新。

所有注册表安装都会在**下载时进行校验和验证**：下载流会与注册表发布的最高强度的摘要（sha512 → sha256 → sha1 → md5）进行比对，如果校验和不匹配，将在任何文件落地服务器之前中止。

整个 zip 包（包括 `.mrpack`）也可以用来**创建服务器**：在向导的 **从模组包创建** 标签页中，上传它，包清单（或根据识别出的 jar 文件进行多数投票）将自动填充加载器、Minecraft 版本和加载器版本。
