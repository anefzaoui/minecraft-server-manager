---
title: '即時地圖'
description: '一鍵啟用伺服器世界的 BlueMap 即時 3D 地圖，僅透過面板登入提供服務。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← 返回文件索引](/docs/)

伺服器的「**世界 → 地圖**」分頁會顯示一個由 [BlueMap](https://bluemap.bluecolored.de/)（免費開源）繪製的、可縮放的 3D 世界即時地圖，包含玩家位置和所有維度。面板會安裝、設定並託管它；您無需為它開啟連接埠或編輯設定檔。

## 啟用它

1. 開啟伺服器，然後前往「**世界 → 地圖**」。
2. 按一下「**啟用即時地圖**」。面板會從 Modrinth 安裝與伺服器載入器和 Minecraft 版本相符的 BlueMap 版本，為您接受 BlueMap 的資源下載，並為其選擇一個免費連接埠。
3. 重新啟動伺服器（變更將在下次啟動時套用，且伺服器會標記為等待啟動）。

BlueMap 會在背景渲染，因此新地圖需要幾分鐘才能繪製第一批圖塊。在此之前，該分頁會顯示地圖尚未就緒，並會自行再次檢查。一旦就緒，「**全螢幕**」會在獨立的瀏覽器分頁中開啟地圖。

它適用於裝有模組載入器（Fabric、Quilt、Forge、NeoForge）的伺服器，以及外掛伺服器（Paper、Purpur 及 Paper 系列的其他版本、Spigot），包括模組包伺服器。原版伺服器沒有 BlueMap 版本，該分頁會顯示此情況。

## 誰可以看到它

地圖僅透過面板託管，並受其登入驗證保護：任何能在面板中檢視伺服器的人都可以開啟其地圖，其他人則不行。BlueMap 的連接埠本身不應向網際網路公開（[連接埠概覽](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)）。啟用或停用地圖需要伺服器的「**設定**」權限（[使用者與角色](/docs/users-and-roles/#per-server-permissions)）。

當面板本身在 Docker 中執行時，它會存取伺服器容器內的 BlueMap；[README](https://github.com/anefzaoui/minecraft-server-manager#installation) 說明了反向代理設定的詳細資訊。

## 停用它

「**停用地圖**」會移除面板安裝的 BlueMap jar 並釋放其連接埠，同樣從下次重新啟動開始。世界本身不受影響；渲染的地圖圖塊會保留在伺服器的資料夾中，直到您在「**檔案**」分頁中刪除它們。

相關：[世界與檔案](/docs/worlds-and-files/)、[邀請與狀態頁面](/docs/invites-and-status-page/)。
