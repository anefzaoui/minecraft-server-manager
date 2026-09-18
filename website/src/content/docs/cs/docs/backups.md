---
title: 'Zálohy'
description: 'Stránka Zálohy zobrazuje všechny snímky napříč vaší flotilou, s velikostí, důvodem a stářím.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Zpět k obsahu dokumentace](/docs/)

Stránka **Zálohy** zobrazuje všechny snímky napříč vašimi servery, včetně velikosti, důvodu a stáří.

![Zálohy](/docs/images/backups.png)

## Vytvoření zálohy

Ze záložky **Zálohy** serveru (nebo prostřednictvím [plánovače](/docs/schedules/)) můžete jedním kliknutím vytvořit snímek celého adresáře serveru. Panel nejprve ztiší svět (`save-off` → `save-all`), zazipuje data a poté znovu povolí ukládání (`save-on`), takže zálohy jsou konzistentní i na běžícím serveru. Komprese probíhá na pozadí v pracovním vlákně, aby nezpomalovala panel. Každá záloha může obsahovat poznámku.

Každý archiv je **kontrolován na integritu** v okamžiku zápisu: panel znovu otevře zip a přečte jeho obsah. Poškozený nebo neotevíratelný archiv je smazán a volání zálohy selže okamžitě, namísto aby se problém projevil o měsíce později, kdy je obnova jedinou věcí mezi vámi a ztrátou dat. Archiv s nulovým počtem položek (server, který nikdy nespustil) je povolen, ale je označen v události.

Zaškrtněte **"Také zmenšit svět poté"** (na záložce Zálohy nebo v plánu zálohování), abyste odstranili zřídka navštěvované chunky, jakmile je archiv bezpečně zapsán (viz **[Zmenšení světa](/docs/world-shrink/)**). Zmenšení probíhá pouze, když je server zastaven; na běžícím serveru se záloha stále provede a zmenšení je přeskočeno.

![Zálohy serveru](/docs/images/server-backups.png)

## Důvody zálohování

Zálohy jsou označeny podle důvodu, proč byly pořízeny:

- **manual** – klikli jste na tlačítko.
- **scheduled** – vytvořeno [plánovačem](/docs/schedules/). Každý nový server je také automaticky opatřen denní plánovanou zálohou (rozloženou mezi 02:00 a 05:59), takže server má automatické pokrytí od prvního dne, nejen před aktualizacemi.
- **pre-update** – pořízeno automaticky před aktualizací balíčku, takže aktualizace je vždy vratná.
- **pre-restore** – pořízeno automaticky těsně před obnovou nebo resetem světa, jako záchranná síť pro případ, že obnova není to, co jste chtěli.

## Retence

Retence je omezena **na server, na důvod**: nejnovější v každé skupině jsou zachovány, starší jsou automaticky promazány po každé úspěšné záloze:

| Důvod       | Zachováno |
| ----------- | --------- |
| scheduled   | 10        |
| pre-update  | 10        |
| manual      | 20        |
| pre-restore | 5         |

`pre-restore` má svůj vlastní malý zásobník právě proto, aby automatická bezpečnostní záloha nikdy nemohla vyřadit `manual` zálohu, kterou jste záměrně uchovali.

Dva volitelné limity platí navíc k počtům podle důvodu, oba jsou ve výchozím nastavení vypnuté: **maximální stáří** (zálohy starší než N dní jsou promazány, bez ohledu na jejich důvod) a **maximální celková velikost** na server (nejstarší zálohy jsou promazány, dokud se celková velikost nevejde, nejprve `pre-restore` zálohy). Nejnovější záloha serveru není nikdy promazána žádným z těchto limitů. Všechny tyto možnosti lze změnit globálně na stránce Nastavení a přepsat pro každý server na jeho záložce Zálohy.

Zálohy lze **přejmenovat** ze seznamu záloh (tlačítko pro přejmenování na každém řádku). Archiv na disku a záznam panelu se pohybují společně, takže stahování, obnova a retence fungují s novým názvem.

![Přejmenovat zálohu](/docs/images/backup-rename.png)

> Retence je automaticky omezena, ale velké modifikované archivy se stále započítávají do [diskové kvóty](/docs/storage/) serveru, takže sledujte celkovou velikost u velkých balíčků.

## Obnovení

Obnovení zálohy zastaví server (ověří, že se kontejner skutečně zastavil, než se dotkne jakýchkoli souborů), provede bezpečnostní zálohu `pre-restore`, nahradí **celý adresář serveru** snímkem a ponechá jej zastavený, abyste jej mohli znovu spustit. Protože aktualizace balíčků vždy nejprve provedou zálohu `pre-update`, můžete vždy vrátit špatnou aktualizaci.

## Vlastní databáze panelu

Zálohy serveru pokrývají pouze adresáře světa pro jednotlivé servery. Vlastní databáze panelu (`panel.db`, obsahující uživatele, role, 2FA tajemství, plány, připnutí balíčků a historii) je snímána samostatně v rámci denního údržbového časovače:

- `VACUUM INTO` zapíše konzistentní, defragmentovanou kopii do `data/backups/_panel/`; nejnovějších **14** je uchováno.
- Při spuštění panel spustí `PRAGMA integrity_check` a hlasitě zaloguje, pokud selže, a odkáže vás na `data/backups/_panel` pro nejnovější dobrou kopii.

Zálohujte celý strom `data/` (obsahuje také `.secret-key`, šifrovací klíč pro data v klidu) a zálohovali jste vše.
