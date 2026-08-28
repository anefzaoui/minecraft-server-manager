# Modpacks

[← Back to docs index](README.md)

The **Modpacks** page (and the **From modpack** tab in the [creation wizard](servers.md)) installs a modpack as a server, always **pinned to an exact pack version** so a restart can never silently upgrade the pack out from under you.

![Modpacks](images/modpacks.png)

## Supported platforms

- **CurseForge** — search or paste a pack URL. Needs a CurseForge API key for search and private packs (add it under Settings → API keys).
- **Modrinth** — search by name.
- **FTB** — Feed The Beast packs.
- **GT New Horizons** — the 1.7.10 expert pack, installed from GTNH's own release index. GTNH picks its Java runtime per pack version (2.8.0+ runs on **Java 25** via bundled lwjgl3ify patches, older releases on Java 21 or 17), and the wizard raises the server's RAM and disk to sensible minimums for it.
- **Custom zip** — not a published pack at all: upload a **CurseForge modpack export** (the zip with `manifest.json` that CurseForge's app produces for a hand-picked mod set) or **any zip of mod jars**. The panel resolves the manifest in bulk via the CurseForge API (or identifies each jar by hash/fingerprint/metadata), previews what fits, and installs everything in one task — including the pack's `overrides/` configs if you opt in. Mods whose authors disallow automated downloads are listed with a browser link and a manual-upload slot instead of failing the install.

## How pinning works

When you pick a pack, the panel resolves the exact version, records it, and installs that. On the **Updates** page you'll be told when a newer version is available; upgrading is a deliberate, guarded action with a pre-update backup and rollback — never automatic. Stable-tracking servers are never offered a beta.

## Upgrading a pack

From a pinned server you can upgrade to a newer version in one action. The panel takes a backup first, swaps the pinned version, recreates the container (re-resolving Java if the new version needs a different runtime), and monitors the first boot — with a generous window for large packs like GTNH that download a couple of gigabytes and build a several-hundred-mod world on first start.
