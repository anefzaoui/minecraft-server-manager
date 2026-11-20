---
title: 'Šablony'
description: 'Šablony ukládají celou konfiguraci serveru Minecraft jako znovupoužitelný recept pro vytváření nových serverů. Tajné klíče nikdy nejsou zahrnuty.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Zpět na index dokumentace](/docs/)

**Šablona** zachycuje celou konfiguraci serveru (typ, verzi, zdroje, prostředí, připnutí balíčku, vlastní mody a volitelně jeho konfiguraci a svět) do jediného přenosného souboru `.mcserver.zip`, ze kterého můžete vytvořit nové servery. Tajné údaje (hesla, tokeny a klíče v prostředí) se do šablony nikdy nezapisují.

![Šablony](/docs/images/blueprints.png)

## Exportování

Na kartě serveru **Nastavení → Konfigurace** použijte **Exportovat jako šablonu** a vyberte, co chcete zahrnout: vždy konfiguraci serveru, jeho konfigurační adresáře (standardně zapnuto) a volitelně samotné soubory vlastních modů (větší soubor, který se nainstaluje bez stahování čehokoli) a aktivní svět. Výsledek se uloží do vaší knihovny šablon a lze jej stáhnout ke sdílení.

**Klonovat server**, na stejné kartě, provede export a import v jednom kroku k vytvoření kopie serveru, s jeho světem nebo bez něj.

## Importování a vytváření ze šablony

Importujte soubor šablony (**Importovat šablonu** na stránce **Šablony**) nebo si vyberte jednu z knihovny (**Vytvořit server** na její kartě nebo na kartě **Ze šablony** v průvodci) a vytvořte nový server předkonfigurovaný přesně jako originál. Nový server získá vlastní porty a nové heslo RCON. Vlastní mody, které nebyly vloženy, se stáhnou znovu a zkontrolují se proti hashům, které šablona zaznamenala. Knihovna také začíná se dvěma výchozími šablonami, jednou pro Paper a jednou pro Fabric.

Je to nejrychlejší způsob, jak:

- Spustit identické servery (síť minihrových serverů, stagingové kopie produkčních serverů).
- Přesunout server mezi panely.
- Uchovat známou dobrou šablonu, ke které se můžete vždy vrátit.

Protože šablona zaznamenává přesné [připnutí balíčku](/docs/modpacks/), server s modpackem vytvořený ze šablony nainstaluje stejnou připnutou verzi bez překvapivých upgradů.
