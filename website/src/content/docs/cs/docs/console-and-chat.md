---
title: 'Konzole a příkazy chatu'
description: 'Karta Konzole streamuje serverový log v reálném čase a poskytuje pole pro zadávání příkazů, kterým můžete odesílat libovolné serverové příkazy.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Zpět na rejstřík dokumentace](/docs/)

## Živá konzole

Karta **Konzole** streamuje deník serveru v reálném čase a poskytuje vám pole pro zadávání příkazů k odesílání libovolných příkazů serveru. Žádný `docker exec`, žádné SSH. Výstup se vrací přímo, včetně barev.

![Konzole](/docs/images/server-console.png)

Konzole je také místo, kde panel čte stav serveru: sleduje deník, aby klasifikoval fázi spouštění („Načítání modů“, „Generování světa“, „Dokončování spouštění“) a volá `list`, aby sledoval, kdo je online, takže panel a karty serverů vždy odrážejí realitu.

Toto sledování otevírá krátkodobé připojení RCON v každém cyklu, které server zaznamenává jako pár `Thread RCON Client … started` / `shutting down` každých ~20 sekund, a (na serverech, jejichž jádro nebo pluginy to echoují) řádek `Rcon issued server command: …` pro každý dotaz pouze pro čtení – `list` pro počty hráčů, plus `time query …` a `gamerule <name>` čtení, zatímco je otevřená stránka Ovládání světa. Přepínač **Skrýt RCON šum** nad deníkem filtruje tyto řádky (spolu s řádky spouštění posluchače RCON). Je zapnutý ve výchozím nastavení a zapamatovaný pro prohlížeč; vypněte jej, abyste viděli surový stream.

Příkazy odeslané z panelu mohou být oznámeny ve hře pod označením pro každý server, takže hráči vědí, že jednal operátor, nikoli tajemná konzole.

## Příkazy v chatu

Příkazy v chatu umožňují hráčům spouštět akce panelu zadáním příkazu s předponou v chatu hry, například `!spawn` pro náhodné teleportování. Detekce je založena na deníku a provádění probíhá přes server, takže **nejsou vyžadovány žádné mody**.

![Příkazy v chatu](/docs/images/chat-commands.png)

Každý příkaz má:

- **Spouštěč** (např. `spawn`) a **předponu** (výchozí `!`).
- **Akci**: náhodný teleport, teleport do struktury, teleport do biomu nebo spuštění syrových příkazů konzole.
- **Úroveň oprávnění**: všichni, hráči na whitelistu nebo pouze operátoři.
- **Omezení** a přizpůsobitelné zprávy o čekání / úspěchu / neúspěchu se zástupnými symboly jako `{distance}`.

### Poznámka k bezpečnosti

Příkazy, které mohou zničit server (`stop`, `op`, `ban`, `whitelist` a podobné), jsou povoleny pouze u spouštěčů **pouze pro operátory**. Panel je kontroluje, i když jsou vnořeny do řetězce `execute … run …`, takže spouštěč s nízkým oprávněním nemůže propašovat nebezpečný příkaz. Běžný text chatu, který pouze zmiňuje tato slova (jako zpráva `say`), zůstává nedotčen.
