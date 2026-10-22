# Add native Bedrock runtime support

Status: ready-for-agent

## Problem Statement

The panel currently manages Java Edition containers only. Its existing "Bedrock port" is a Geyser bridge port, not native Bedrock support. Operators cannot create or manage a Bedrock Dedicated Server, while assumptions around RCON, Java ports, Java world files, JVM settings, and Java plugins make a superficial Bedrock type invalid.

## Solution

Add a native Bedrock Dedicated Server as a first-class Server runtime. Bedrock appears alongside Vanilla, Paper, and Purpur in Create Server, but persists and operates through a separate runtime contract. Use `itzg/minecraft-bedrock-server`; support Latest, Preview, and pinned versions; default to NetherNet with managed TCP and UDP player ports; and expose RakNet only as a legacy option for compatible pinned versions.

Every panel capability must be assessed at the runtime boundary: implement a genuine Bedrock equivalent where one exists, or hide it where it does not. Preserve all existing Java servers unchanged and rename their existing Bedrock port presentation to Geyser UDP port.

## User Stories

1. As an operator, I want Bedrock beside Java server types in Create Server so that I can create a native Bedrock server through the normal workflow.
2. As an operator, I want the panel to distinguish a Native Bedrock server from a Geyser bridge so that their configuration and ports cannot be confused.
3. As an operator, I want to select Latest, Preview, or a pinned Bedrock version so that I can balance automatic updates, previews, and reproducible deployments.
4. As an operator, I want the panel to accept the Bedrock EULA and use the dedicated Bedrock container so that I do not need manual Docker setup.
5. As an operator, I want NetherNet as the default transport so that current Bedrock versions use their supported networking model.
6. As an operator, I want a managed TCP signaling port and contiguous UDP gameplay range for NetherNet so that every concurrent Bedrock player can connect.
7. As an operator, I want the UDP range sized from Max Players with a visible default of 16 so that I do not calculate capacity myself.
8. As an operator, I want to choose or correct the LAN or public IP used by NetherNet so that the server advertises reachable endpoints in my topology.
9. As an operator, I want RakNet shown only as a clearly labelled legacy option for compatible pinned versions so that unsupported current versions cannot be misconfigured.
10. As a Bedrock player, I want connection instructions with the correct host and transport-specific ports so that I can join successfully.
11. As an operator, I want firewall guidance for TCP plus the UDP range on NetherNet, and both UDP ports on RakNet, so that external connectivity is predictable.
12. As an operator, I want lifecycle controls, logs, container CPU/RAM metrics, files, restart policy, disk quota, and Docker safety controls to work for Bedrock.
13. As an operator, I want a Bedrock console and scheduled administrator commands through the supported Bedrock command mechanism so that I can administer and automate a running server without RCON.
14. As an operator, I want Bedrock-safe backups and restores so that archives are taken only after data is made consistent and restored worlds are not corrupted.
15. As an operator, I want to upload, download, activate, reset, and back up Bedrock worlds so that common world administration does not require filesystem access outside the panel.
16. As an operator, I want Bedrock world tools to avoid Java Anvil, chunk-shrinking, inventory, and map assumptions so that the panel never damages or misrepresents Bedrock worlds.
17. As an operator, I want a Bedrock Packs view for behavior and resource packs so that Bedrock extensions are managed without reusing the Java Mods view.
18. As an operator, I want Bedrock player permissions managed by Xbox gamertag or XUID so that I can administer allowlist members, operators, and visitors.
19. As an operator, I want Java-only player details, UUID profiles, inventories, RCON live-player behavior, Java chat commands, and Java analytics hidden from Bedrock servers so that unsupported controls are not displayed.
20. As an operator, I want Bedrock settings to expose supported Bedrock properties while hiding Java, JVM, and RCON fields so that each runtime has meaningful configuration.
21. As an operator, I want a Bedrock server overview and navigation to include only runtime-supported pages and actions so that the interface remains coherent.
22. As an operator, I want existing Java servers to retain their behavior and ports after upgrade so that adding Bedrock support is non-disruptive.
23. As an operator using Geyser, I want the former Bedrock port setting renamed to Geyser UDP port so that it is clear that it belongs to Java connectivity.
24. As an API consumer, I want server records and connection details to disclose their runtime and capabilities so that clients can render compatible controls.
25. As an administrator, I want authorization to protect Bedrock actions at the same capability level as corresponding Java actions so that runtime support does not weaken access control.
26. As a maintainer, I want runtime-specific behavior centralized behind capabilities so that later editions or transports do not require scattered Bedrock special cases.

## Implementation Decisions

- Persist Server runtime independently from the existing Java server type. Java is the migration default; Native Bedrock is chosen only for newly created Bedrock servers.
- Define runtime capabilities as the boundary for navigation, settings, API behavior, background work, and feature availability. The UI may retain one type picker, but must not infer runtime behavior from a Java type string.
- Use `itzg/minecraft-bedrock-server` for Native Bedrock. Keep Java and Bedrock image configuration separate.
- Model Bedrock transport, advertised address, signaling/game ports, and the NetherNet UDP range explicitly. The allocator must become protocol-aware and reserve complete ranges without collisions with every existing published port.
- Default to NetherNet. Gate RakNet behind a legacy transport option and selected-version compatibility.
- Keep Bedrock versions independent from Java version manifests. Support Latest, Preview, and an explicit pinned version without Java snapshot choices.
- Replace RCON-only operations with a Bedrock command adapter. Java RCON remains unchanged.
- Make backup, restore, world, player-permission, pack, monitoring, invite, schedule, public API, and view-model behavior runtime-aware. Shared operations delegate to a Bedrock adapter when a Bedrock consistency or data-format rule applies.
- Provide Bedrock-safe snapshotting before archive or restore work. Do not reuse Java RCON save operations or Anvil/region-file tools for Bedrock data.
- Provide Bedrock-specific world and pack workflows. Do not expose Java mods/plugins, BlueMap/Anvil tooling, Java inventory parsing, Java TPS, Java crash parsing, Java chat automation, or Java world controls unless a separately implemented Bedrock equivalent exists.
- Rename the existing Java `port_bedrock` presentation to Geyser UDP port and preserve all stored values during migration.
- Preserve existing server data, authorization boundaries, audit/event behavior, storage guards, and Docker override restrictions.

## Testing Decisions

- Test externally observable runtime behavior, not implementation branches or private helper structure.
- Use the Server runtime service as the primary seam for environment assembly, container specifications, version and transport validation, port reservation, capability resolution, and migration behavior. Follow the existing server-core tests.
- Use the in-process Express application harness for creation, settings, permissions, API payloads, and runtime-specific endpoint availability. Follow existing API and authorization route tests.
- Test backup, restore, world, and pack adapters against temporary data directories, asserting consistent archives, accepted Bedrock layouts, and rejection of Java-only operations.
- Test navigation and view-model capability output rather than brittle browser snapshots.
- Cover Java migration preservation, Geyser UDP-port naming, NetherNet range collisions, RakNet version gating, address validation, and authorization of every newly exposed Bedrock action.
- Keep tests Docker- and network-free; mock or inject Docker-facing boundaries as existing tests do.

## Out of Scope

- Automatically installing or configuring Geyser or Floodgate on Java servers.
- Treating Geyser as a Native Bedrock server runtime.
- Reusing Java Mods, Java world map, Anvil region shrinking, Java player inventories, Java UUID profiles, RCON-based live player lists, Java chat-command triggers, Java TPS, Java crash parsing, or Java-specific world controls for Bedrock.
- Adding a Bedrock equivalent where Bedrock provides no reliable management mechanism.
- Changing the runtime, ports, or behavior of existing Java servers.
- Replacing the panel's Docker, storage, authorization, or public API architecture.

## Further Notes

The terms Native Bedrock server, Server runtime, Geyser bridge, Geyser UDP port, NetherNet, and RakNet are defined in the repository glossary. ADR 0001 records the architectural decision and its compatibility constraints. NetherNet needs a TCP signaling port plus a UDP gameplay range; RakNet is a legacy compatibility mode.
