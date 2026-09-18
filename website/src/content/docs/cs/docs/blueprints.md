---
title: 'Šablony'
description: 'Šablona zachycuje celou konfiguraci serveru (typ, verze, zdroje, prostředí, připnutí balíčku a volitelně jeho konfiguraci a svět) do jediného souboru.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Zpět na index dokumentace](/docs/)

**Blueprint** zachycuje celou konfiguraci serveru (typ, verzi, zdroje, prostředí, připnutí balíčku a volitelně jeho konfiguraci a svět) do jediného přenosného souboru, ze kterého můžete vytvořit nové servery.

![Blueprints](/docs/images/blueprints.png)

## Exportování

Ze serveru exportujte blueprint a vyberte, co chcete zahrnout: konfiguraci vždy a volitelně vložené soubory a svět. Výsledek se uloží do vaší knihovny blueprintů a lze jej stáhnout a sdílet.

## Importování a vytváření z blueprintu

Importujte soubor blueprintu (nebo si vyberte jeden z knihovny) a vytvořte nový server předkonfigurovaný přesně jako originál. Je to nejrychlejší způsob, jak:

- Spustit identické servery (síť minihrových serverů, stagingové kopie produkce).
- Přesunout server mezi panely.
- Uchovat známou, funkční šablonu, ke které se můžete kdykoli vrátit.

Protože blueprint zaznamenává přesné [připnutí balíčku](/docs/modpacks/), server s modpackem vytvořený z blueprintu nainstaluje stejnou připnutou verzi bez překvapivých upgradů.
