# Integrations

[← Back to docs index](README.md)

Each server has an **Integrations** tab: Discord notifications, a public status page, and an invite helper. This page covers Discord.

## Discord notifications

The panel forwards server events to a Discord channel through a webhook - no bot, no OAuth.

### Setup

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**. Pick the channel and copy the webhook URL.
2. In the panel, open the server's **Integrations** tab, paste the URL into **Webhook URL**, turn the card **on**, and **Save**. The URL is stored encrypted (in the same at-rest store as your API keys).
3. Use **Send test** to confirm it works.

To replace a stored URL, paste a new one and save; leave the field blank to keep the current one. The stored URL is shown masked (the token is hidden).

### What gets sent

Notifications are grouped into toggleable categories. All are on by default.

| Category         | Events                                                    |
| ---------------- | --------------------------------------------------------- |
| **Start / stop** | Server started, server stopped                            |
| **Crashes**      | Crash, crash loop detected, new crash report              |
| **Backups**      | Backup created, backup restored                           |
| **Updates**      | Update applied, update rolled back, update failed         |
| **Kicks / bans** | Player kicked, player banned                              |
| **Alerts**       | The things that quietly leave a server broken (see below) |

### The Alerts category

`Alerts` is the "something needs a human" channel - conditions that used to be visible only in the panel:

| Event                   | Meaning                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `oom`                   | The container was stopped for running out of memory.                                                           |
| `unhealthy`             | The process is up but the `mc-health` probe is failing - a live but dead server.                               |
| `startup-stalled`       | Still starting after ~10 min with no "Done" in the logs (with a diagnosis of what to fix, where one is known). |
| `stop-failed`           | A graceful stop didn't take effect and the container is still running.                                         |
| `schedule-failed`       | A scheduled restart / backup / command failed.                                                                 |
| `quota-exceeded`        | Strict-mode disk quota tripped and the server was stopped.                                                     |
| `offline-after-restart` | The server was up before the panel restarted, isn't now, and won't be auto-started.                            |
| `crash-report`          | A new crash report was captured and parsed.                                                                    |
| `update-failed`         | A guarded upgrade did not come up healthy.                                                                     |

### How delivery works

A background bridge polls the [event log](activity.md) every 15 seconds and forwards mapped rows. If a webhook POST fails transiently, that row is retried on later polls rather than dropped; a permanently unreachable webhook is muted (one log line per hour) after a few attempts. The bridge never replays events from before the panel started.
