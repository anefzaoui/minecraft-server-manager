---
title: '公開 API'
description: '一個小型、僅限讀取的 HTTP API，用於從面板外部擷取伺服器狀態：狀態儀表板、正常運行時間監視器、Discord 機器人、家庭自動化規則。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← 返回文件索引](/docs/)

一個小型、僅供讀取的 HTTP API，用於從面板外部擷取伺服器狀態：用於狀態儀表板、正常運行時間監視器、Discord 機器人、家庭自動化規則。它由面板本身提供服務，並返回與面板自身頁面顯示的即時數據相同（來自記憶體快取），因此輪詢它永遠不會接觸 Docker。

它預設是**關閉的，直到管理員啟用它**，並且**需要管理員授權**。在存在 token 之前，不會暴露任何內容。

## 啟用它

前往 **設定 → 公開 API → 新增金鑰**。為其命名，選擇它可以看到的伺服器範圍（所有伺服器或特定子集），以及可選的到期日期。完整的金鑰（一個 Bearer token）會**顯示一次**，在對話框中；請立即複製它，因為之後只會保留一個簡短的前綴，用於在列表中識別。

![Public API settings](/docs/images/settings-public-api.png)

建立第一個金鑰會自動開啟 API（**讓外部應用程式讀取狀態**開關是一個暫停控制：關閉它即可停止服務，而不會取消任何金鑰）。隨時從同一個表格中取消金鑰；使用它的用戶端會立即失去存取權。

Token 會以 SHA-256 hash 的形式儲存（絕不會以明文儲存），能夠在面板重新啟動後倖存，並且比它們所作用的伺服器壽命更長（已刪除的伺服器只會從該 token 的結果中消失）。

## 驗證

將 token 作為 Bearer 憑證傳送：

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

沒有 Cookie，也沒有 **CORS**：這是供伺服器對伺服器和 CLI 呼叫者使用，而非瀏覽器應用程式。如果面板位於反向代理之後，請確保代理程式會轉發 `Authorization` 標頭。

失敗會返回 `401` 和 `{ "ok": false, "error": "..." }`。任何非 `GET`（或 `HEAD`）方法都會返回 `405`。未知路徑會返回 `404`。當 API 被禁用時，所有路由都會返回 `404`。

## 速率限制

每個 token 都有自己的配額，`RATE_LIMIT_PUBLIC_API_PER_MIN`（預設為 `120` 次請求/分鐘；`0` 會禁用限制器）。超出限制會返回 `429`。每個請求，在檢查其 token 之前，也會計入每個用戶端 IP 的配額上限，該上限是該數字的五倍，因此透過輪換遺失、格式錯誤、已撤銷或過期的 token 進行探測，無法繞過配額。

## 端點

### `GET /api/v1/servers`

該 token 作用範圍內的所有伺服器。

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

單一伺服器，在 `server` 鍵下具有相同的物件。對於未知 ID **以及** token 未作用範圍內的伺服器（不存在的 Oracle），會返回 `404`，對於格式錯誤的 ID 會返回 `400`。

## 回應欄位

| 欄位            | 意義                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| `total`         | 此 token 可見的伺服器數量（經過其範圍篩選後）。                         |
| `online`        | 這些伺服器中有多少處於 `running` 狀態。                                 |
| `id`            | 穩定的伺服器 ID (`srv_...`)。                                           |
| `name`          | 顯示名稱。                                                              |
| `type`          | itzg 伺服器類型 (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...)。           |
| `state`         | `running`、`starting`、`stopped` 或 `crashed`：面板內部狀態的穩定摘要。 |
| `cpuPct`        | 最近的 CPU 百分比，或在伺服器未運行時為 `null`。                        |
| `memoryMb`      | 以 MB 為單位的駐留記憶體，或為 `null`。                                 |
| `memoryLimitMb` | 設定的容器記憶體限制（以 MB 為單位），或為 `null`。                     |
| `uptimeSeconds` | 自容器啟動以來的秒數，或為 `null`。                                     |
| `players`       | `{ online, max }`，或直到伺服器報告玩家列表為止為 `null`。              |

## 範例

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
