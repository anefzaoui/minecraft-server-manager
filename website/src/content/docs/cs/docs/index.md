---
title: 'Dokumentace'
description: 'Kompletní, samoobslužný ovládací panel pro itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Kompletní, samoobslužný ovládací panel pro [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Vytvářejte, spouštějte a spravujte servery Minecraft z prohlížeče. Žádný příkazový řádek, žádné ruční úpravy YAML.

![Dashboard](/docs/images/dashboard.png)

## Začněte zde

- **[Začínáme](/docs/getting-started/)** - nastavení při prvním spuštění, přihlášení a zorientování se.
- **[Ovládací panel](/docs/dashboard/)** - rychlý přehled všech serverů, hráčů a aktivit.

## Běžící servery

- **[Vytváření a správa serverů](/docs/servers/)** - průvodce vytvořením, typy serverů, verze a nastavení pro jednotlivé servery.
- **[Konzole a příkazy chatu](/docs/console-and-chat/)** - živá konzole a vlastní příkazy chatu ve hře, které se spouštějí jako hráč.
- **[Modpacky](/docs/modpacks/)** - instalace balíčků CurseForge, Modrinth, FTB a GT New Horizons, vždy připnutých na přesnou verzi.
- **[Světové mapy a soubory](/docs/worlds-and-files/)** - výměna světových map, správa modů a úprava souborů přímo v prohlížeči.
- **[Zmenšení světové mapy](/docs/world-shrink/)** - uvolnění místa na disku odstraněním chunků, které nikdo nenavštěvuje, samostatně nebo jako součást zálohy.
- **[Živá mapa](/docs/live-map/)** - 3D mapa světa BlueMap na jedno kliknutí, za přihlášením do panelu.
- **[Pozvánky a stránka stavu](/docs/invites-and-status-page/)** - adresa, text pozvánky a modpack klienta pro přátele a veřejná stránka stavu.

## Data a automatizace

- **[Chatbot pro každý server](/docs/chatbot/)** - lokální konverzace kompatibilní s OpenAI, dosah, uložené přepisy a omezené herní schopnosti.
- **[Zálohy](/docs/backups/)** - snímky na jedno kliknutí, plánované zálohy, kolik jich uchovávat (pro celý panel nebo pro každý server) a obnovení.
- **[Šablony](/docs/blueprints/)** - zachycení celé konfigurace serveru a vytváření nových serverů z ní.
- **[Plány](/docs/schedules/)** - restarty, zálohy a příkazy řízené cronem.
- **[Úložiště](/docs/storage/)** - využití disku pro každý server a kvóty vynucené panelem.
- **[Aktualizace](/docs/updates/)** - sledování nových verzí serveru, balíčků, obrazů a modů, kontrola, které verze Minecraftu vaše mody podporují, a vrácení aktualizace modu.
- **[Log aktivit](/docs/activity/)** - auditní záznam všeho, co se stalo.
- **[Integrace](/docs/integrations/)** - oznámení přes Discord webhook a kategorie Upozornění.
- **[Veřejné API](/docs/public-api/)** - HTTP API pouze pro čtení s autentizací tokenem pro získávání stavu serveru zvenčí panelu.

## Účty a zabezpečení

- **[Uživatelé a role](/docs/users-and-roles/)** - administrátor, operátor a prohlížeč, co každý může dělat, a oprávnění pro každý server, která je upřesňují.
- **[Dvoufaktorové ověřování](/docs/two-factor-authentication/)** - zabezpečte své přihlášení pomocí aplikace pro ověřování.

## Návody

Nespecifické pro tento panel: otázky, se kterými se setkává každý správce serveru Minecraft.

- **[Kolik RAM server potřebuje?](/docs/guide-server-memory/)** - dvě čísla k nastavení a proč nečinný server vykazuje 12 GB.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - který spustit a rozdíl mezi pluginy/mody za touto volbou.
- **[Váš server se nespustí](/docs/guide-server-wont-start/)** - čtení logu a několik málo příčin většiny selhání.
- **[Zálohy, které se skutečně obnoví](/docs/guide-backups/)** - konzistentní kopie, co dalšího uchovávat a otestování jedné předtím, než ji budete potřebovat.
- **[Přesun serveru na jiného hostitele](/docs/guide-moving-a-server/)** - pořadí, které udržuje krátkou dobu výpadku a neporušené inventáře.

## Pod kapotou

- **[Architektura](/docs/architecture/)** - jak je panel postaven.
- **[Webové stránky](/docs/website/)** - jak je minecraft-server-manager.com sestaven, přeložen a nasazen z tohoto repozitáře.

---

> Snímky obrazovky v těchto dokumentech jsou pořízeny v tmavém motivu panelu. Panel se spustí tmavý, pokud váš operační systém nepřednostňuje světlý; použijte přepínač motivu v horní liště pro přepnutí.
