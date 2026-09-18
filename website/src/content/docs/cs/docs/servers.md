---
title: 'Vytváření a správa serverů'
description: 'Klikněte na Vytvořit server (horní lišta) nebo na kartu Vytvořit server a otevřete průvodce.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Zpět na obsah dokumentace](/docs/)

## Vytvoření serveru

Klikněte na **Vytvořit server** (horní lišta) nebo na kartu **Vytvořit server** a otevřete průvodce.

![Vytvořit server](/docs/images/create-wizard.png)

Průvodce předvyplní pole pro paměť, CPU a diskové kvóty z **Výchozí nastavení pro nové servery** na stránce Nastavení, které může administrátor kdykoli změnit.

![Výchozí nastavení pro nové servery](/docs/images/settings-defaults.png)

Zvolíte:

- **Název** (a volitelnou ikonu, akcentovou barvu a štítky pro organizaci vaší flotily).
- **Typ serveru** - vanilla, Paper, Fabric, Forge, NeoForge a další, každý namapovaný na správný itzg obraz na pozadí.
- **Verzi Minecraftu** - `LATEST`, snapshot nebo konkrétní verzi.
- **Zdroje** - RAM (heap), limit paměti kontejneru, CPU a diskovou kvótu.

Preferujete modpack? Karta **Z modpacku** místo toho nainstaluje balíček CurseForge, Modrinth, FTB nebo GT New Horizons (viz [Modpacky](/docs/modpacks/)) nebo vezme **vlastní zip, který nahrajete**: export modpacku CurseForge (`manifest.json`) nebo jakýkoli zip mod jarů. Manifest (nebo většina hlasů napříč identifikovanými jary) vyplní loader a verzi Minecraftu a každý mod se nainstaluje v jednom kroku. Můžete také začít z uloženého [Blueprintu](/docs/blueprints/).

Panel automaticky vybere rozumný Java runtime pro vaši verzi, stáhne obraz, vytvoří kontejner a (volitelně) jej spustí, to vše z jednoho formuláře.

## Seznam serverů

Stránka **Servery** zobrazuje celou vaši flotilu se stavem a rychlými statistikami.

![Seznam serverů](/docs/images/servers-list.png)

## Jeden server

![Hráči](/docs/images/players.png)

Otevřením serveru získáte pracovní prostor s kartami:

- **Přehled** - stav, živé statistiky, doba provozu a primární ovládací prvky pro spuštění / zastavení / restart.
- **Konzole** - živý proud logů a vstup příkazů, plus chat ve hře ([podrobnosti](/docs/console-and-chat/)).
- **Hráči** - kdo je online, plus inventář, statistiky a [příkazy chatu](/docs/console-and-chat/).
- **Mody** - seznam nainstalovaných modů, [prohlížeč modů](/docs/modpacks/) a aktualizace obsahu.
- **Svět** - [světy, živá mapa a správce souborů](/docs/worlds-and-files/).
- **Zálohy** - [snímky a obnovení](/docs/backups/) pro tento server.
- **Monitorování** - historie pro každý server a živé metriky, včetně zpráv o pádu (viz níže).
- **Nastavení** - vše o tom, jak server běží, plus [integrace](/docs/integrations/) (Discord, stránka stavu, pozvánky, chatbot).

![Přehled serveru](/docs/images/server-overview.png)

Lišta **Ovládání světa** se pohybuje na každé kartě: herní hodiny, počasí, běžná gamerule jako přepínací čipy a "Zobrazit všechna pravidla světa" pro zbytek.

![Ovládání světa](/docs/images/world-controls.png)

**Monitorování → Živě** zobrazuje TPS a milisekundy na tick, kartu stavu a stability s posledními 24 hodinami / 7 dny pádů a restartů a velikosti pro jednotlivé světy.

![Živé monitorování](/docs/images/monitoring-live.png)

## Nastavení serveru

Karta **Nastavení** je plné konfigurační rozhraní: přejmenování, zdroje, zásady aktualizací, automatické spuštění / automatický restart, proměnné prostředí a pokročilá přepsání Dockeru. Pole, která mění způsob běhu kontejneru, jsou jasně označena jako vyžadující restart.

![Nastavení serveru](/docs/images/server-settings.png)

**O měřiči paměti.** "RAM (Java heap)" je předána Javě jako její počáteční i maximální heap, a Java vyplní přidělenou heap v první minutě, s nebo bez předvoleb Aikar / MeowIce. Takže měřič paměti se ustálí kolem velikosti heap a zůstává tam, i když nikdo nehraje; značka na měřiči označuje, kde se heap nachází pod limitem kontejneru, a poznámka pod ním to říká. Pokud byste raději viděli paměť sledující skutečné využití, nastavte menší **Počáteční heap** (pokročilé): na 2 GB heapu to v našich měřeních snížilo nečinné využití z 2,6 GB na přibližně 1,3 GB. Java také potřebuje paměť mimo heap (asi 0,5 GB u vanilla, 1,5 až 2 GB u velkého modpacku), což je to, pro co je určen prostor pod limitem kontejneru. Čísla najdete v README v sekci "Dva limity paměti".

> Pokročilá pole pro přepsání Dockeru (vlastní název kontejneru, další porty a bind mounty a surová přepsání) jsou **pouze pro administrátory**, protože bind mount spolu s přístupem panelu k Dockeru je efektivně root na hostiteli. Viz [Uživatelé a role](/docs/users-and-roles/).

## Analýza zpráv o pádu a mclo.gs

Zprávy o pádu (`crash-reports/*.txt` a soubory JVM `hs_err_pid*.log`) jsou automaticky zachyceny, analyzovány do jednorázového souhrnu s výjimkou a podezřelými mody a zobrazeny pod **Monitorování → Historie**:

![Karta zprávy o pádu](/docs/images/crash-mclogs-card.png)

Každá karta zprávy nabízí vestavěný prohlížeč (s rozbalovacími sekcemi a zvýrazněnými výjimkami), kopírování stack trace a stažení, plus dvě akce [mclo.gs](https://mclo.gs):

- **Sdílet na mclo.gs** publikuje zprávu jako veřejný paste a zkopíruje odkaz - přesně to, co autoři modů a podpůrné Discordy požadují. Odkaz je uložen u zprávy, takže se nic nikdy nenahrává dvakrát.
- **Analyzovat** spustí automatizované analýzy mclo.gs nad paste: známé problémy s navrhovanými opravami (chybějící závislosti, neshody verzí, běžné konflikty modů), zobrazené přímo v panelu.

![Analýza mclo.gs](/docs/images/crash-insights.png)

Obě akce jsou za explicitním potvrzením, protože paste je veřejný: zprávy o pádu mohou obsahovat jména hráčů a váš kompletní seznam modů. Panel nikdy nic nenahrává sám.
