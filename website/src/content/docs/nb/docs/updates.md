---
title: 'Oppdateringer'
description: 'Oppdateringssiden sporer hva som er utdatert på tvers av flåten din på ett sted:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Oppdateringer**-siden sporer hva som er utdatert på tvers av flåten din på ett sted:

- **Modpack**-versjoner ([modpacks](/docs/modpacks/)) mot Modrinth / CurseForge / GTNH release index.
- **Egendefinert innhold** du har lagt til selv – mods, datapacks, resource packs, plugins – hver mot sin kilde: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), eller GitHub Releases. GitHub-oppslag bruker ETag-revalidering, så daglige sjekker knapt berører rate-grensen.
- **Docker image**-foreldelse: hver kjørende containers image ID mot en nylig hentet tag (deduplicated på tvers av servere med samme tag), tilbudt som en recreate-only oppgradering.
- **Standalone versjons-pins**: for en server uten administrert pack, en eksplisitt `mc_version` pin mot Mojangs manifest, og en eksplisitt loader-build env var (`PAPER_BUILD`, `FORGE_VERSION`, og lignende) mot loaderens register. Paper builds kommer fra PaperMC's nåværende **Fill v3 API** (den eldre v2-endepunktet sluttet å motta nye Minecraft-versjoner).

![Oppdateringer](/docs/images/updates.png)

## Hvordan det fungerer

Panelet sjekker hver servers pinnede versjoner mot oppstrømskilden og lister opp alt med en nyere utgivelse. Et matchende antall vises også på [dashbordets](/docs/dashboard/) "Oppdateringer tilgjengelig"-flis.

Sjekker kjøres ved behov og kan planlegges ([Schedules](/docs/schedules/)). Oppdaterings **policy** er per server: du bestemmer om panelet bare varsler deg, eller lar alt være manuelt.

## Anvende en oppdatering

Oppdateringer er aldri stille. Når du velger å oppgradere en pack, gjør panelet følgende:

1. Tar en **backup før oppdatering** (slik at den kan reverseres; de siste 10 backupene før oppdatering per server beholdes).
2. Re-pinner den nøyaktige nye versjonen.
3. Rekreerer containeren, og re-løser Java-runtime om nødvendig.
4. Overvåker den første oppstarten, med et tidsbudsjett per plattform.

Hvis den ikke starter opp sunt, ruller du tilbake til backupen før oppdatering. En server som sporer stabil versjon blir aldri tilbudt en beta, og changelog-lenken peker til den faktiske per-versjons diffen der kilden tilbyr en. En mislykket oppdatering utløser også en Discord [varsling](/docs/integrations/) hvis integrasjonen er konfigurert.
