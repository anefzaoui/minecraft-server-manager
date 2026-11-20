---
title: 'Zálohy Minecraft serveru, které lze skutečně obnovit'
description: 'Jak vytvořit zálohy Minecraft serveru, které lze skutečně obnovit: konzistentní kopie, uložené jinde a alespoň jednou otestované.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Zpět na index dokumentace](/docs/)

Většina serverů má zálohy. Mnohem méně jich má zálohy, které fungují, a rozdíl se zjistí až v ten nejhorší den. Oddělují je tři věci: kopie je konzistentní, nachází se jinde a někdo ji alespoň jednou obnovil.

## Kopírujte svět, zatímco se do něj nezapisuje

Běžící server neustále zapisuje soubory regionů. Pokud je zkopírujete uprostřed zápisu, získáte soubor, který je napůl starý a napůl nový, který se buď nenačte, nebo se načte s dírou v zemi tam, kde kdysi bývala něčí základna. Nic vás nevaruje, protože kopírování proběhlo úspěšně.

Existují dva správné způsoby, jak pořídit kopii:

1. **Zastavte server**, zkopírujte, znovu spusťte. Jednoduché, poctivé a nepopulární kvůli výpadku.
2. **Nechte hru nejprve zastavit zápis.** Spusťte `save-off`, poté `save-all flush`, počkejte, až se dokončí, zkopírujte, poté `save-on`. Svět je po dobu kopírování kompletní a tichý.

Nikdy nepřeskakujte rovnou ke kopírování. Snímek na úrovni souborového systému nebo svazku je v pořádku pouze v případě, že je skutečně atomický, a `cp -r` zatímco hráči umisťují bloky, není.

## Zálohujte více než jen svět

Obnovením samotného světa získáte terén a ztratíte server. Budete také potřebovat:

- `server.properties` a cokoliv jiného, co nastavuje pravidla.
- Mod nebo plugin soubory JAR, přesně ve verzích, které běžely. Svět se nenačte bez modů, které vytvořily jeho bloky.
- Data hráčů, včetně `whitelist.json`, `ops.json` a složek se statistikami a pokroky.
- Verzi balíčku, pokud pochází z balíčku. Zapsání této informace se počítá.

Nejrychlejší kontrola příčetnosti jakékoli zálohy: mohli byste tento server na novém stroji znovu sestavit pouze z archivu? Pokud odpověď vyžaduje větu začínající slovy „a pak bych znovu nainstaloval“, není to kompletní záloha.

## Jedna kopie na stejném disku není záloha

Záloha, která žije na stroji, který chrání, pokrývá přesně jedno selhání: něco jste smazali. Nepokrývá selhání disku, pozastavení účtu poskytovatelem nebo chybu, která smaže celou složku.

Raději jednoduše než dokonale:

- Jedna lokální kopie pro běžný případ, kterým je někdo, kdo ničí, nebo špatná aktualizace.
- Jedna kopie jinde. Jiný stroj, objektové úložiště nebo domácí NAS, který si stahuje noční zálohy přes SSH.
- Dostatek historie, abyste přežili problém, který jste si okamžitě nevšimli. Poškození se často zjistí o několik dní později a pokud uchováváte třídenní zálohy, již jste přepsali tu dobrou.

Sedm denních kopií plus čtyři týdenní pokrývají téměř každý skutečný incident a stojí velmi málo místa.

## Otestujte obnovení, než ho budete potřebovat

Vyberte zálohu, obnovte ji do náhradního serveru a připojte se. To je celý test, trvá patnáct minut a zachytí všechna klasická selhání: archiv postrádající složku s mody, svět, který potřebuje verzi, kterou již neběžíte, oprávnění, která způsobují nečitelnost souborů, zkrácené nahrání.

Udělejte to jednou, když nastavujete zálohy, a ještě jednou po jakékoli velké změně serveru.

## Velikost a jak ji udržet rozumnou

Svět roste, protože hráči prozkoumávají. Svět, kde někdo letěl deset tisíc bloků v přímé linii, nese všechny chunky podél této linie navždy, a většina z těchto chunků již nikdy nebude navštívena.

Tři páky, v pořadí podle toho, kolik vracejí:

1. **Ořízněte nenavštívené chunky.** Nástroje, které prořezávají podle času posledního dotyku, obvykle odstraní velkou část světa s velkým pohybem bez viditelného dopadu na hru.
2. **Správně komprimujte.** Soubory regionů se dobře komprimují; archivy z nich nemají prospěch z ničeho exotického.
3. **Neuchovávejte každou hodinovou kopii po celý rok.** Uchovávání je důležitější než komprese.

## V Minecraft Server Manager

Zálohování používá cestu `save-off`, flush, kopírování, `save-on` a zastavení nebo restart požadovaný uprostřed zálohování je odmítnut, dokud kopírování neskončí, místo aby s ním závodilo. Archiv pokrývá celou složku serveru, takže mody, konfigurace a data hráčů cestují se světem.

Zálohy mohou běžet podle plánu spolu s restarty a příkazy a každý nový server začíná s denním plánem zálohování. Počítání uchovávání každého druhu zvlášť, takže deset naplánovaných kopií, které se nahromadí samy, nemohou vytlačit tu, kterou jste si vzali ručně před rizikovou změnou, a navrch platí omezení stáří a velikosti. Administrátoři to vše změní na stránce Nastavení nebo pro každý server na jeho kartě Zálohy. Obnovení nejprve vezme novou zálohu, takže obnovení do nesprávného bodu v čase je samo o sobě vratné. Svět lze zmenšit samostatně nebo jako součást zálohy, což je páka, na které nejvíce záleží z hlediska velikosti.

Celý panel, včetně každé zálohy, žije pod jednou složkou. Kopírování této složky jinam je polovina příběhu mimo stroj a je to záměrně jediná věc, kterou musíte kopírovat.

Související: [zálohy v panelu](/docs/backups/), [plány](/docs/schedules/),
[zmenšení světa](/docs/world-shrink/), [přesun serveru na jiného hostitele](/docs/guide-moving-a-server/).
