---
title: 'Konzole a příkazy chatu'
description: 'Karta Konzole streamuje serverový log v reálném čase a poskytuje pole pro zadávání příkazů, kterým můžete odesílat libovolné serverové příkazy.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Zpět do indexu dokumentace](/docs/)

## Živá konzole

Karta **Konzole** streamuje log serveru v reálném čase a poskytuje vám pole pro zadávání příkazů, kterým můžete odesílat libovolné příkazy serveru. Žádný `docker exec`, žádné SSH. Výstup se zobrazuje přímo, včetně barev. Odesílání příkazů vyžaduje oprávnění Console u daného serveru; bez něj můžete stále sledovat log.

Nad logem můžete filtrovat řádky podle textu (nebo `/regex/`) a podle úrovně (INFO, WARN, ERROR). Možnost **Stáhnout** nabízí nedávný výstup, celý soubor `latest.log` nebo všechny logovací soubory jako zip.

![Konzole](/docs/images/server-console.png)

Konzole je také místo, kde panel čte stav serveru: sleduje log, aby klasifikoval fázi spouštění („Načítání modů“, „Generování světa“, „Dokončování spouštění“) a volá `list`, aby sledoval, kdo je online, takže dashboard a karty serverů vždy odrážejí realitu.

Toto pravidelné dotazování otevírá krátkodobé RCON připojení v každém cyklu, které se v logu serveru objeví jako pár `Thread RCON Client … started` / `shutting down` zhruba každých ~20 sekund, a (na serverech, jejichž jádro nebo pluginy to opakují) řádek `Rcon issued server command: …` pro každý dotaz pouze pro čtení (`list` pro počty hráčů, plus čtení `time query …` a `gamerule <name>`, když je otevřená sekce Ovládání světa). Přepínač **Skrýt šum konzole** nad logem tyto řádky filtruje (spolu s řádky spouštění RCON listeneru). Je ve výchozím stavu zapnutý a zapamatovaný pro každý prohlížeč; vypněte jej, abyste viděli surový stream.

Příkazy odeslané z panelu mohou být oznámeny ve hře pod označením specifickým pro daný server (pole **Oznámit jako…**), takže hráči vědí, že jednal operátor, nikoli tajemná konzole.

## Chat

**Konzole → Chat** odesílá zprávy do hry, zatímco server běží: **Formátované** zprávy přijímají barvy a formátování a mohou být odeslány všem nebo jednomu online hráči, a **Prostý** text odešle jednoduché vysílání `[Server]` všem.

![Konzole → Chat](/docs/screenshots/04-chat.png)

## Příkazy chatu

Příkazy chatu (**Konzole → Příkazy**) umožňují hráčům spouštět akce panelu zadáním příkazu s prefixem ve chatu hry, například `!spawn` pro náhodné teleportování. Detekce je založena na logu a provádění probíhá přes server, takže **nejsou vyžadovány žádné mody**.

![Příkazy chatu](/docs/images/chat-commands.png)

Každý příkaz má:

- **Spouštěč** (např. `spawn`), zadaný po **prefixu** serveru (`!` ve výchozím stavu, jeden nebo dva znaky, nikdy `/`).
- **Akci**: náhodný teleport, teleport na strukturu, teleport do biomu nebo spuštění syrových příkazů konzole.
- **Úroveň oprávnění**: všichni, hráči na whitelistu nebo pouze operátoři.
- **Osobní prodlevu** (ve výchozím stavu 30 sekund) a přizpůsobitelné zprávy o čekání / úspěchu / neúspěchu s placeholdery jako `{distance}`.

### Poznámka k bezpečnosti

Příkazy, které mohou server poškodit (`stop`, `op`, `ban`, `whitelist` a podobné), jsou povoleny pouze u spouštěčů s oprávněním **pouze pro operátory**. Panel tyto příkazy kontroluje, i když jsou vnořené do řetězce `execute … run …`, takže spouštěč s nízkým oprávněním nemůže propašovat nebezpečný příkaz. Běžný text chatu, který pouze zmiňuje tato slova (jako zpráva `say`), zůstává nedotčen.
