---
title: 'Modpacky'
description: 'Nainstalujte modpacky CurseForge, Modrinth, FTB a GT New Horizons jako servery, vždy připnuté na přesnou verzi balíčku.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Modpacky** (a karta **Z modpacku** v [průvodci vytvořením](/docs/servers/)) nainstaluje modpack jako server, vždy **připnutý na přesnou verzi balíčku**, takže restart nikdy potichu neaktualizuje balíček pod vámi.

![Modpacky](/docs/images/modpacks.png)

## Podporované platformy

- **CurseForge**: vyhledávání podle názvu. Vyžaduje API klíč CurseForge (přidejte jej v **Nastavení → API klíče**).
- **Modrinth**: vyhledávání podle názvu.
- **FTB**: balíčky Feed The Beast, pouze přes API (číselné ID balíčku plus explicitní ID verze). Panel zatím nekontroluje aktualizace balíčků FTB.
- **GT New Horizons**: expert balíček 1.7.10, instalovaný z vlastního indexu vydání GTNH. GTNH vybírá svou Java runtime pro každou verzi balíčku (2.8.0+ běží na **Java 25** přes svázané lwjgl3ify patche, starší verze na Java 21 nebo 17) a průvodce zvyšuje RAM a disk serveru na rozumná minima.
- **Vlastní zip**: vůbec žádný publikovaný balíček. Nahrajte **export modpacku CurseForge** (zip s `manifest.json`, který aplikace CurseForge vytváří pro ručně vybranou sadu modů), **Modrinth `.mrpack`**, nebo **jakýkoli zip souborů modů**. Panel hromadně zpracuje manifest (nebo identifikuje každý jar soubor podle hashe/otisku/metadat), zobrazí náhled toho, co se hodí, a nainstaluje vše v jednom úkolu, včetně konfiguračních souborů z `overrides/` balíčku, pokud se rozhodnete. Mody, jejichž autoři zakazují automatické stahování, jsou uvedeny s odkazem do prohlížeče a místem pro ruční nahrání místo selhání instalace.

## Jak funguje připnutí

Když vyberete balíček, panel vyřeší přesnou verzi, zaznamená ji a nainstaluje. Na stránce **Aktualizace** budete informováni, když bude k dispozici novější verze (pokud zásada [aktualizace serveru](#update-policy) není **Pouze ručně**); aktualizace je záměrná, chráněná akce s před-aktualizační zálohou a návratem zpět. Servery sledující stabilní verze nikdy nedostanou beta verzi. Karta **Verze** samotného serveru odpovídá na druhou část otázky: které budoucí verze Minecraftu mohou mody, které skutečně má, následovat ([aktualizace](/docs/updates/#minecraft-version-compatibility)).

Verze mod loaderu je také dodávána s balíčkem: server instaluje sestavení Forge, NeoForge nebo Fabric, které balíček deklaruje. Pokud Forge nebo Fabric CurseForge balíček deklaruje verzi, která je pro jeho vlastní mody příliš stará, karta **Verze** ji může přepsat, dokud nebude balíček opraven; aktualizace balíčku přepsání odstraní, protože nová verze deklaruje svou vlastní ([změna verze mod loaderu](/docs/updates/#changing-the-mod-loader-version)).

Servery vytvořené na velmi starých verzích panelu (před 0.9.7) mohly zůstat _nepřipnuté_, což znamenalo, že obraz kontejneru tiše instaloval nejnovější verzi balíčku při každém spuštění. Panel nyní tyto opravuje při startu: uzamkne každý z nich na verzi, která je skutečně nainstalována (čteno z vlastních záznamů panelu nebo z manifestu instalace obrazu, nikdy z nově vyřešené "nejnovější") a zaznamená událost. Pokud nemůže zjistit, co je nainstalováno, stránka Nastavení serveru zobrazí varování s tlačítkem **Vybrat verzi…** (balíčky CurseForge, Modrinth a GTNH), které otevře [výběr verze](#changing-the-pack-version), a jakýkoli pokus o uložení nepřipnuté konfigurace modpacku je zcela odmítnut.

## Zásada aktualizací

Každý server má kartu **Zásada aktualizací** na své kartě **Nastavení → Konfigurace** a všechny tři možnosti znamenají přesně to, co říkají:

- **Pouze ručně** (výchozí): nic se nikdy nemění samo od sebe a server je zcela vynechán z odznaku aktualizací a stránky Aktualizace. Režim "nechte mě být": ideální pro ručně vyladěný nebo importovaný balíček, který nikdy nechcete, aby byl dotčen. Nezamyká verzi: [**Změnit verzi…**](#changing-the-pack-version) funguje pod každou zásadou. Chcete-li být informováni o nových verzích a aplikovat je jedním kliknutím, vyberte **Upozornit mě**.
- **Upozornit mě**: denní kontrola zobrazí dostupné aktualizace jako odznak a na stránce Aktualizace; jejich aplikace je vždy na vaše kliknutí.
- **Automatická aktualizace**: po plánované denní kontrole jsou čekající aktualizace **balíčku** aplikovány stejnou chráněnou cestou jako ruční aktualizace: před-aktualizační záloha, monitorování stavu a automatický návrat zpět, pokud se nová verze nespustí. Aktualizace, které by přesunuly server na jinou verzi Minecraftu, jsou vždy přeskočeny s událostí místo toho: převod světa natrvalo je rozhodnutí, které panel za vás odmítá udělat. Ruční tlačítka **Zkontrolovat nyní** pouze kontrolují; nikdy nespouštějí automatické aktualizace.

## Aktualizace balíčku

Z připnutého serveru můžete aktualizovat na novější verzi jedním akcí. Panel nejprve vytvoří zálohu, vymění připnutou verzi, přestaví server (znovu vyřeší Javu, pokud nová verze potřebuje jinou runtime) a monitoruje první spuštění, s velkorysým oknem pro velké balíčky jako GTNH, které stahují pár gigabajtů a sestavují svět s několika sty mody při prvním spuštění.

## Změna verze balíčku

Chcete-li spustit konkrétní verzi, novější nebo starší, použijte **Změnit verzi…** na kartě balíčku na kartě **Přehled** serveru. Na stránce **Modpacky** otevření karty nainstalovaného balíčku poskytuje stejnou volbu: vyberte verzi v rozbalovací nabídce a klikněte na **Přepnout na tuto verzi**. Obě vyžadují oprávnění **Obsah** serveru a obě jsou k dispozici pro balíčky CurseForge, Modrinth a GTNH (balíčky FTB zatím nemají seznam verzí). Seznam zobrazuje 25 nejnovějších verzí pro CurseForge a Modrinth a každé vydání GTNH.

Přepnutí probíhá stejnou chráněnou cestou jako aktualizace: před-aktualizační záloha, nový pin, přestavba a sledované první spuštění, s jedním kliknutím pro návrat zpět, pokud se server nespustí zdravě. Vaše vlastní mody jsou přeneseny, stejně jako mody balíčku, které jste zakázali, spolu s dalšími nastaveními instalace balíčku (vynucené mody, ignorované soubory, další projekty). Instalace jiného balíčku začíná tato nastavení znovu, protože dávají smysl pouze pro balíček, pro který byly vytvořeny.

Každá verze je uvedena s verzí Minecraftu, kterou běží, ve srovnání s verzí, kterou váš svět naposledy uložil:

- **Stejná verze Minecraftu**: přepnutí po normálním potvrzení. Návrat ke starší verzi balíčku může odstranit bloky a předměty z modů, které tato verze nemá, takže záloha zůstane na kartě Zálohy tak či tak.
- **Novější verze Minecraftu**: povoleno po potvrzení, které varuje, že svět je natrvalo převeden. Záloha provedená nejprve je jediná cesta zpět ke starému světu.
- **Starší verze Minecraftu**: nedostupné. Minecraft nemůže načíst svět na starší verzi, než na které byl naposledy uložen, takže panel odmítne, místo aby nechal server, který padá při spuštění.
