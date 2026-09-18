---
title: '世界與檔案'
description: '「世界」頁面用於管理您伺服器中的世界資料：切換使用中的世界、上傳世界或下載世界。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← 返回文件索引](/docs/)

## 世界

**世界**頁面用於管理伺服器中的世界資料：切換使用中的世界、上傳或下載世界。

![Worlds](/docs/images/worlds.png)

## 檔案管理器

在伺服器的「**世界**」區段下，「**檔案**」標籤頁是一個完整的瀏覽器內檔案管理器，用於管理該伺服器資料目錄中的檔案。您可以列出、讀取、編輯、建立、重新命名、移動、複製、刪除和上傳檔案：所有您平常透過 SSH 操作的內容，現在都能在瀏覽器中完成。

![File manager](/docs/images/server-files.png)

文字檔案會在編輯器中開啟，但有 2 MB 的限制；較大的檔案可以下載。上傳功能支援一次上傳多個檔案。

### 保持在沙盒內

所有檔案操作都僅限於伺服器自身的資料目錄。面板會解析每個路徑，並拒絕任何試圖逃離目錄的操作：例如 `..` 遍歷、絕對路徑，甚至是指向目錄外的符號連結（包括尚未存在的懸空連結）。這可防止模組或外掛程式透過連結來欺騙檔案管理器，進而在主機的其他位置讀取或寫入檔案。

## 模組

對於安裝了模組的伺服器，「**模組**」標籤頁（位於伺服器側邊欄的獨立群組）用於管理模組集：瀏覽和新增模組，以及查看已安裝的模組。模組和模組包的更新會在「[更新](/docs/updates/)」頁面上顯示。

### 新增模組

![Mods](/docs/images/mods.png)

有四種方式可以新增模組，全部都在「模組」標籤頁的工具列中：

- **搜尋模組** - 搜尋 **Modrinth 或 CurseForge**（當在「設定」→「API 金鑰」中儲存了 API 金鑰後，會出現 CurseForge 的選項），在插件伺服器上還能搜尋 **Hangar**（PaperMC 自有的插件註冊中心）和 **SpigotMC**（透過 Spiget 的 CDN 代理）- 這兩者都不需要金鑰。所有搜尋結果都會根據伺服器的載入器和 Minecraft 版本進行篩選；Quilt 伺服器也會自動顯示標記為 Fabric 的建置版本，因為 Quilt 可以執行 Fabric 模組。已安裝在伺服器上的結果會顯示「**已安裝**」標記。如果 CurseForge 的作者不允許自動下載 - 或 SpigotMC 的資源託管在站外 - 面板會預先告知並提供「**開啟頁面**」+「**上傳 jar**」的選項，而不是在安裝過程中失敗。

  ![Hangar search](/docs/images/mods-search-hangar.png)

- **匯入 zip** - 一個按鈕，三種格式，自動偵測：
  - **Modrinth 模組包 (`.mrpack`)**：每個釘選的檔案都會透過雜湊查找，重新對應回其 Modrinth 專案（因此匯入的模組會保留真實名稱、圖示，並保持可更新狀態；Modrinth 未知的檔案則從模組包本身的 URL 安裝），下載時會根據模組包的 sha512 校驗和進行驗證，並顯示預覽和適用性判斷。僅限用戶端的檔案會被明顯跳過，並且可以套用覆蓋樹（`overrides/`，然後是 `server-overrides/` - 伺服器特定的副本優先）。

    ![mrpack import](/docs/images/mrpack-import.png)

  - **CurseForge 模組包匯出檔**（CurseForge 應用程式產生的 zip 檔，包含 `manifest.json`）：每個釘選的模組都會被大量解析，並顯示預覽警告（載入器/MC 版本與此伺服器不符、檔案已不在 CurseForge 上、需要手動下載的模組），然後以實際進度進行安裝。模組包的 `overrides/`（設定檔、腳本）也可以選擇性套用 - 任何會被覆蓋的檔案都會先備份到伺服器資料夾內的 `.import-backups/<timestamp>/`。
  - **您自行收集的 jar 檔案的純 zip**：每個 jar 檔案都會被識別（Modrinth 雜湊比對 → CurseForge 指紋 → jar 檔案本身的元資料），並與伺服器進行比對 - _適用 / 載入器錯誤 / MC 版本錯誤 / 已安裝 / 無法識別_ - 因此您可以在任何檔案安裝前，選擇真正屬於此伺服器的內容。
- **透過連結新增** - 貼上幾乎任何內容：Modrinth、CurseForge、Hangar 或 SpigotMC 的專案頁面、GitHub 儲存庫或發行版 URL（單純的 `owner/repo` 也可以 - GitHub 安裝會優先選擇最新的穩定發行版，並跳過 `-sources`/`-javadoc` 的輔助 jar），一個純粹的 Modrinth slug，或任何直接的 `.jar` URL。面板會解析出適合伺服器載入器和 MC 版本的正確建置版本。

  ![Add by link](/docs/images/mods-add-by-link.png)

- **上傳 jar**（來自搜尋的備用方案或待下載解析器）- 上傳的 jar 檔案會以相同方式識別，因此它們會保留真實名稱、版本、圖示，並可進行更新檢查。

所有來自註冊中心的安裝都會在下載時進行**校驗和驗證**：串流會與註冊中心發布的最強雜湊值（sha512 → sha256 → sha1 → md5）進行比對，若不符則會在任何檔案落地伺服器前中止。

整個 zip 檔案（包含 `.mrpack`）也可以用來**建立伺服器**：在精靈的「_從模組包建立_」標籤頁中，上傳它，模組包的資訊清單（或根據識別出的 jar 檔案進行多數決）將會填入載入器、Minecraft 版本和載入器版本。
