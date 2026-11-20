---
title: 'Zálohy'
description: 'Stránka Zálohy zobrazuje všechny snímky napříč vaší flotilou, s velikostí, důvodem a stářím, filtrovatelné podle serveru a podle důvodu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Zálohy** zobrazuje všechny snímky napříč vaší sítí, s velikostí, důvodem a stářím, filtrovatelné podle serveru a důvodu.

![Zálohy](/docs/images/backups.png)

## Vytváření zálohy

Ze **Záložky Zálohy** serveru (nebo pomocí [plánu](/docs/schedules/)) můžete jedním kliknutím vytvořit snímek celé složky serveru. Panel nejprve uspí svět (`save-off` → `save-all`), zabalí data do ZIPu, poté znovu povolí ukládání (`save-on`), takže zálohy jsou konzistentní i na běžícím serveru. Komprese běží v samostatném vlákně na pozadí, takže neblokuje panel. Záloha spuštěná přes API může obsahovat poznámku.

Každý archiv je **kontrolován na integritu** v okamžiku zápisu: panel znovu otevře ZIP a přečte jeho adresář. Poškozený nebo neotevřený archiv je smazán a požadavek na zálohu selže okamžitě, místo aby se problém projevil o měsíce později, kdy je obnovení jedinou věcí mezi vámi a ztrátou dat. Archiv s nulovým počtem záznamů (server, který nikdy neběžel) je povolen, ale označen v události.

Zaškrtněte **"Po dokončení také zmenšit svět"** (na kartě Zálohy nebo v plánu zálohování) pro odstranění zřídka navštěvovaných chunků po bezpečném uložení archivu (viz **[Zmenšení světa](/docs/world-shrink/)**). Zmenšení běží pouze při zastaveném serveru; na běžícím serveru záloha proběhne a zmenšení se přeskočí.

![Zálohy serveru](/docs/images/server-backups.png)

## Důvody záloh

Zálohy jsou označeny důvodem, proč byly pořízeny:

- **manuální**: klikli jste na **Zálohovat nyní**. Nahrazení aktivního světa serveru jedním z knihovny nejprve také pořídí `manuální` zálohu.
- **plánované**: vytvořeno [plánem](/docs/schedules/). Každý nový server je také automaticky osazen denní plánovanou zálohou (střídavě mezi 02:00 a 05:59), takže server má automatické pokrytí od prvního dne, nejen před aktualizacemi.
- **před aktualizací**: pořízeno automaticky před upgradem balíčku nebo změnou verze Minecraftu, takže upgrade je vždy vratný.
- **před obnovením**: pořízeno automaticky těsně před obnovením nebo resetem světa, jako bezpečnostní síť pro případ, že obnovení není to, co jste chtěli.

## Uchovávání

Uchovávání je **limitováno na server, na důvod**: nejnovější v každé skupině jsou ponechány, starší jsou automaticky promazány po každé úspěšné záloze:

| Důvod            | Ve výchozím nastavení ponecháno |
| ---------------- | ------------------------------- |
| plánované        | 10                              |
| před aktualizací | 10                              |
| manuální         | 20                              |
| před obnovením   | 5                               |

`před obnovením` (v panelu nazývané bezpečnostní zálohy) má svůj vlastní malý prostor právě proto, aby automatická bezpečnostní záloha nikdy nemohla odstranit `manuální` zálohu, kterou jste záměrně ponechali.

Dva volitelné stropy platí nad rámec počtů na důvod, oba jsou ve výchozím nastavení vypnuté: **maximální stáří** (zálohy starší než N dní jsou promazány, bez ohledu na jejich důvod) a **maximální celková velikost** na server (nejstarší jsou promazány, dokud se celková velikost nevejde: nejprve bezpečnostní zálohy, pak plánované a pak zbytek). Nejnovější záloha serveru není nikdy promazána žádným stropem.

### Změna nastavení

Administrátoři nastavují celofiremní politiku v kartě **Uchovávání záloh** na stránce **Nastavení** (**Vyplnit vestavěné hodnoty** vrátí výchozí hodnoty výše do formuláře, připravené k uložení). Server se může lišit v kterékoli ze šesti hodnot: otevřete jeho kartu **Zálohy** a rozbalte **Uchovávání pro tento server**. Každé pole je prázdné, pokud jej server nenastavuje, a prázdné pole následuje celofiremní hodnotu (zobrazenou uvnitř). Server tedy může například ponechat 3 plánované zálohy a pro vše ostatní použít celofiremní hodnoty; vymazáním pole se vrátí na celofiremní hodnotu.

![Karta Uchovávání záloh v Nastavení](/docs/images/settings-retention.png)

![Uchovávání pro tento server na kartě Zálohy serveru](/docs/images/server-retention.png)

Uložení nikdy nic samo o sobě nemaže. Pokud by nové limity ponechaly existující zálohy nad limitem, panel zobrazí pro každý server, kolik záloh každého druhu by bylo odstraněno, kolik místa to uvolní a jak stará je nejstarší z nich. Také uvádí, kdy server již překračoval své limity před touto změnou (například po dřívějším **Od příští zálohy**), protože okamžité použití ořízne vše nad limitem, nejen to, co tento edit přidává. Poté se zeptá, jak je aplikovat:

- **Odstranit nyní** smaže přesně zálohy, které právě uvedl, nic víc: záloha vytvořená mezitím čeká na další promazání. Ze stránky Nastavení je server uprostřed obnovení, zálohování nebo podobné akce přeskočen a promaže se po své další záloze; na vlastní kartě Zálohy serveru budete vyzváni k opakování pokusu, jakmile akce skončí. Zatímco se staré zálohy serveru mažou (obvykle sekundy), jiné akce na tomto serveru musí čekat: plánovaná záloha nebo spuštění, které se v tu chvíli spustí, se pokusí znovu každou minutu (až 30 minut), havarovaný server se restartuje přibližně do 20 sekund po dokončení (až 30 minut) a plánovaný restart nebo zastavení, které se s tím srazí, je přeskočeno do dalšího termínu.
- **Od příští zálohy** je zatím ponechá; každý server si promaže zálohy při příští záloze, jak to vždy dělal.

![Dialog zobrazující, co by nové limity odstranily](/docs/images/retention-preview.png)

Záloha, která je obnovována, není nikdy odstraněna během běhu obnovení: uchovávání ji ponechá být (a nemaže jiné zálohy, aby pro ni udělalo místo) a její ruční smazání je odmítnuto, dokud obnovení neskončí.

Stejná nastavení jsou dostupná pro skripty jako administrátorské API koncové body: `GET`/`POST /api/backups/retention` a `/api/servers/:id/backups/retention`. Celofiremní hodnoty nemohou být `null`. Pro server hodnota `null` (nebo `""`) odstraní tento jeden klíč, takže opět následuje celofiremní hodnotu, a `{ "reset": true }` odstraní všechny. Pod každou z těchto dvou cest `POST …/preview` hlásí, co by změna odstranila, aniž by ji odstranila (`backups`, `bytes`, `servers`, `ids` a rozpis podle serveru `byServer`), a `POST …/apply` aplikuje uloženou politiku nyní a odpoví `{ deleted, skipped }` celofiremně (`skipped` počítá zaneprázdněné servery) nebo `{ deleted }` pro jeden server. Pošlete `preview` `{ "token": "..." }` (uchováno po dobu 10 minut) nebo jeho `{ "ids": [...] }` pro smazání pouze těchto; bez nich se smaže vše nad limitem. Aplikace na jeden server na zaneprázdněném serveru odpoví 409.

Zálohy lze **přejmenovat** ze seznamu záloh (tlačítko přejmenovat na každém řádku). Archiv na disku a záznam panelu se pohybují společně, takže stahování, obnovování a uchovávání fungují s novým názvem.

![Přejmenování zálohy](/docs/images/backup-rename.png)

> Uchovávání je automaticky omezeno, ale velké modifikované archivy se stále započítávají do [diskového kvóty](/docs/storage/) serveru, takže sledujte celkovou velikost pro velké balíčky.

## Obnovování

Obnovení zálohy zastaví server (ověří, že kontejner skutečně přestal běžet, než se dotkne jakýchkoli souborů), pořídí bezpečnostní zálohu `před obnovením`, nahradí **celou složku serveru** snímkem a ponechá jej zastavený, abyste jej mohli znovu spustit. Archiv je nejprve rozbalen stranou a teprve po úplném rozbalení je vyměněn, takže obnovení, které selže v polovině, ponechá aktuální soubory nedotčené. Protože upgrady balíčků vždy nejprve pořídí zálohu `před aktualizací`, můžete špatný upgrade vždy vrátit zpět.

## Databáze samotného panelu

Zálohy serveru pokrývají pouze vlastní složku každého serveru. Databáze samotného panelu (`panel.db`, obsahující uživatele, role, 2FA klíče, plány, připnuté balíčky a historii) je snímkována samostatně během denního údržbového časovače:

- `VACUUM INTO` zapíše konzistentní, defragmentovanou kopii do `backups/_panel/` ve složce dat; nejnovější **14** jsou ponechány.
- Při spuštění panel spustí `PRAGMA integrity_check` a hlasitě zaloguje, pokud selže, a nasměruje vás na `backups/_panel` pro nejnovější dobrou kopii.

Zálohujte celou složku dat (obsahuje také `.secret-key`, klíč pro šifrování v klidu) a máte zálohováno vše.
