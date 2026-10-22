# 05: Support RakNet as a legacy transport

**What to build:** Offer RakNet only as a clearly labelled compatibility mode for Native Bedrock versions that support it, with its correct two-port UDP connection contract.

**Blocked by:** 03: Reserve NetherNet ports.

**Status:** ready-for-agent

- [ ] RakNet is unavailable for versions known not to support it and is visibly labelled as legacy when available.
- [ ] RakNet servers reserve, publish, and explain the required IPv4 and IPv6 UDP ports without using NetherNet range rules.
