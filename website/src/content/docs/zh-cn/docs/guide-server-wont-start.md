---
title: '您的 Minecraft 服务器无法启动'
description: '无法启动的 Minecraft 服务器，按可能性排序的修复方法：日志、Java 版本、内存、EULA 和端口，以及 Mod。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← 返回文档索引](/docs/)

按此列表顺序查看。列表按问题出现频率排序，前四项涵盖了绝大多数情况。

## 1. 阅读最后二十行，而不是最前面

滚动到日志的**末尾**。Java 堆栈跟踪是先打印最内层的，所以文本墙的顶部是最不重要的部分。您需要的是最后一行 `Caused by:` 以及它后面的内容。这一行通常就能说明问题。

有两种形状可以告诉您当前的位置：

- 日志末尾附近的 `Exception in thread "main"` 或崩溃报告路径表示游戏本身失败了。
- 日志在某一行中间停止，根本没有异常，这表示有外部进程终止了该进程。请跳转到第 3 点。

## 2. UnsupportedClassVersionError 表示 Java 版本错误

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Class 文件 52 是 Java 8，60 是 16，61 是 17，65 是 21，69 是 25。此消息表示服务器需要比当前运行版本更新的 Java 版本；反之，旧的 Mod 包在新 Java 上运行，通常会因 mixin 或反射错误而失败。

| Minecraft 版本    | Java |
| ----------------- | ---- |
| 1.16.5 及更早版本 | 8    |
| 1.17              | 16   |
| 1.18 和 1.19      | 17   |
| 1.20 至 1.20.4    | 17   |
| 1.20.5 至 1.21.x  | 21   |
| 26.1 及更高版本   | 25   |

旧的 Mod 包确实需要 Java 8。新版本不一定更好。

## 3. 退出代码 137 是内核问题，不是 Mod 问题

日志在句子中间停止，没有崩溃报告，并且容器报告退出代码 137。这是内存不足导致的终止：进程请求的内存超出了机器可用内存，因此被终止了。

几乎总是 Java 堆内存被设置为与机器内存相同的值。堆内存需要机器内存**减去** JVM 自身的开销，对于装有 Mod 的服务器来说，这通常是 0.5 到 1.5 GB。降低堆内存大小，或增加机器内存。 [服务器需要多少 RAM](/docs/guide-server-memory/) 中有详细的数字。

## 4. EULA 和端口问题

两个经典问题，一句话解决：

- `You need to agree to the EULA in order to run the server.` 将 `eula=true` 设置在 `eula.txt` 中，或使用您的设置所使用的环境变量。
- `Address already in use` 或 `FAILED TO BIND TO PORT`。其他进程占用了 25565 端口，通常是同一个服务器的先前副本未完全停止。找到并停止它，而不是更改端口，否则您将有两个服务器。

## 5. Mod 缺少依赖项

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Fabric Mod 绝大多数需要 Fabric API 作为单独的文件。Forge 和 NeoForge Mod 会在错误信息中列出它们的依赖项。安装指定的版本，而不是最新的版本：“requires 0.91.x” 表示需要该版本，0.92 版本会因相同的检查而失败。

有时缺失的依赖项是加载器本身：

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

解决方法是更新加载器版本，而不是更改 Mod。 "47.4.14 or above" 表示从该版本开始的任何版本，而 Forge 不会发布所有数字，因此需要安装的版本可能是下一个版本。在 Mod 包中，先更新 Mod 包：如果 Mod 包自身的加载器版本过旧，无法满足 Mod 的要求，这是 Mod 包作者需要修复的 Bug。

## 6. Mod 加载器或版本不匹配

不同加载器的 Jar 文件不会礼貌地失败。可能会出现 mixin 错误、`NoClassDefFoundError`，或者在您从未听说过的类中崩溃。检查 Jar 文件的页面：加载器和 Minecraft 版本都必须完全匹配。就 Mod 而言，1.20.1 和 1.20.4 是不同的游戏。

## 7. 世界来自更新的版本

```
This world was created by a newer version of Minecraft
```

世界只能向前升级，不能向后降级。恢复升级前的备份，或运行世界所期望的版本。没有能保留区块完整性的降级方法。

## 在运行数周后崩溃

这是另一个问题，通常有不同的答案：

- **在负载下崩溃**，性能监控显示长时间暂停：这是垃圾回收问题，所以先检查 Mod 之前的堆内存大小。
- **在世界的同一位置崩溃**：这是区块损坏或实体损坏。崩溃报告通常会显示坐标。
- **更新后立即崩溃**：更新的 Mod 是嫌疑对象，即使堆栈跟踪指向其他地方。回滚它并观察。
- **重启后崩溃，之前运行正常**：检查磁盘。磁盘已满会产生看似严重但具有误导性的错误。

## 获取真正有帮助的帮助

发布**完整的日志**，而不是最后一行，并说明在崩溃之前您做了什么更改。将其粘贴到专门的网站，例如 [mclo.gs](https://mclo.gs)，而不是直接粘贴到聊天中。包括 Minecraft 版本、加载器、Mod 包及其版本，以及服务器分配的堆内存大小。包含这四项信息的报告通常只需一次回复即可得到解答；缺少这些信息则需要五次。

## 在 Minecraft Server Manager 中

崩溃会从容器自身的退出中检测到，因此在凌晨三点崩溃的服务器会记录其日志摘要，而不是等到第二天再发现。本页上常见的可疑原因（EULA、Java 版本错误、来自新版本的世界、端口已被占用、Java 内存不足）会在日志中被识别，并在历史记录条目中说明如何处理，自动重启会忽略这些问题，因为重启无法解决它们。崩溃报告会在接收时进行解析：异常会被高亮显示，堆栈跟踪可以折叠，并且在堆栈跟踪中出现的 Mod 会被列为嫌疑对象。

当您需要帮助时，可以从其卡片中将任何报告共享到 mclo.gs（需要确认，因为粘贴是公开的），并且控制台的**下载**菜单会将所有日志文件打包成一个 zip 文件，因此“发布完整日志”是一个下载操作，而不是考古挖掘。内存不足的终止会被记录为内存不足终止，这可以节省通常需要一小时来排查 Mod 问题的宝贵时间。如果确实有其他进程占用了端口，**设置 → 配置** 中的**游戏端口**卡片会将服务器迁移到一个空闲端口。

过时的加载器可以从服务器的**版本**选项卡中更改，该选项会检查构建是否存在，并在重建服务器之前进行备份（[更改 Mod 加载器版本](/docs/updates/#changing-the-mod-loader-version)）。

相关：[服务器需要多少 RAM](/docs/guide-server-memory/)、[选择加载器](/docs/guide-choosing-a-loader/)、[创建和管理服务器](/docs/servers/)。
