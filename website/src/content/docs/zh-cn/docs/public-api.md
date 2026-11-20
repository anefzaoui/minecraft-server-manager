---
title: '公共 API'
description: '一个小型、只读的 HTTP API，用于从面板外部获取服务器状态：状态仪表板、正常运行时间监视器、Discord 机器人、家庭自动化规则。'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← 返回文档索引](/docs/)

一个小型、只读的 HTTP API，用于从面板外部获取服务器状态：一个状态仪表板、一个正常运行时间监视器、一个 Discord 机器人、一个家庭自动化规则。它由面板本身提供服务，并返回与面板自己的页面相同（来自内存缓存）的实时数据，因此轮询它永远不会接触 Docker。

它**在管理员使用之前是关闭的**并且**受管理员控制**。在令牌存在之前，不会暴露任何内容。

## 启用它

**设置 → 公共 API → 新建密钥**。为其命名，选择它可以看到的内容（所有服务器或特定子集），以及可选的到期日期。完整的密钥（一个 Bearer 令牌）**仅显示一次**，在对话框中；立即复制它，因为之后只保留一个简短的前缀，用于在列表中标识。

![公共 API 设置](/docs/images/settings-public-api.png)

创建第一个密钥会自动打开 API（**让外部应用读取状态**开关是一个暂停控件：关闭它以停止服务而不取消任何密钥）。随时从同一个表中取消密钥；使用它的客户端将立即失去访问权限。

令牌以 SHA-256 哈希的形式存储（绝不以明文形式存储），可以承受面板重启，并且比它们作用域内的服务器更持久（已删除的服务器只会从该令牌的结果中消失）。

## 身份验证

将令牌作为 Bearer 凭证发送：

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

没有 cookie 并且**没有 CORS**：这适用于服务器到服务器和 CLI 调用者，而不是其他来源的浏览器应用程序。如果面板位于反向代理之后，请确保代理转发 `Authorization` 标头。

失败时返回 `401` 和 `{ "ok": false, "error": "..." }`。除 `GET`（或 `HEAD`）以外的任何内容都返回 `405`。未知路径返回 `404`。当 API 被禁用时，每个路由都返回 `404`。

## 速率限制

每个令牌都有自己的配额，`RATE_LIMIT_PUBLIC_API_PER_MIN`（默认为 `120` 次请求/分钟；`0` 表示禁用限制器）。超出限制时返回 `429`。每个请求，在检查其令牌之前，也会计入每个客户端 IP 的配额，该配额是该数字的五倍，因此通过轮换缺失、格式错误、已撤销或已过期的令牌进行探测无法绕过配额。

## 端点

### `GET /api/v1/servers`

令牌作用域内的所有服务器。

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

单个服务器，在 `server` 键下是相同的对象。对于未知 ID **以及**令牌未作用域的服务器（不存在的 Oracle），返回 `404`，对于格式错误的 ID 返回 `400`。

## 响应字段

| 字段            | 含义                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| `total`         | 此令牌可见的服务器数量（经过其作用域过滤器后）。                        |
| `online`        | 其中有多少处于 `running` 状态。                                         |
| `id`            | 稳定的服务器 ID (`srv_...`)。                                           |
| `name`          | 显示名称。                                                              |
| `type`          | itzg 服务器类型 (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...)。           |
| `state`         | `running`、`starting`、`stopped` 或 `crashed`：面板内部状态的稳定摘要。 |
| `cpuPct`        | 最近的 CPU 百分比，或在服务器未运行时为 `null`。                        |
| `memoryMb`      | 以 MB 为单位的驻留内存，或 `null`。                                     |
| `memoryLimitMb` | 配置的容器内存限制（以 MB 为单位），或 `null`。                         |
| `uptimeSeconds` | 自容器启动以来的秒数，或 `null`。                                       |
| `players`       | `{ online, max }`，或直到服务器报告玩家列表才为 `null`。                |

## 示例

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
