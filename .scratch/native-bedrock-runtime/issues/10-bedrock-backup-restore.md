# 10: Restore Bedrock backups safely

**What to build:** Restore a Native Bedrock backup through the existing recovery workflow without applying Java save or world-format assumptions.

**Blocked by:** 09: Take Bedrock-safe backups.

**Status:** ready-for-agent

- [ ] An operator can restore a chosen Bedrock backup and receives the normal safety and progress feedback.
- [ ] Restore leaves the Bedrock server in a consistent state and does not invoke Java RCON or Anvil handling.
