---
title: 'Aktualizace'
description: 'Sledujte a aplikujte aktualizace verzí Minecraftu, modpacků, modů a pluginů na všech serverech s politikou pro každý server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Aktualizace** sleduje, co je zastaralé napříč vaší flotilou na jednom místě:

- Verze **Modpacků** ([modpacky](/docs/modpacks/)) oproti Modrinth / CurseForge / indexu vydání GTNH.
- **Vlastní obsah**, který jste přidali sami (mody, datapacky, resource packy, pluginy), každý oproti svému zdroji: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) nebo GitHub Releases. Vyhledávání na GitHubu používá revalidaci ETag, takže denní kontroly sotva zasáhnou jeho limit.
- Zastaralost **Docker image**: ID image každého serverového kontejneru oproti čerstvě staženému tagu (deduplikováno napříč servery se stejným tagem), nabízeno jako upgrade pouze pro přestavbu.
- **Připnutí samostatných verzí**: pro server bez spravovaného balíčku, explicitní připnutí `mc_version` oproti manifestu Mojangu a explicitní proměnná prostředí pro sestavení loaderu (`PAPER_BUILD`, `FORGE_VERSION` a podobně) oproti registru loaderu. Sestavení Paper pocházejí z aktuálního **Fill v3 API** PaperMC (starší koncový bod v2 přestal přijímat nové verze Minecraftu). Na serveru s mody je novější verze Minecraftu nabízena pouze poté, co [kontrola verze](#minecraft-version-compatibility) ukázala, že každý nainstalovaný mod má pro ni sestavení. Připnutý server Forge je nabízen doporučený build Forge, nikdy build starší než ten, ke kterému je připnut, a server připnutý k vydání nikdy nedostane pre-release (ten, který je již na betě, může dostat novější beta nebo vydání). Aplikace sestavení loaderu nejprve provede zálohu před aktualizací. Přesun serveru Forge nebo NeoForge na novou verzi Minecraftu vymaže jeho připnuté číslo sestavení loaderu, protože sestavení je vytvořeno pro jednu verzi Minecraftu; klíčové slovo jako `latest` je zachováno, protože samo sleduje verzi. Chcete-li si sami vybrat konkrétní sestavení, viz [změna verze mod loaderu](#changing-the-mod-loader-version).

![Aktualizace](/docs/images/updates.png)

## Jak to funguje

Panel kontroluje připnuté verze každého serveru oproti upstream zdroji a vypisuje cokoli s novějším vydáním. Odpovídající počet se také objeví na dlaždici "Dostupné aktualizace" na [dashboardu](/docs/dashboard/).

Kontroly probíhají denně podle výchozího [plánu](/docs/schedules/) a na vyžádání pomocí **Zkontrolovat vše nyní**. **Ignorovat** na řádku přestane nabízet danou verzi; novější verze se opět nabídne. **Politika** aktualizací je pro každý server: panel ponechává vše manuální (výchozí, což také drží server mimo tuto stránku), pouze vás upozorní, nebo sám aplikuje aktualizace balíčku ([politika aktualizací](/docs/modpacks/#update-policy)).

## Kompatibilita verzí Minecraftu

Novější verze Minecraftu není upgrade, pokud s ní vaše mody nemohou přijít. Každý server má svou vlastní kartu **Verze** (pod Mody), která na tuto otázku odpovídá:

- Verze, kterou server právě běží, a **nejvyšší verze, pro kterou má každý nainstalovaný mod sestavení**.
- Jedna rozbalovací řádek pro každou budoucí verzi Minecraftu, s počtem připravených modů a počtem těch, pro které zatím nic nebylo publikováno. Otevřete řádek a uvidíte, které mody by zůstaly pozadu a které jsou v pořádku.

![Kompatibilita verzí](/docs/images/server-versions.png)

Stiskněte **Zkontrolovat budoucí verze** pro spuštění. Nic neskenuje samo od sebe: kontrola čte každý jar v modovém adresáři serveru a ptá se Modrinth a CurseForge na každý z nich, takže se to děje pouze tehdy, když o to požádáte. Průběh a částečné výsledky se zapisují během běhu, takže zavření stránky nebo obnovení nic neztratí, a kontrola přerušená restartem panelu to oznámí a nabídne opětovné spuštění. Vše, co přerušená kontrola již vypracovala, je zachováno, takže opětovné spuštění tuto práci neopakuje.

Zpráva popisuje pouze server, pro který byla vytvořena. Změňte verzi Minecraftu, loader nebo samotné mody (přidejte jeden, odeberte jeden, aktualizujte jeden) a zpráva je označena jako zastaralá a přestane se používat, dokud kontrolu znovu nespustíte.

Mody jsou identifikovány ze seznamu souborů samotného modpacku, pokud existuje, a jinak podle obsahu souboru, stejným způsobem, jakým launcher rozpoznává jar. Dva typy modů nelze zodpovědět a ani jeden není odhadován:

- **Nelze identifikovat**: ručně vytvořený jar nebo soukromé sestavení, které žádný registr nerozpozná.
- **Nelze zkontrolovat**: mod z GitHub Releases, Hangar nebo SpigotMC, nebo ten, jehož projekt byl stažen. Tyto nepublikují seznam, pro kterou verzi Minecraftu je každé sestavení určeno.

Dokud je některý z nich nainstalován, panel vůbec nenabídne aktualizaci verze Minecraftu jedním kliknutím, protože nemůže upřímně říci, co by se pokazilo. Aplikace verze nad rámec podpory modů je odmítnuta a pojmenuje mody, které ji blokují.

Mody, které jste **zakázali**, nehrají žádnou roli: server je nenačítá, takže vypnutí modu je skutečný způsob, jak obejít blokátor. Zapnutí nebo vypnutí modu označí zprávu k opětovné kontrole.

Toto se týká serverů, které běží mody: Fabric, Forge, NeoForge a Quilt. Pluginové servery typu Paper si zachovávají chování nejnovějšího vydání a nemají kartu Verze, protože dva z registrů, ze kterých pluginy pocházejí, nic, co by kontrola mohla číst, nepublikují.

![Otevřená verze zobrazující, které mody by zůstaly pozadu](/docs/images/server-versions-expanded.png)

Otevření verze nejprve vypíše mody bez sestavení pro ni (ty, které rozhodují o odpovědi) a připravené ponechá za kliknutím. Velké balíčky načítají stránku modů najednou, takže 300modový server se otevře stejně rychle jako pětmodový.

## Změna verze mod loaderu

Karta **Verze** má také kartu **Verze Loaderu**. Zobrazuje, jaké sestavení Forge, NeoForge, Fabric nebo Quilt má server nainstalované, a kde jej lze změnit, výběr pro přepnutí na jiné.

- **Server Forge, NeoForge, Fabric nebo Quilt** může spustit jakékoli publikované sestavení. Výběr zobrazuje nedávná sestavení pro verzi Minecraftu serveru, s označenými doporučenými a nejnovějšími sestaveními Forge. **Jiné sestavení…** vezme jakékoli starší podle jeho čísla a **Výchozí** se vrátí k tomu, aby si server vybral sám.
- **Modpack Forge nebo Fabric CurseForge** instaluje verzi loaderu, kterou deklaruje jeho vlastní manifest, takže obvyklý způsob, jak ji změnit, je aktualizovat balíček. Když samotný balíček uvádí nesprávnou verzi (mod uvnitř vyžaduje novější Forge, než balíček instaluje), karta ji může přepsat a **Verze Modpacku** ji opět odstraní. Aktualizace balíčku ji také odstraní, protože nová verze deklaruje svůj vlastní loader. Pokud nová verze stále uvádí nesprávnou, nastavte přepsání znovu.
- **Modpack NeoForge CurseForge nebo Modrinth** zobrazuje svůj loader, ale nelze jej přepsat: serverový image aplikuje přepsání pouze na balíčky Forge a Fabric. Jeho loader sleduje verzi balíčku, takže místo toho aktualizujte balíček. Loader balíčku FTB nelze také změnit zde. Jeho karta se obvykle neobjeví, protože vlastní instalátor FTB udržuje záznamy, které panel nečte.

Panel zkontroluje, zda sestavení existuje, než vám cokoli sdělí. Sestavení Forge nebo NeoForge je vytvořeno pro jednu verzi Minecraftu, takže na serveru, který sleduje nejnovější vydání, jeho připnutí také udržuje server na verzi Minecraftu, kterou právě běží (potvrzení to říká). Výběr **Výchozí** poté odstraní připnutí, ale ponechá tuto verzi Minecraftu. Server, který sledoval nejnovější vydání, se může při přestavbě také přesunout na jiný Java image, který daná verze potřebuje. Takový server, který se nikdy nestartoval, je vyzván, aby se nejprve jednou spustil, aby panel věděl, že jde o tuto verzi. Forge přeskočí čísla sestavení (mezi 47.4.13 a 47.4.15 není 47.4.14), takže mod, který "vyžaduje 47.4.14 nebo vyšší", je uspokojen dalším sestavením nahoru a odmítnutí jej pojmenuje. Změna provede zálohu před aktualizací a poté přestaví server. Nové sestavení se nainstaluje při příštím spuštění serveru a karta to až do té doby hlásí.

## Vrácení aktualizace modu

Každé sestavení, ze kterého je mod aktualizován, zůstává ve sdílené knihovně, takže aktualizace, která něco rozbije, je vratná. Řádek modu na kartě **Mody** získá tlačítko **Vrátit zpět**, které vrátí předchozí sestavení. Neexistuje žádné stahování, takže to funguje, i když byl projekt od té doby stažen z registru. Sestavení, od kterého jste se vrátili, se přestane nabízet, dokud se neobjeví novější.

![Vrácení modu na sestavení, ze kterého byl aktualizován](/docs/images/mods-revert.png)

## Aplikace aktualizace

Aktualizace nejsou nikdy tiché. Když se rozhodnete upgradovat balíček (nebo [přepnout na jinou verzi](/docs/modpacks/#changing-the-pack-version), včetně starších), panel:

1. Provede **zálohu před aktualizací** (takže je vratná; ve výchozím nastavení se uchovává posledních 10 záloh před aktualizací na server, viz [uchovávání](/docs/backups/#retention)).
2. Připne přesně novou verzi.
3. Přestaví server, v případě potřeby znovu vyřeší Java runtime.
4. Monitoruje první spuštění s časovým rozpočtem na platformu.

Pokud se server nezapne zdravě, vrátíte se k záloze před aktualizací. Server sledující stabilní verze nikdy nedostane beta verzi a odkaz na changelog ukazuje na skutečný rozdíl pro konkrétní verzi, kde jej zdroj poskytuje. Neúspěšná aktualizace také spustí [upozornění](/docs/integrations/) na Discordu, pokud je integrace nakonfigurována.
