---
title: 'Ovládací panel'
description: 'Ovládací panel je vaše základna: každý server, jeho aktuální stav a živý přehled toho, co se děje.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Zpět na index dokumentace](/docs/)

Ovládací panel je vaše domovská základna: každý server, jeho aktuální stav a živý přehled toho, co se děje.

![Dashboard](/docs/images/dashboard.png)

## Souhrnné dlaždice

V horní části:

- **Servery online** - kolik vašich serverů právě běží.
- **Připojení hráči** - celkový počet hráčů napříč všemi běžícími servery.
- **Dostupné aktualizace** - kolik serverů, balíčků nebo modů má novější verzi ([viz Aktualizace](/docs/updates/)).
- **Docker** - zda se panel může připojit k démonu Dockeru a jeho verze.

## Karty serverů

Každý server se zobrazuje jako karta s jeho stavem (Běží, Spouští se, Zastaveno, Spadl), typem a verzí Minecraftu a herním portem. U běžících serverů také získáte živé údaje o **hráčích**, **CPU**, **paměti** a **disku**, které se neustále aktualizují.

Kliknutím na kartu otevřete daný server. Prázdná karta **Vytvořit server** a tlačítko **Vytvořit server** v horní liště spustí [průvodce vytvořením](/docs/servers/).

Své servery můžete vyhledávat a řadit a přepínat mezi mřížkou a seznamem pomocí přepínače vpravo.

## Nedávná aktivita

Zdroj v dolní části je živý, lidsky čitelný auditní záznam: přihlášení, zálohy, exporty blueprintů, kontroly aktualizací, změny příkazů v chatu, spouštění a zastavování serverů a další. Každý záznam je označen serverem, ke kterému patří (nebo samotným panelem), a časem, kdy se udál. Plná historie je na stránce [Aktivita](/docs/activity/).
