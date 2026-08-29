# Per-server Minecraft chatbot

This fork adds an admin-configured chatbot to each managed Minecraft server. It connects to an
OpenAI-compatible chat-completions endpoint, including Ollama on another LAN host. Each server has
its own endpoint, model, invocation name, persona, transcript policy, outreach messages, and power
policy. The default invocation is `@wizard`, and the default persona demonstrates an ancient,
playful in-world wizard; both are editable.

## Player experience

- Any player can use `@wizard <message>` (or the configured invocation) for conversation and
  deterministic, Minecraft-version-aware vanilla recipe help.
- Join greetings and a configurable one-time play-session check-in remind players the chatbot is
  available. `@wizard chat` opens a short opt-in conversation window; `@wizard bye` closes it.
- **Basic users** may invoke enabled self/world powers. **Power controllers** may invoke separately
  validated actions affecting another online player. Players in neither group remain
  conversation-only.
- Basic-user self-gifts use an item allowlist. Controllers may give another player any valid
  namespaced vanilla or modded item, subject to the quantity limit and other power safeguards.

## Design and security

Configuration and transcripts are admin-only. The model never receives raw RCON or arbitrary
command execution. A message exposes only the single fixed tool matching its explicit intent;
server code validates authorization, arguments, flags, quantities, cooldowns, and exact online
player names before executing an existing service operation. Minecraft selectors are rejected,
cross-player actions cannot target the caller, powers begin in dry-run mode, and every attempted
power is audited. Unsupported tool-calling models fall back to conversation only.

Replies are bounded for Minecraft chat. Known vanilla recipes come from bundled versioned recipe
data and render as stable 2x2/3x3 rows; the LLM is not trusted to invent recipe layouts. Unknown or
modded recipes direct the player to JEI/REI rather than fabricating an answer.

## Main implementation files

- `src/services/wizard.js` — per-server configuration, OpenAI-compatible requests, chat handling,
  outreach, transcript retention, and response limits.
- `src/services/wizardPowers.js` — role checks, intent-specific tool schemas, validation, execution,
  cooldowns, and power auditing.
- `src/services/wizardRecipes.js` and `src/data/recipes/` — deterministic versioned recipe lookup and
  grid formatting.
- `src/analytics/ingest.js` — forwards parsed joins, leaves, and player chat to the chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, and
  `views/partials/server/integrations.hbs` — admin API and per-server Integrations UI.
- `src/db/migrations/010_wizard_chat.js` through `014_wizard_power_controllers.js` — persistent schema.
- `test/wizard.test.js` — authorization, tool-boundary, retention, outreach, and chat behavior tests.

The internal `wizard` route/module/table names are retained for upgrade and API compatibility;
“chatbot” is the user-facing product term. Likewise, the stored `power_testers_json` field maps to
the UI's **Basic users** group.

## Local storage and manual inspection

All settings and retained transcripts live in the panel SQLite database at `/data/panel.db` inside
the panel container. With the standard Compose mount, the host path is
`${DATA_DIR_HOST}/panel.db` (for example `/opt/msm/data/panel.db`). Relevant tables are
`wizard_configs`, `wizard_transcripts`, and `wizard_outreach`; power audits are rows in the `events`
table with type `wizard-power`. The optional LLM API key is AES-256-GCM encrypted using the panel's
`SESSION_SECRET`, normally persisted as `${DATA_DIR_HOST}/.session-secret`.

Back up the database and stop the panel before direct SQLite edits so its WAL is handled safely.
Using the admin UI/API is preferred because it applies validation and encryption. Keep the
`panel.db`, `panel.db-wal`, and `panel.db-shm` files together when copying a live database.
