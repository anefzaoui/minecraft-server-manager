# 01: Add Server runtime and preserve Java servers

**What to build:** Introduce Native Bedrock as a Server runtime with a capability boundary, while migrating every existing server to the Java runtime and retaining its current behavior and Geyser UDP-port value.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Existing servers remain Java servers after migration, with unchanged ports and behavior.
- [ ] A Native Bedrock runtime can be represented independently from Java server type and exposes its capabilities centrally.
