---
title: 'Úložiště'
description: 'Zjistěte, kam mizí místo na disku, omezte každou složku serveru kvótou na disku a vyčistěte to, co již nepotřebujete.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Úložiště** zobrazuje, kam mizí vaše místo na disku: využití podle kategorií, jednotlivé servery proti jejich kvótám, největší soubory a jak celkové využití kolísá v průběhu posledních skenů. Je určena pouze pro administrátory.

![Úložiště](/docs/images/storage.png)

## Diskové kvóty vynucuje panel

Docker neumí omezit využití disku bind mountem, takže to dělá panel. Proces na pozadí prochází složku s daty (každých 15 minut, po změnách nebo když stisknete **Znovu skenovat**), ukládá do mezipaměti velikost každého serveru a vynucuje diskovou kvótu, kterou nastavíte pro každý server. Akce, která by způsobila, že složka serveru (svět, mody, konfigurace, logy a vše ostatní v ní) překročí svou kvótu, například instalace modu, světa nebo nahrání souborů, je zablokována, dokud se neuvolní místo nebo se nezvýší kvóta, místo aby jeden server zaplnil váš hostitel.

Nastavte kvótu serveru v jeho [nastavení](/docs/servers/#server-settings). Zapnutí možnosti **Zastavit server při překročení kvóty** tamtéž také zastaví běžící server, jakmile jeho složka vzroste o více než 10 % nad kvótu, a zaznamená to do historie serveru. Modifikované servery mohou být velké, takže jim dejte dostatek prostoru. [Zálohy](/docs/backups/) jsou ukládány odděleně a nepočítají se do kvóty.

## Vyčištění

Karta **Vyčištění jedním kliknutím** uvolní místo, které může panel bezpečně získat zpět: dočasné soubory starší než hodinu, osiřelé soubory knihoven a archivované logy a výpisy chyb starší než 30 dní. Každá z nich ukazuje, kolik místa uvolní, a otevře náhled, než se cokoli smaže. Seznamy **Podle kategorie** a **Největší soubory** odkazují přímo do správce souborů, takže můžete najít, co dalšího promazat, než vám dojde místo.
