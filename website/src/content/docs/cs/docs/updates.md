---
title: 'Aktualizace'
description: 'Stránka Aktualizace sleduje, co je ve vaší flotile zastaralé, na jednom místě:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Aktualizace** sleduje, co je zastaralé napříč vaší flotilou na jednom místě:

- Verze **Modpacků** ([modpacky](/docs/modpacks/)) oproti Modrinth / CurseForge / indexu vydání GTNH.
- **Vlastní obsah**, který jste přidali sami – mody, datapacky, resource packy, pluginy – každý proti svému zdroji: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) nebo GitHub Releases. Vyhledávání na GitHubu používá ETag revalidaci, takže denní kontroly sotva zasáhnou jeho limit.
- Zastaralost **Docker image**: ID image každého běžícího kontejneru proti čerstvě staženému tagu (deduplikováno napříč servery se stejným tagem), nabízeno jako upgrade pouze pro opětovné vytvoření.
- **Fixní verze pro samostatné servery**: pro server bez spravovaného balíčku explicitní `mc_version` pin proti manifestu Mojangu a explicitní proměnná prostředí loader-build (`PAPER_BUILD`, `FORGE_VERSION` a podobně) proti registru loaderu. Buildy Paper pocházejí z aktuálního **Fill v3 API** PaperMC (starší koncový bod v2 přestal přijímat nové verze Minecraftu).

![Aktualizace](/docs/images/updates.png)

## Jak to funguje

Panel kontroluje připnuté verze každého serveru proti upstream zdroji a vypisuje cokoli s novějším vydáním. Odpovídající počet se také objeví na dlaždici "Dostupné aktualizace" na [dashboardu](/docs/dashboard/).

Kontroly se spouštějí na vyžádání a lze je naplánovat ([Plány](/docs/schedules/)). **Politika** aktualizací je na server, nikoli globální: rozhodujete, zda vás panel pouze upozorní, nebo zda vše zůstane manuální.

## Aplikace aktualizace

Aktualizace nejsou nikdy tiché. Když se rozhodnete upgradovat balíček, panel:

1. Vytvoří **zálohu před aktualizací** (takže je vratná; posledních 10 záloh před aktualizací na server je uchováváno).
2. Připne přesnou novou verzi.
3. Znovu vytvoří kontejner, v případě potřeby znovu vyřeší Java runtime.
4. Sleduje první spuštění s časovým rozpočtem na platformu.

Pokud se nenabootuje zdravě, vrátíte se k záloze před aktualizací. Server sledující stabilní verze nikdy nedostane nabídku beta verze a odkaz na changelog ukazuje na skutečný rozdíl pro konkrétní verzi, kde jej zdroj poskytuje. Neúspěšná aktualizace také spustí [upozornění](/docs/integrations/) na Discordu, pokud je integrace nakonfigurována.
