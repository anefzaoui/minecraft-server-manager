---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: který z nich?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge nebo Quilt: jaký typ serveru pro Minecraft spustit, podle toho, co nainstalují vaši hráči.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Zpět na přehled dokumentace](/docs/)

Vyberte podle toho, co chcete, aby si hráči nainstalovali, ne podle toho, co zní nejrychleji.

| Chcete                                         | Spusťte toto         | Hráči instalují |
| ---------------------------------------------- | -------------------- | --------------- |
| Survival s přáteli, nic neobvyklého            | Vanilla              | Nic             |
| Veřejný server s hodnostmi, pozemky a moderací | Paper                | Nic             |
| Konkrétní modpack z CurseForge nebo Modrinth   | Cokoli je uvedeno    | Balíček         |
| Moderní modpack, který si sami vytváříte       | Fabric nebo NeoForge | Stejné mody     |
| Starý balíček z éry 1.7 až 1.12                | Forge                | Stejné mody     |

To je pro většinu lidí celé rozhodnutí. Zbytek této stránky vysvětluje proč.

## Pluginy a mody nejsou totéž

Toto je rozlišení, na kterém vše ostatní závisí.

**Pluginy** běží pouze na serveru. Načítají je Paper, Spigot a Bukkit. Hráči se připojují s obyčejným,
neupraveným klientem a nikdy se o nich nedozví. Cokoli, co se zásadně týká pravidel, oprávnění,
ekonomiky, pozemků, minihier nebo moderace, je plugin, a proto téměř každý veřejný server používá Paper.

**Mody** mění samotnou hru: nové bloky, nové dimenze, nové stroje. Klient musí načíst stejné mody
jako server, jinak nemůže pochopit, co mu server říká. Kdokoli, kdo se připojuje k modovanému serveru,
nejprve nainstaluje balíček.

Server nemůže smysluplně existovat jako obojí. Existují hybridní projekty, které přidávají API pro
pluginy k mod loaderu, a fungují, dokud nezačnou selhávat, obvykle v nejhorší možnou chvíli. Pokud
potřebujete obojí, spusťte proxy s modovaným serverem a za ním server s pluginy, spíše než jeden hybrid.

## Stránka s pluginy

**Paper** je výchozí volba. Je to fork Spigotu s roky optimalizací výkonu a konfiguračním souborem
pro téměř každé chování, které kdy administrátora rozčilovalo. Pluginy z éry Bukkitu většinou stále
fungují.

**Purpur** je fork Paperu s ještě více možnostmi nastavení, včetně těch ovlivňujících hratelnost.
Použijte ho, pokud chcete tato specifická nastavení; jinak Paper.

**Vanilla** stojí za to používat, když jde o nezměněnou hru. Je pomalejší s mnoha hráči a nemá systém
oprávnění, takže moderace je manuální.

Paper ve výchozím nastavení mění některé chování vanilla ve jménu výkonu. Pokud vám na serveru nefunguje
redstone zařízení z videa, je to obvykle důvod, a obvykle je to nastavení.

## Stránka s mody

**Fabric** je malý, aktualizuje se na novou verzi Minecraftu během několika dnů a nese většinu moderních
modů pro výkon. Téměř každý Fabric mod také vyžaduje Fabric API, což je samostatné stažení.
Pokud je vaším cílem rychlý server s hrstkou modů pro usnadnění života, je to ono.

**NeoForge** je místo, kde ekosystém starého Forge nyní pracuje pro aktuální verze. Oddělil se od
Forge během verze 1.20.1 a většina velkých balíčků vytvořených pro verze 1.20.2 a novější cílí na něj.
Pokud dnes začínáte nový náročný balíček, je to ono.

**Forge** stále ovládá minulost. Vše z éry 1.7.10, 1.12.2 a 1.16.5, což je velká část oblíbených
balíčků, je Forge a vždy bude. Ponechte si ho pro ně.

**Quilt** je fork Fabricu, který spouští většinu Fabric modů. Existuje z dobrých důvodů, ale pokud
nemáte specifický důvod si ho vybrat, zvolte Fabric.

Mody pro jeden loader neběží na druhém. Stránka modu, která uvádí Fabric, znamená Fabric.

## Pokud instalujete balíček, rozhoduje balíček

Nevybírejte. Balíček uvádí svůj loader a přesnou verzi Minecraftu a obojí se musí shodovat.
"Dost blízko" zde neexistuje: balíček pro 1.20.1 neběží na 1.20.4 a NeoForge balíček pro 1.20.1
neběží na Forge pro 1.20.1.

Nainstalujte balíček podle jeho ID nebo odkazu, namísto ručního výběru modů, a připněte verzi.
Balíčky se aktualizují a aktualizace, která vás zastihne uprostřed sezóny, je způsob, jak se světy
poškodí.

## Která verze Javy

Požadavek Minecraftu se s hrou posouvá a spuštění nesprávné verze vyvolá nepříliš nápomocnou
chybu `UnsupportedClassVersionError` namísto jasné zprávy.

| Verze Minecraftu | Java |
| ---------------- | ---- |
| 1.16.5 a starší  | 8    |
| 1.17             | 16   |
| 1.18 a 1.19      | 17   |
| 1.20 až 1.20.4   | 17   |
| 1.20.5 až 1.21.x | 21   |
| 26.1 a novější   | 25   |

Staré balíčky opravdu potřebují Javu 8; toto je jedno z mála míst v softwaru, kde je nejnovější verze
nesprávná.

## V Minecraft Server Manager

Průvodce vytvořením se ptá, co chcete spustit, a vybere verzi Javy z výše uvedené tabulky, takže
nesoulad nikdy nenastane náhodou. Vanilla, Paper a Purpur jsou na kartě **Vanilla**; karta
**Z modů** přijímá Fabric, Forge, NeoForge nebo Quilt, s verzí Minecraftu a sestavením loaderu
(nejnovější, nebo vámi připnuté). Instalace balíčku z CurseForge, Modrinth nebo GT New Horizons
jej připne na přesnou verzi. Aktualizace probíhá pouze tehdy, když ji použijete (nebo po denní kontrole,
pokud je zásada aktualizace serveru **Automatická aktualizace**), vždy nejprve vytvoří zálohu
a lze ji vrátit zpět.

Prohlížeč modů ví, který loader server používá, a filtruje to, co nabízí, takže Fabric jar se nemůže
omylem dostat na NeoForge server.

Související: [vytváření a správa serverů](/docs/servers/), [modpacky](/docs/modpacks/),
[kolik RAM server potřebuje](/docs/guide-server-memory/).
