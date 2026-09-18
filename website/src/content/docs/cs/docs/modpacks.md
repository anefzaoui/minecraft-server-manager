---
title: 'Modpacky'
description: 'Stránka Modpacky (a karta Z modpacku v průvodci vytvořením) nainstaluje modpack jako server, vždy připnutý k přesné verzi balíčku, takže restart může'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Modpacky** (a karta **Z modpacku** v [průvodci vytvořením](/docs/servers/)) nainstaluje modpack jako server, vždy **připnutý na přesnou verzi balíčku**, takže restart nikdy potichu neaktualizuje balíček pod vámi.

![Modpacky](/docs/images/modpacks.png)

## Podporované platformy

- **CurseForge** - vyhledejte nebo vložte URL balíčku. Vyžaduje API klíč CurseForge pro vyhledávání a soukromé balíčky (přidejte jej v Nastavení → API klíče).
- **Modrinth** - vyhledávání podle názvu.
- **FTB** - balíčky Feed The Beast.
- **GT New Horizons** - balíček 1.7.10 expert, instalovaný z vlastního indexu vydání GTNH. GTNH vybírá svůj Java runtime pro každou verzi balíčku (2.8.0+ běží na **Java 25** prostřednictvím přibalených patchů lwjgl3ify, starší verze na Java 21 nebo 17) a průvodce zvýší RAM a disk serveru na rozumná minima.
- **Vlastní zip** - vůbec ne publikovaný balíček: nahrajte **export modpacku CurseForge** (zip s `manifest.json`, který aplikace CurseForge vytváří pro ručně vybranou sadu modů) nebo **jakýkoli zip mod jar souborů**. Panel hromadně zpracuje manifest prostřednictvím API CurseForge (nebo identifikuje každý jar podle hashe/otisku/metadat), zobrazí náhled toho, co se hodí, a nainstaluje vše v jednom úkolu - včetně konfiguračních souborů `overrides/` balíčku, pokud se rozhodnete. Mody, jejichž autoři zakazují automatické stahování, jsou uvedeny s odkazem do prohlížeče a slotem pro ruční nahrání místo selhání instalace.

## Jak funguje připnutí

Když vyberete balíček, panel vyřeší přesnou verzi, zaznamená ji a tu nainstaluje. Na stránce **Aktualizace** budete informováni, když bude k dispozici novější verze; aktualizace je záměrná, chráněná akce s před-aktualizační zálohou a možností návratu zpět. Servery se stabilním sledováním nikdy nedostanou beta verzi.

Servery vytvořené na velmi starých verzích panelu (před 0.9.7) mohly zůstat _nepřipnuté_, což znamenalo, že obraz kontejneru by při každém spuštění tiše nainstaloval nejnovější verzi balíčku. Panel nyní tyto opravuje při spuštění: uzamkne každý z nich na verzi, která je skutečně nainstalována (čteno z vlastních záznamů panelu nebo z manifestu instalace obrazu, nikdy čerstvě vyřešené "nejnovější") a zaznamená událost. Pokud nemůže zjistit, co je nainstalováno, stránka Nastavení serveru zobrazí varování s žádostí o ruční výběr verze a jakýkoli pokus o uložení nepřipnuté konfigurace modpacku je odmítnut.

## Politika aktualizací

Každý server má v **Nastavení** politiku aktualizací a všechny tři možnosti znamenají přesně to, co říkají:

- **Pouze ručně** - nic se nikdy nezmění samo od sebe a server je zcela vynechán z odznaku aktualizací a stránky Aktualizace. Režim "nechte mě být": ideální pro ručně vyladěný nebo importovaný balíček, který nikdy nechcete měnit.
- **Upozornit mě** (výchozí) - denní kontrola zobrazí dostupné aktualizace jako odznak a na stránce Aktualizace; jejich aplikace je vždy na vaše kliknutí.
- **Automatická aktualizace** - po naplánované denní kontrole jsou čekající aktualizace **balíčku** aplikovány stejnou chráněnou cestou jako ruční upgrade: před-aktualizační záloha, monitorování stavu a automatický návrat zpět, pokud se nová verze nespustí. Aktualizace, které by přesunuly server na jinou verzi Minecraftu, jsou vždy přeskočeny s událostí - trvalá konverze světa je rozhodnutí, které panel za vás odmítá udělat. Ruční tlačítka "zkontrolovat nyní" pouze kontrolují; nikdy nespouštějí automatické aktualizace.

## Upgrade balíčku

Z připnutého serveru můžete upgradovat na novější verzi jedním akcí. Panel nejprve provede zálohu, vymění připnutou verzi, znovu vytvoří kontejner (znovu vyřeší Javu, pokud nová verze potřebuje jiné runtime) a monitoruje první spuštění, s velkorysým oknem pro velké balíčky jako GTNH, které stahují pár gigabajtů a sestavují svět s několika sty mody při prvním spuštění.
