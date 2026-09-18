---
title: '公開 API'
description: '一個小型、僅供讀取的 HTTP API，用於從面板外部擷取伺服器狀態：a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← 返回文件索引](/docs/)

一個小型、僅限讀取的 HTTP API，用於從面板外部擷取伺服器狀態：狀態儀表板、正常運行時間監視器、Discord機器人、家庭自動化規則。它由面板本身提供服務，並返回與面板自身頁面顯示的即時數據相同（來自記憶體快取），因此輪詢它永遠不會接觸 Docker。

它**在管理員使用之前是關閉的**，並且**受管理員保護**。在令牌存在之前，沒有任何內容會被暴露。

## 啟用它

**設定 → 公開 API → 新增金鑰**。為其命名，選擇它可以查看的內容（所有伺服器或特定子集），以及可選的到期日期。完整的金鑰（Bearer 令牌）會**顯示一次**，在對話方塊中；請立即複製它，因為之後只會保留一個簡短的前綴，用於在列表中識別。

![公開 API 設定](/docs/images/settings-public-api.png)

創建第一個金鑰會自動開啟 API（**允許外部應用程式讀取狀態**開關是一個暫停控制：關閉它以停止服務，而不會取消任何金鑰）。隨時從同一表格中取消金鑰；使用它的客戶端會立即失去存取權。

令牌以 SHA-256 雜湊形式儲存（絕不會以明文形式儲存），能夠在面板重新啟動後倖存，並且比它們作用域內的伺服器壽命更長（已刪除的伺服器只會從該令牌的結果中消失）。

## 驗證

將令牌作為 Bearer 憑證傳送：

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

沒有 Cookie，也沒有 **CORS**：這是供伺服器對伺服器和 CLI 呼叫者使用，而不是用於其他來源的瀏覽器應用程式。如果面板位於反向代理之後，請確保代理會轉發 `Authorization` 標頭。

失敗會返回 `401` 和 `{ "ok": false, "error": "..." }`。任何非 `GET`（或 `HEAD`）方法都會返回 `405`。未知路徑會返回 `404`。當 API 被禁用時，每個路由都會返回 `404`。

## 速率限制

每個令牌都有自己的配額，`RATE_LIMIT_PUBLIC_API_PER_MIN`（預設為 `120` 次請求/分鐘；`0` 會禁用限制器）。超出限制會返回 `429`。從未提供有效令牌的請求（遺失、格式錯誤、已撤銷或已過期）會按客戶端 IP 分開限制為該數字的五倍，因此透過輪換令牌進行探測無法繞過配額。

## 端點

### `GET /api/v1/servers`

令牌作用域內的所有伺服器。

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

單一伺服器，在 `server` 鍵下具有相同的物件。對於未知 ID **以及**令牌未作用域的伺服器，會返回 `404`（不存在的 Oracle），對於格式錯誤的 ID 會返回 `400`。

## 回應欄位

| 欄位            | 意義                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `total`         | 此令牌可見的伺服器數量（經過其作用域篩選後）。                           |
| `online`        | 其中有多少伺服器處於 `running` 狀態。                                    |
| `id`            | 穩定的伺服器 ID (`srv_...`)。                                            |
| `name`          | 顯示名稱。                                                               |
| `type`          | itzg 伺服器類型 (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...)。            |
| `state`         | `running`、`starting`、`stopped` 或 `crashed` - 面板內部狀態的穩定摘要。 |
| `cpuPct`        | 最近的 CPU 百分比，或在伺服器未運行時為 `null`。                         |
| `memoryMb`      | 以 MB 為單位的駐留記憶體，或 `null`。                                    |
| `memoryLimitMb` | 設定的容器記憶體限制（以 MB 為單位），或 `null`。                        |
| `uptimeSeconds` | 自容器啟動以來的秒數，或 `null`。                                        |
| `players`       | `{ online, max }`，或在伺服器報告玩家列表之前為 `null`。                 |

## 範例

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
