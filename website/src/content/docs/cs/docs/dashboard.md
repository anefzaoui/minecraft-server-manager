---
title: 'Ovládací panel'
description: 'Ovládací panel je vaše základna: každý server, jeho aktuální stav a živý přehled toho, co se děje.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Zpět na přehled dokumentace](/docs/)

Ovládací panel je vaše domovská základna: každý server, jeho aktuální stav a živý přehled toho, co se dělo.

![Dashboard](/docs/images/dashboard.png)

## Souhrnné dlaždice

V horní části:

- **Servery online**: kolik vašich serverů právě běží z celkového počtu.
- **Připojení hráči**: celkový počet hráčů napříč všemi běžícími servery.
- **Dostupné aktualizace**: kolik serverů, balíčků nebo modů má novější verzi ([viz Aktualizace](/docs/updates/)).
- **Docker**: zda se panel může připojit k démonu Dockeru a jeho verze.

Druhý řádek přidává **Přidělená paměť** (a kolik je využito), **Využití úložiště** napříč všemi datovými složkami serverů, **Zdraví · 24h** (pády, zastavení kvůli nedostatku paměti a automatické restarty za poslední den) a **Aktualizace** rozdělené na aktualizace modů a aktualizace na úrovni serveru. Pod nimi **Servery podle stavu** počítá vaše servery v každém stavu a **Přehled prostředků** zobrazuje podíl paměti a CPU každého serveru.

## Karty serverů

Každý server se zobrazuje jako karta s jeho stavem (Běží, Spouští se, Zastaveno, Spadl a mezistavy jako Nezdravý nebo Zaseknutý), typem a verzí Minecraftu, herním portem a jeho značkami. Každá karta zobrazuje využití **hráčů** a **disku** oproti kvótě; běžící servery také zobrazují živé využití **CPU** a **paměti**, které se neustále aktualizuje.

Kliknutím na kartu otevřete daný server. Prázdná karta **Vytvořit server** a tlačítko **Vytvořit server** v horní liště spustí [průvodce vytvořením](/docs/servers/).

Své servery můžete vyhledávat (podle názvu, typu, verze nebo značky), řadit je podle stavu, názvu, velikosti, posledního spuštění nebo vytvoření a přepínat mezi mřížkou a seznamem pomocí přepínače vpravo.

## Poslední aktivita

Přehled ve spodní části zobrazuje nejnovější záznamy z lidsky čitelné auditní stopy panelu: přihlášení, zálohy, exporty šablon, kontroly aktualizací, změny příkazů chatu, spouštění a zastavování serverů a další. Každý záznam je označen serverem, ke kterému patří (nebo samotným panelem), a časem, kdy k němu došlo. **Zobrazit vše** otevře kompletní historii na stránce [Aktivita](/docs/activity/).
