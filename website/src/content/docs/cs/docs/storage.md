---
title: 'Úložiště'
description: 'Stránka Úložiště ukazuje, kam se vaše místo na disku ztrácí: využití na server a jeho vývoj v čase.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Úložiště** zobrazuje, kam mizí váš disk: využití na server a jak se vyvíjí v čase.

![Úložiště](/docs/images/storage.png)

## Kóty disku vynucuje panel

Docker neumí omezit využití disku u bind mountů, takže to dělá panel. Indexer velikosti na pozadí prochází datový adresář, ukládá do mezipaměti velikost každého serveru a vynucuje diskovou kótu, kterou nastavíte pro každý server. Když se data serveru (svět + zálohy + vše ostatní) blíží své kóty, panel zastaví nekontrolovaný růst, místo aby nechal jeden server zaplnit váš hostitel.

Nastavte kótu serveru v jeho [nastavení](/docs/servers/). Modifikované servery a jejich [zálohy](/docs/backups/) mohou být velké, takže jim dejte prostor.

## Čištění

Zobrazení Úložiště vám pomůže najít, co promazat (staré zálohy, nepoužívané světy nebo server, který výrazně přerostl očekávání), než vám dojde místo.
