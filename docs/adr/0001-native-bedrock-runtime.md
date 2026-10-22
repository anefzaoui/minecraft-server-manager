# Native Bedrock is a separate server runtime

The panel will manage Bedrock Dedicated Server as a native Bedrock runtime, rather than modelling it as a Java server type or as Geyser. It will use `itzg/minecraft-bedrock-server`, edition-specific capabilities, and a Bedrock-specific port model: NetherNet is the default transport with an allocated UDP player-port range, while RakNet remains an explicitly labelled legacy option for compatible pinned versions. This keeps the shared create-server experience simple while preventing Java RCON, plugin, world, and port assumptions from leaking into Bedrock management.

## Consequences

Bedrock support applies to the whole application: every existing capability is either implemented through a genuine Bedrock equivalent or deliberately hidden when no reliable equivalent exists. It includes lifecycle, logs, Bedrock-safe backups and restores, files, Bedrock settings, console commands, Bedrock player permissions, scheduled admin commands, behavior/resource packs, Bedrock-specific world management, and protocol-aware join/firewall guidance. Java-only views and operations are hidden; the existing Java-side `port_bedrock` setting is renamed to the Geyser UDP port. Existing servers are explicitly migrated as Java runtimes, so their ports and behaviour do not change.
