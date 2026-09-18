---
title: 'Opdateringer'
description: 'Opdateringssiden sporer, hvad der er forældet på tværs af din flåde ét sted:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Opdateringer**-siden sporer, hvad der er forældet på tværs af din flåde ét sted:

- **Modpack**-versioner ([modpacks](/docs/modpacks/)) mod Modrinth / CurseForge / GTNH release-indekset.
- **Brugerdefineret indhold**, du selv har tilføjet - mods, datapacks, resource packs, plugins - hver mod sin kilde: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) eller GitHub Releases. GitHub-opslag bruger ETag-genvalidering, så daglige tjek knap nok rører dets rate limit.
- **Docker image**-forældelse: hver kørende containers image ID mod en frisk-pulled tag (dedupliceret på tværs af servere med samme tag), tilbudt som en opgradering, der kun genskaber.
- **Standalone version pins**: for en server uden en administreret pakke, en eksplicit `mc_version` pin mod Mojangs manifest, og en eksplicit loader-build env var (`PAPER_BUILD`, `FORGE_VERSION` og lignende) mod loaderens register. Paper builds kommer fra PaperMC's nuværende **Fill v3 API** (det ældre v2-endepunkt stoppede med at modtage nye Minecraft-versioner).

![Opdateringer](/docs/images/updates.png)

## Sådan virker det

Panelet tjekker hver servers pinned versioner mod upstream-kilden og lister alt med en nyere udgivelse. Et matchende antal vises også på [dashboardets](/docs/dashboard/) "Opdateringer tilgængelige"-flise.

Tjek kører on demand og kan planlægges ([Planer](/docs/schedules/)). Opdaterings**politik** er pr. server: du bestemmer, om panelet blot giver dig besked, eller om alt forbliver manuelt.

## Anvendelse af en opdatering

Opdateringer er aldrig lydløse. Når du vælger at opgradere en pakke, gør panelet følgende:

1. Tager en **backup før opdatering** (så den kan rulles tilbage; de sidste 10 backups før opdatering pr. server beholdes).
2. Gen-pinner den præcise nye version.
3. Genskraber containeren, og genopløser Java-runtime om nødvendigt.
4. Overvåger den første opstart, med et tidsbudget pr. platform.

Hvis den ikke starter sundt, rulles der tilbage til backupen før opdatering. En server, der sporer stabile versioner, får aldrig tilbudt en beta, og changelog-linket peger på den rigtige diff pr. version, hvor kilden leverer en. En mislykket opdatering udløser også en Discord [advarsel](/docs/integrations/), hvis integrationen er konfigureret.
