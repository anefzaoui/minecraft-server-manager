---
title: 'Pozvánky a stránka stavu'
description: 'Pozvěte přátele na server pomocí adresy, verze a klientského modpacku a sdílejte veřejnou stránku stavu, která zobrazuje pouze to, co si vyberete.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Zpět na přehled dokumentace](/docs/)

Dvě záložky ve skupině **Nastavení** serveru pomáhají hráčům jej najít a připojit se k němu: **Pozvánky** obsahuje vše, co kamarád potřebuje k připojení, a **Stránka stavu** publikuje malou veřejnou stránku, která ukazuje, zda je server spuštěný. Obě vyžadují oprávnění **Nastavení** serveru ([uživatelé a role](/docs/users-and-roles/#per-server-permissions)).

## Pozvánky

**Nastavení → Pozvánky** obsahuje kartu **Pozvat přátele**:

- **Adresa ke sdílení** zobrazuje adresy stroje ve vaší lokální síti s herním portem serveru, vaši veřejnou adresu, pokud ji panel dokázal detekovat (hráči mimo vaši síť se k ní dostanou pouze přes přesměrování portů), a **Vlastní adresa…** pro doménu nebo adresu, kterou jste si sami nastavili, například `play.example.com:25565`.
- **Text pozvánky** je zpráva připravená k vložení s názvem serveru, vámi zvolenou adresou a jeho verzí a typem Minecraftu. **Zkopírovat text pozvánky** jej vloží do schránky. Pokud je zapnutý whitelist, text žádá přátele o jejich uživatelské jméno v Minecraftu a karta vám připomene, abyste každého přítele přidali na záložku **Hráči**, než se připojí.
- **Co kamarádi potřebují** říká, co je na straně hráče: nic než správnou verzi Minecraftu pro vanilla nebo plugin server (Paper a podobné), nebo mody serveru pro modovaný server.

### Klientský modpack

Na modovaném serveru karta také nabízí **Stáhnout klientský modpack (.mrpack)**. Kamarádi jej importují do Prism Launcher nebo Modrinth App, který nainstaluje verzi Minecraftu a mod loader serveru, stáhne mody a přidá server do jejich seznamu pro více hráčů s vámi zvolenou adresou.

Soubor je sestaven z modů, které jste sami přidali na server (vlastní overlay modů), pocházejících z Modrinth. Mody z jiných zdrojů jsou místo toho uvedeny na kartě, takže si kamarádi mohou tyto soubory ručně přidat do své složky `mods`. Na serveru vytvořeném z modpacku by si kamarádi měli ve svém launcheru nainstalovat tento balíček ve verzi, na které server běží; záložka **Přehled** zobrazuje verzi.

### Hraní přes internet

**Hraní přes internet (přesměrování portů)** ve spodní části karty vysvětluje stranu routeru: přesměrujte herní port serveru (TCP i UDP) na stroj, na kterém běží panel, a poté sdílejte svou veřejnou adresu s portem. Pokud váš poskytovatel internetu používá CGNAT, přesměrování portů nemůže fungovat a způsobem, jak se připojit, je tunelovací služba (například playit.gg). Panel sám neotevírá porty routeru. Na internet patří pouze herní porty; port panelu a RCON porty udržujte uzavřené ([porty v přehledu](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Stránka stavu

**Nastavení → Stránka stavu** zapne veřejnou stránku pro jeden server, ve výchozím nastavení vypnutou:

1. Zapněte kartu.
2. Zvolte **Adresa stránky**: stránka bude dostupná na `/status/<adresa>` na vašem panelu a adresa je 3 až 40 malých písmen, číslic nebo pomlček, jedinečná napříč vašimi servery.
3. Stiskněte **Uložit**. **Otevřít stránku** a **Zkopírovat odkaz** vám poté poskytnou odkaz ke sdílení.

Kdokoliv s odkazem uvidí název serveru, jeho MOTD, verzi, zda je spuštěný, počet hráčů a dobu provozu, a nic jiného. Stránka nemá žádný odkaz do panelu a nevyžaduje přihlášení. Čte stav serveru z paměti panelu, takže návštěvníci nikdy nezpůsobí práci na Docker daemonu.

Vypnutím stránky se její adresa zachová, takže její opětovné zapnutí obnoví stejný odkaz. Pro vlastní stránku nebo bota [veřejné API](/docs/public-api/) vrací stejný typ stavu jako JSON.

Související: [Discord notifikace](/docs/integrations/), [živá mapa](/docs/live-map/), [vytváření a správa serverů](/docs/servers/).
