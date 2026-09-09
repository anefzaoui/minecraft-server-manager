# Public API

[← Back to docs index](README.md)

A small, read-only HTTP API for fetching server status from outside the panel: a
status dashboard, an uptime monitor, a Discord bot, a home-automation rule. It is
served by the panel itself and returns the same live data the panel's own pages
show (from the in-memory cache), so polling it never touches Docker.

It is **off until an admin uses it** and **admin-gated**. Nothing is exposed
until a token exists.

## Enabling it

**Settings → Public API → New Key**. Give it a name, choose what it can see (all
servers, or a specific subset), and optionally an expiry date. The full key (a
Bearer token) is shown **once**, in a dialog; copy it now, because only a short prefix
is kept afterwards, for identification in the list.

Creating the first key turns the API on automatically (the **Let outside apps
read status** switch is a pause control: turn it off to stop serving without
cancelling any keys). Cancel a key from the same table at any time; clients using it lose
access immediately.

Tokens are stored as a SHA-256 hash (never in plaintext), survive a panel
restart, and outlive the servers they are scoped to (a deleted server simply
drops out of that token's results).

## Authenticating

Send the token as a Bearer credential:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

There are no cookies and **no CORS**: this is for server-to-server and CLI
callers, not browser apps on another origin. If the panel is behind a reverse
proxy, make sure the proxy forwards the `Authorization` header.

Failures return `401` with `{ "ok": false, "error": "..." }`. A non-`GET`
request returns `405`. When the API is disabled, every route returns `404`.

## Rate limit

Each token gets its own budget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (default `120`
requests/minute; `0` disables the limiter). Over the limit returns `429`.

## Endpoints

### `GET /api/v1/servers`

Every server the token is scoped to.

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

One server, same object under a `server` key. Returns `404` for an unknown id
**and** for a server the token is not scoped to (no existence oracle), and `400`
for a malformed id.

## Response fields

| Field           | Meaning                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `total`         | How many servers are visible to this token (after its scope filter).                              |
| `online`        | How many of those are in state: `running`.                                                        |
| `id`            | Stable server id (`srv_...`).                                                                     |
| `name`          | Display name.                                                                                     |
| `type`          | itzg server type (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                     |
| `state`         | `running`, `starting`, `stopped`, or `crashed` - a stable summary of the panel's internal status. |
| `cpuPct`        | Recent CPU %, or `null` when the server is not running.                                           |
| `memoryMb`      | Resident memory in MB, or `null`.                                                                 |
| `memoryLimitMb` | Configured container memory limit in MB, or `null`.                                               |
| `uptimeSeconds` | Seconds since the container started, or `null`.                                                   |
| `players`       | `{ online, max }`, or `null` until the server reports a player list.                              |

## Example

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
