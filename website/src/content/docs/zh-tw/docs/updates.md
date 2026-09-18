---
title: '更新'
description: '更新頁面可讓您一站式追蹤整個伺服器群組中過時的項目：'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← 返回文件索引](/docs/)

**更新**頁面可集中追蹤您所有伺服器中的過時項目：

- **模組包**版本（[模組包](/docs/modpacks/)）與 Modrinth / CurseForge / GTNH 發行索引的比較。
- 您自行新增的**自訂內容** — 模組、資料包、資源包、外掛 — 各自與其來源的比較：Modrinth、CurseForge、Hangar、SpigotMC (Spiget) 或 GitHub Releases。GitHub 查詢使用 ETag 再驗證，因此每日檢查對其速率限制的影響極小。
- **Docker 映像檔**過時情況：每個運行中容器的映像檔 ID 與剛拉取的標籤（在相同標籤的伺服器之間去重）的比較，提供僅限重建的升級。
- **獨立版本釘選**：對於沒有受管理套件的伺服器，將明確的 `mc_version` 釘選與 Mojang 的資訊清單進行比較，並將明確的載入器建置環境變數（`PAPER_BUILD`、`FORGE_VERSION` 等）與載入器的登錄進行比較。Paper 建置來自 PaperMC 的目前 **Fill v3 API**（舊版 v2 端點已停止接收新的 Minecraft 版本）。

![更新](/docs/images/updates.png)

## 如何運作

面板會將每個伺服器的釘選版本與上游來源進行比較，並列出任何有新發行的項目。在 [儀表板](/docs/dashboard/) 的「可用更新」圖塊中也會顯示符合的計數。

檢查會按需執行，也可排程（[排程](/docs/schedules/)）。更新**政策**是每個伺服器獨立設定：您可以決定面板僅通知您，還是讓所有操作保持手動。

## 套用更新

更新絕不會是靜默的。當您選擇升級套件時，面板會：

1. 進行**更新前備份**（以便可復原；每個伺服器會保留最後 10 個更新前備份）。
2. 重新釘選確切的新版本。
3. 重建容器，並在需要時重新解析 Java 運行環境。
4. 監控首次啟動，並設有每個平台的時程預算。

如果無法健康啟動，則會復原至更新前備份。穩定的追蹤伺服器絕不會收到 Beta 版本，且變更日誌連結會指向來源提供變更日誌的實際版本差異處。如果設定了 Discord [通知](/docs/integrations/)整合，失敗的更新也會觸發通知。
