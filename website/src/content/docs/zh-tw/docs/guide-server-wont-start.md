---
title: '您的 Minecraft 伺服器無法啟動'
description: 'Minecraft 伺服器無法啟動的疑難排解，依可能性高低排序：日誌、Java 版本、記憶體、EULA 與連接埠，以及模組。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← 返回文件索引](/docs/)

依照此列表的順序進行。列表的順序是根據每個項目成為問題答案的頻率排列，前四項涵蓋了大多數情況。

## 1. 閱讀最後二十行，而不是第一行

捲動到日誌的**結尾**。Java 堆疊追蹤（stack trace）是從最內層開始列印的，所以文字牆的最上方是最不重要的部分。您要找的是最後一個 `Caused by:` 行以及它之後的內容。這一行通常就指出了問題。

有兩種標記可以告訴您目前的位置：

- `Exception in thread "main"` 或結尾附近的當機報告路徑表示遊戲本身失敗了。
- 日誌在某一行中間突然停止，沒有任何例外，這表示有外部程序終止了該程序。請跳至第 3 點。

## 2. UnsupportedClassVersionError 表示 Java 版本錯誤

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Class file 52 是 Java 8，60 是 16，61 是 17，65 是 21，69 是 25。此訊息表示伺服器需要比目前執行的 Java 版本更新的版本；反之，舊的模組包在新 Java 上執行，通常會出現 mixin 或反射錯誤。

| Minecraft 版本    | Java |
| ----------------- | ---- |
| 1.16.5 及更早版本 | 8    |
| 1.17              | 16   |
| 1.18 和 1.19      | 17   |
| 1.20 至 1.20.4    | 17   |
| 1.20.5 至 1.21.x  | 21   |
| 26.1 及更新版本   | 25   |

舊的模組包確實需要 Java 8。在這裡，更新的版本不一定更好。

## 3. 退出代碼 137 是核心問題，不是模組

日誌在句子中間停止，沒有當機報告，且容器回報 137。這是記憶體不足終止（out-of-memory kill）：程序請求的記憶體已超出機器的可用記憶體，因此被終止。

幾乎總是 Java 堆（heap）被設定為與機器的記憶體相同。堆需要機器的記憶體**減去** JVM 本身的額外開銷，對於有模組的伺服器來說，這大約是 0.5 到 1.5 GB。請減少堆的大小，或增加機器的記憶體。 [伺服器需要多少 RAM](/docs/guide-server-memory/) 提供了相關數字。

## 4. EULA 和端口

兩個經典問題，解決方法都只需一行：

- `You need to agree to the EULA in order to run the server.` 將 `eula=true` 設定在 `eula.txt` 中，或使用您的設定所使用的環境變數。
- `Address already in use` 或 `FAILED TO BIND TO PORT`。表示有其他程序佔用了 25565 端口，通常是同一個伺服器的先前副本未完全停止。請找到並停止它，而不是更改端口，否則您將會有兩個伺服器。

## 5. 模組缺少其依賴項

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Fabric 模組絕大多數需要 Fabric API 作為單獨的檔案。Forge 和 NeoForge 模組會在錯誤訊息中列出其依賴項。安裝指定的版本，而不是最新的版本：「requires 0.91.x」表示需要該版本，而 0.92 會導致相同的檢查失敗。

有時缺少的依賴項是載入器本身：

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

解決方法是更新載入器版本，而不是更換模組。「47.4.14 or above」表示從該版本開始的任何版本，而 Forge 並非發布所有數字版本，因此要安裝的版本可能是下一個可用的版本。在模組包（modpack）上，請先更新模組包：如果模組包本身的載入器版本對其模組來說太舊，這是其作者需要修復的錯誤。

## 6. 模組適用於錯誤的載入器或版本

不同載入器的 jar 檔案不會禮貌地失敗。預期會出現 mixin 錯誤、`NoClassDefFoundError`，或是在您從未聽過的類別中當機。檢查 jar 的頁面：載入器和 Minecraft 版本都必須完全匹配。就模組而言，1.20.1 和 1.20.4 是不同的遊戲。

## 7. 世界來自較新的版本

```
This world was created by a newer version of Minecraft
```

世界可以向前升級，但不能向後降級。恢復升級前的備份，或執行世界預期的版本。沒有可以保持區塊（chunks）完整性的降級路徑。

## 當伺服器運行數週後當機

這是不同的問題，通常有不同的答案：

- **負載下當機**，計時器顯示長時間停頓：這是垃圾回收（garbage collection）問題，請在安裝模組前檢查堆大小。
- **在世界的同一點當機**：這是區塊損壞或實體（entity）損壞。當機報告通常會指出座標。
- **更新後立即當機**：更新的模組是嫌疑對象，即使追蹤指向其他地方。將其回滾並觀察。
- **之前運行正常，重啟後當機**：檢查磁碟。磁碟已滿會產生異常且誤導性的錯誤。

## 尋求真正有幫助的協助

張貼**整個日誌**，而不是最後一行，並說明在當機前您做了哪些更改。請將日誌貼到專門的網站，例如 [mclo.gs](https://mclo.gs)，而不是貼在聊天中。請包含 Minecraft 版本、載入器、模組包及其版本，以及伺服器配置的堆大小。包含這四項資訊的報告通常只需一次回覆即可獲得解答；缺少這些資訊則需要五次。

## 在 Minecraft Server Manager 中

當機是從容器本身的退出狀態偵測到的，因此在凌晨三點關閉的伺服器會記錄其日誌摘錄，而不是在第二天被發現。此頁面上的常見問題（EULA、Java 版本錯誤、來自較新版本的世界、端口已被佔用、Java 記憶體不足）會在日誌中被識別，並在歷史記錄條目中說明如何處理，自動重啟則會忽略這些問題，因為重啟無法解決它們。當機報告會在接收時進行解析：例外情況會被高亮顯示，堆疊追蹤（stack trace）可以摺疊，日誌中出現的模組會被列為嫌疑對象。

當您需要協助時，可以從其卡片分享任何報告到 mclo.gs（需要確認，因為貼文是公開的），並且主控台的**下載**選單會將所有日誌檔案打包成一個 zip 檔，因此「貼上整個日誌」變成了一個下載操作，而不是考古挖掘。記憶體不足的終止會被記錄為記憶體不足終止，這可以省去通常需要一小時來歸咎於模組的時間。如果確實有其他程序佔用了端口，則在**設定 → 設定**中的**遊戲端口**卡片會將伺服器移至一個空閒端口。

過舊的載入器可以從伺服器的**版本**標籤頁進行更改，該標籤頁會在重建伺服器前檢查建置是否存在並進行備份（[更改模組載入器版本](/docs/updates/#changing-the-mod-loader-version)）。

相關：[伺服器需要多少 RAM](/docs/guide-server-memory/)、[選擇載入器](/docs/guide-choosing-a-loader/)、[創建和管理伺服器](/docs/servers/)。
