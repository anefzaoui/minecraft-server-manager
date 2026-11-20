---
title: 'Vytváření a správa serverů'
description: 'Vytvářejte, spouštějte, zastavujte, přestavujte a konfigurujte Minecraft servery v panelu: průvodce vytvořením, nastavení, paměť a herní port.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Zpět na index dokumentace](/docs/)

## Vytvoření serveru

Klikněte na **Vytvořit server** (horní lišta) nebo na kartu **Vytvořit server** pro otevření průvodce.

![Vytvoření serveru](/docs/images/create-wizard.png)

Průvodce předvyplní velikost haldy Javy a limit disku z nastavení **Výchozí hodnoty pro nové servery** na stránce Nastavení, které může administrátor kdykoli změnit. Nový server odtud také převezme limit CPU.

![Výchozí hodnoty pro nové servery](/docs/images/settings-defaults.png)

Zvolíte:

- **Název** (a volitelný popis, ikonu a akcentovou barvu). Značky pro organizaci vaší flotily se přidávají později, v nastavení serveru.
- **Typ serveru**: Vanilla, Paper nebo Purpur na kartě **Vanilla**. Pro modovaný server karta **Z modů** vybere loader (Fabric, Forge, NeoForge nebo Quilt), verzi Minecraftu a sestavení loaderu (nejnovější nebo konkrétní) a poté vám umožní vyhledávat mody.
- **Verze Minecraftu**: `LATEST`, snapshot nebo konkrétní verze (včetně beta a alfa verzí).
- **Port hry**: je navržen volný port. Konzole pro vzdálené ovládání (RCON) používá port o 1000 vyšší (ve výchozím nastavení). Můžete jej později změnit (viz [Změna portu hry](#changing-the-game-port)).
- **Prostředky**: haldu Javy (limit paměti kontejneru je nastaven o 50 % výše) a limit disku.

**Pokročilá nastavení** otevře všechna ostatní nastavení, která obraz serveru podporuje, plus další proměnné prostředí a (pro administrátory) pokročilá nastavení Dockeru.

Preferujete modpack? Karta **Z modpacku** místo toho nainstaluje balíček CurseForge, Modrinth nebo GT New Horizons (viz [Modpacky](/docs/modpacks/)) nebo vezme **vlastní zip, který nahrajete**: Modrinth `.mrpack`, export modpacku CurseForge (`manifest.json`) nebo jakýkoli zip mod souborů. Manifest (nebo většina hlasů napříč identifikovanými soubory) vyplní loader a verzi Minecraftu a každý mod se nainstaluje v jednom úkolu. Můžete také začít z uloženého [Blueprintu](/docs/blueprints/) na kartě **Z blueprintu**.

Panel automaticky vybere rozumný Java runtime pro vaši verzi, stáhne obraz, vytvoří kontejner a spustí jej, to vše z jednoho formuláře.

## Seznam serverů

Stránka **Servery** zobrazuje celou vaši flotilu se stavem a rychlými statistikami.

![Seznam serverů](/docs/images/servers-list.png)

## Jeden server

![Hráči](/docs/images/players.png)

Otevření serveru vám poskytne pracovní prostor s kartami:

- **Přehled**: adresa ke sdílení s hráči, popis, aktuální využití a kdo je online.
- **Konzole**: živý stream logů a vstup příkazů, chat ve hře a [příkazy chatu](/docs/console-and-chat/).
- **Hráči**: seznam hráčů, plus inventář a statistiky.
- **Mody**: seznam nainstalovaných modů, [prohlížeč modů](/docs/modpacks/) a aktualizace obsahu. Na modovaném serveru karta **Verze** kontroluje, pro které budoucí verze Minecraftu mají vaše mody sestavení ([aktualizace](/docs/updates/#minecraft-version-compatibility)).
- **Svět**: [světy, živá mapa a správce souborů](/docs/worlds-and-files/).
- **Zálohy**: [snímky a obnovení](/docs/backups/) pro tento server.
- **Monitorování**: historie na server a živé metriky, včetně zpráv o pádech (viz níže).
- **Nastavení**: **Konfigurace** (vše o tom, jak server běží), plus [integrace](/docs/integrations/) (Discord, Status Page, Invites a pro administrátory Chatbot).

Ovládací prvky pro spuštění, zastavení a restartování jsou umístěny v záhlaví nad každou kartou. Co můžete na každé kartě dělat, závisí na vašich [oprávněních na daném serveru](/docs/users-and-roles/#per-server-permissions): například podkarta **Soubory** vyžaduje oprávnění Soubory a odesílání příkazů konzole vyžaduje Konzoli.

![Přehled serveru](/docs/images/server-overview.png)

Lišta **Ovládání světa** se pohybuje na každé kartě: herní hodiny, počasí, běžná herní pravidla jako přepínací čipy a "Zobrazit všechna pravidla světa" pro zbytek.

![Ovládání světa](/docs/images/world-controls.png)

**Monitorování → Živě** zobrazuje TPS a milisekundy na tick, kartu stavu a stability s pády (posledních 24 hodin a 7 dní), ukončení kvůli nedostatku paměti a automatické restarty, a velikosti jednotlivých světů.

![Živé monitorování](/docs/images/monitoring-live.png)

## Nastavení serveru

**Nastavení → Konfigurace** je kompletní povrch konfigurace: název, popis, MOTD, ikona, barva a značky, prostředky, port hry, zásady aktualizací, spuštění při startu panelu a automatický restart při pádu, všechny proměnné prostředí, které obraz serveru podporuje, pokročilá nastavení Dockeru a export, klonování, přestavba a odstranění blueprintu. Změny, které se projeví až po přestavbě serveru, se uloží ihned a čekají: v záhlaví serveru se objeví tlačítko **Použít změny** a projeví se také při příštím spuštění serveru.

**Automatický restart při pádu** znovu spustí spadlý server, přičemž se čeká delší doba mezi pokusy (5, 10, pak 20 sekund) a po 3 pokusech během 10 minut se zastaví. Přeskakuje pády, které panel rozpozná jako problém s nastavením (EULA, špatná Java, svět z novější verze, obsazený port, nedostatek paměti, chybějící klíč CurseForge), protože ty je třeba nejprve opravit. Pokud jiná akce se serverem právě pracuje (záloha, obnovení, změna portu), čeká až 30 minut a jakmile někdo server sám nezastaví nebo nespustí, vzdá to.

Přímé změny nastavení vždy zůstávají platné napříč restarty. Změna PvP nebo obtížnosti provedená pomocí lišty **Ovládání světa**, přepnutí bílé listiny na kartě **Hráči** nebo úprava `server.properties` v editoru **Soubory** odstraní odpovídající proměnnou prostředí (pokud byla nastavena) a označí server k přestavbě, takže hodnota na disku vyhraje místo toho, aby byla znovu potvrzena obrazem kontejneru při příštím spuštění.

![Nastavení serveru](/docs/images/server-settings.png)

**O měřiči paměti.** "RAM (Java heap)" je předána Javě jako její počáteční i maximální halda a Java vyplní přidělenou haldu do první minuty, s nebo bez předvoleb Aikar / MeowIce. Měřič paměti se tedy ustálí kolem velikosti haldy a zůstane tam, i když nikdo nehraje; značka na měřiči označuje, kde se halda nachází pod limitem kontejneru, a poznámka pod ní to uvádí. Pokud byste raději viděli, jak paměť sleduje skutečné využití, dejte serveru menší počáteční haldu pomocí **Počáteční halda** v kartě Prostředky na **Nastavení → Konfigurace** (nebo v části **Pokročilá nastavení** v průvodci), například 512 MB: na 2 GB haldě to v našich měřeních snížilo nečinné využití z 2,6 GB na přibližně 1,3 GB. Java také potřebuje paměť mimo haldu (asi 0,5 GB u vanilla, 1,5 až 2 GB u velkého modpacku), k čemuž slouží prostor nad limitem kontejneru. Čísla naleznete v README v sekci "Dva limity paměti".

> **Pokročilá nastavení Dockeru** (název kontejneru, síť Dockeru, další mapování portů a další připojení svazků) jsou **pouze pro administrátory**, protože připojení svazku plus přístup panelu k Dockeru je efektivně root na hostiteli. Viz [Uživatelé a role](/docs/users-and-roles/).

### Změna portu hry

Karta **Port hry** na **Nastavení → Konfigurace** přesune server na jiný port kdykoli, s vlastním tlačítkem **Uložit port**. **Použít další volný port** vybere nejnižší volný port a karta zkontroluje jakýkoli port, který zadáte, než jej uložíte. RCON vždy následuje 1000 nad portem hry (výchozí posun). Administrátoři mohou vybrat jakýkoli port od 1024 výše; všichni ostatní vybírají od prvního portu hry (výchozí 25565) výše. Uložení okamžitě použije změnu: zastavený server se jen přesune a běžící server se nejprve zeptá, poté se restartuje na novém portu (svět se nejprve uloží a hráči se znovu připojí na novém portu). Pokud se server na novém portu nemůže spustit, vrátí se ke starému. Změna je odmítnuta, zatímco jiné změny čekají na **Použít změny**, takže je nejprve použijte. Změna portu vyžaduje oprávnění Nastavení na daném serveru.

![Karta Port hry](/docs/images/server-port.png)

![Výzva před restartem běžícího serveru na jeho novém portu](/docs/images/port-restart.png)

## Zprávy o pádech a analýza mclo.gs

Zprávy o pádech (`crash-reports/*.txt` a soubory JVM `hs_err_pid*.log`) jsou automaticky zachyceny, analyzovány do jednorázového souhrnu s výjimkou a podezřelými mody a uvedeny pod **Monitorování → Historie**:

![Karta zprávy o pádu](/docs/images/crash-mclogs-card.png)

Každá karta zprávy nabízí vestavěný prohlížeč (s rozbalovacími sekcemi a zvýrazněnými výjimkami), kopírování stack trace a stažení, plus dvě akce [mclo.gs](https://mclo.gs):

- **Sdílet na mclo.gs** publikuje zprávu jako veřejnou vložku a zkopíruje odkaz: přesně to, co autoři modů a Discord podpory požadují. Odkaz je na zprávě uložen, takže se nic nikdy nenahrává dvakrát.
- **Analyzovat** spustí automatizované přehledy mclo.gs nad vloženým textem: známé problémy s navrhovanými opravami (chybějící závislosti, nesoulady verzí, běžné konflikty modů), vykreslené přímo v panelu.

![Přehledy mclo.gs](/docs/images/crash-insights.png)

Obě akce jsou za explicitním potvrzením, protože vložka je veřejná: zprávy o pádech mohou obsahovat jména hráčů a váš kompletní seznam modů. Panel nikdy nic nenahrává sám.
