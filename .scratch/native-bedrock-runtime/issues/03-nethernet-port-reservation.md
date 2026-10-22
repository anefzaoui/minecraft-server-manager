# 03: Reserve NetherNet ports

**What to build:** Give a Native Bedrock server using NetherNet a conflict-free TCP signaling port and a contiguous UDP gameplay range sized from its player capacity.

**Blocked by:** 02: Create and operate a Native Bedrock server.

**Status:** ready-for-agent

- [ ] NetherNet is the default transport and reserves its TCP port plus a configurable UDP range, with a visible default capacity of 16 players.
- [ ] Port allocation and validation prevent collisions across TCP, UDP, ranges, existing server ports, and advanced mappings.
