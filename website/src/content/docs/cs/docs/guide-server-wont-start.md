---
title: 'Váš Minecraft server se nespustí'
description: 'Minecraft server, který se nespustí, opraveno v pořadí pravděpodobnosti: log, verze Javy, paměť, EULA a port, a mody.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Zpět na index dokumentace](/docs/)

Postupujte podle tohoto seznamu. Je seřazen podle toho, jak často je daná položka odpovědí, a první čtyři pokrývají většinu případů.

## 1. Přečtěte si posledních dvacet řádků, ne prvních

Přejděte na **konec** logu. Java stack trace se vypisuje od nejvnitřnější chyby, takže horní část textové zdi je nejméně zajímavá. To, co chcete, je poslední řádek `Caused by:` a vše, co následuje. Tento jediný řádek obvykle pojmenuje problém.

Dva tvary vám řeknou, kde jste:

- `Exception in thread "main"` nebo cesta ke crash reportu poblíž konce znamená, že selhal samotný herní server.
- Log se jednoduše zastaví uprostřed řádku, bez jakékoli výjimky, což znamená, že proces byl ukončen zvenčí. Přejděte na bod 3.

## 2. UnsupportedClassVersionError znamená špatnou Javu

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Class file 52 je Java 8, 60 je 16, 61 je 17, 65 je 21, 69 je 25. Zpráva znamená, že server potřebuje novější Javu, než na které běží; opak, starý pack na nové Javě, obvykle selže s chybou mixinu nebo reflexe.

| Minecraft verze  | Java |
| ---------------- | ---- |
| 1.16.5 a starší  | 8    |
| 1.17             | 16   |
| 1.18 a 1.19      | 17   |
| 1.20 až 1.20.4   | 17   |
| 1.20.5 až 1.21.x | 21   |
| 26.1 a novější   | 25   |

Staré packy skutečně potřebují Javu 8. Novější zde není lepší.

## 3. Exit code 137 je kernel, ne mod

Log se zastaví uprostřed věty, není zde žádný crash report a kontejner hlásí 137. To je ukončení kvůli nedostatku paměti: proces si vyžádal paměť, kterou stroj neměl, a proto byl ukončen.

Téměř vždy byl Java heap nastaven na stejné číslo jako paměť stroje. Heap potřebuje paměť stroje **minus** režii samotné JVM, což je 0,5 až 1,5 GB na modovaném serveru. Snižte heap, nebo zvyšte stroj. [Kolik RAM server potřebuje](/docs/guide-server-memory/) obsahuje čísla.

## 4. EULA a port

Dva klasické problémy s jednorázovými opravami:

- `You need to agree to the EULA in order to run the server.` Nastavte `eula=true` v `eula.txt` nebo pomocí proměnné prostředí, kterou vaše nastavení používá.
- `Address already in use` nebo `FAILED TO BIND TO PORT`. Něco jiného drží port 25565, často předchozí kopie stejného serveru, která se nikdy plně nezastavila. Najděte ji a zastavte ji, místo abyste měnili port, jinak budete mít dva.

## 5. Modu chybí závislost

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Modifikace pro Fabric většinou potřebují Fabric API jako samostatný soubor. Modifikace pro Forge a NeoForge uvádějí své závislosti přímo v chybové zprávě. Nainstalujte uvedenou verzi, ne tu nejnovější: "requires 0.91.x" znamená přesně tuto řadu a 0.92 selže při stejné kontrole.

Někdy je chybějící závislostí samotný loader:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Opravou je novější sestavení loaderu, ne jiný mod. "47.4.14 or above" znamená jakékoli sestavení od tohoto čísla nahoru a Forge nepublikuje každé číslo, takže sestavení k instalaci může být to další v řadě. Na modpacku nejprve aktualizujte pack: pack, jehož vlastní verze loaderu je pro jeho mody příliš stará, je chyba pro jeho autora.

## 6. Mod je pro špatný loader nebo verzi

JAR soubor pro jiný loader se neprojeví zdvořile. Očekávejte chybu mixinu, `NoClassDefFoundError` nebo pád uvnitř třídy, o které jste nikdy neslyšeli. Zkontrolujte stránku JAR souboru: loader i verze Minecraftu se musí přesně shodovat. 1.20.1 a 1.20.4 jsou z pohledu modifikací různé hry.

## 7. Svět je z novější verze

```
This world was created by a newer version of Minecraft
```

Svět se upgraduje dopředu a nikdy ne dozadu. Obnovte zálohu z doby před upgradem nebo spusťte verzi, kterou svět očekává. Neexistuje cesta zpětného downgradu, která by zachovala chunky neporušené.

## Když to spadlo po týdnech bezproblémového běhu

Jiná otázka, obvykle jiná odpověď:

- **Spadlo to pod zátěží**, s časováním ukazujícím dlouhé pauzy: garbage collection, takže se podívejte na velikost heapu před modifikacemi.
- **Spadlo to ve stejném bodě ve světě**: poškozený chunk nebo rozbitá entita. Crash report obvykle uvádí souřadnice.
- **Spadlo to hned po aktualizaci**: podezřelý je modifikace, která se aktualizovala, i když stopa ukazuje jinam. Vraťte ji zpět a uvidíte.
- **Spadlo to při restartu, přestože předtím běželo v pořádku**: zkontrolujte disk. Plný disk způsobuje velkolepé a zavádějící chyby.

## Získání pomoci, která skutečně pomůže

Zveřejněte **celý log**, ne poslední řádek, a řekněte, co jste změnili, než se to pokazilo. Vložte ho někam, kde je to určeno, například na [mclo.gs](https://mclo.gs), místo do chatu. Uveďte verzi Minecraftu, loader, pack a jeho verzi a kolik heapu server má. Zpráva s těmito čtyřmi fakty dostane odpověď v jednom příspěvku; bez nich to trvá pět.

## V Minecraft Server Manager

Pády jsou detekovány z ukončení samotného kontejneru, takže server, který zemře ve tři ráno, je zaznamenán s výňatkem logu, místo aby byl nalezen následující den. Obvyklí podezřelí na této stránce (EULA, špatná Java, svět z novější verze, již obsazený port, nedostatek paměti Javy) jsou v tomto logu rozpoznáni a pojmenováni v záznamu historie s tím, co s nimi dělat, a automatický restart je nechá být, protože restart je neopraví. Crash reporty jsou analyzovány při přijetí: výjimka je zvýrazněna, zásobník je sbalitelný a modifikace, které se objeví ve stopě, jsou uvedeny jako podezřelé.

Jakýkoli report lze sdílet na mclo.gs z jeho karty, když potřebujete pomoc (po potvrzení, protože vložení je veřejné), a menu **Download** konzole obsahuje všechny logovací soubory jako jeden zip, takže "post the whole log" je spíše stažení než archeologický projekt. Ukončení kvůli nedostatku paměti je zaznamenáno jako ukončení kvůli nedostatku paměti, což šetří obvyklou hodinu obviňování modu. Pokud něco jiného skutečně potřebuje port, karta **Game Port** v **Settings → Configuration** přesune server na volný.

Příliš starý loader se změní na kartě **Versions** serveru, která zkontroluje, zda sestavení existuje, a před přestavbou serveru pořídí zálohu ([změna verze mod loaderu](/docs/updates/#changing-the-mod-loader-version)).

Související: [kolik RAM server potřebuje](/docs/guide-server-memory/), [výběr loaderu](/docs/guide-choosing-a-loader/), [vytváření a správa serverů](/docs/servers/).
