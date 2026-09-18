---
title: 'Uživatelé a role'
description: 'Panel je víceuživatelský.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Zpět na obsah dokumentace](/docs/)

Panel je vícemužný. Správa účtů je v sekci **Nastavení → Uživatelé**.

![Uživatelé](/docs/images/settings-users.png)

## Tři role

| Role          | Co může                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **admin**     | Všechno: správa uživatelů, API klíčů, globálních souborů, pokročilých Docker přepsání a všechny akce serveru.                   |
| **operátor**  | Spouštění a konfigurace serverů (start/stop, konzole, zálohy, světy, mody, většina nastavení), ale ne oblasti pouze pro adminy. |
| **prohlížeč** | Pouze pro čtení. Zobrazení serverů a jejich stavu, ale bez možnosti provádět změny.                                             |

Každý uživatel, včetně prohlížeče, si může spravovat vlastní [dvoufaktorovou autentizaci](/docs/two-factor-authentication/), protože ochrana vlastního přihlášení není akcí správy serveru.

## Pouze pro adminy a proč

Některé věci jsou záměrně omezeny pouze na adminy:

- **Správa uživatelů, API klíčů a globálních souborů.**
- **[Veřejné API](/docs/public-api/)** - povolení `/api/v1` a vytváření, omezování rozsahu nebo rušení jeho read-only Bearer tokenů.
- **Pokročilá Docker přepsání** - vlastní název kontejneru, další publikovaná porty a bind mounty. Bind mount může mapovat libovolnou cestu hostitele do kontejneru a v kombinaci s přístupem panelu k Dockeru je to efektivně root na hostiteli. Tato pole se zobrazují pouze adminům.

Vlastní názvy kontejnerů také nemohou žít ve vlastním jmenném prostoru `msm-` panelu, takže ručně pojmenovaný kontejner nikdy nemůže zastínit jiný server a přesměrovat stop nebo příkaz na nesprávnou instanci.

## Správa účtů

![Profilový obrázek](/docs/images/profile-picture.png)

Admini mohou vytvářet uživatele, měnit role, resetovat hesla a mazat účty z tabulky Uživatelé. Sloupec **2FA** ukazuje, zda má každý uživatel povolené dvoufaktorové ověřování; admin může **resetovat** 2FA jiného uživatele (pro případ ztraceného telefonu a záložních kódů), ale nikdy nemůže zakázat své vlastní bez svého hesla, což je řešeno samoobslužným procesem.

Neúspěšná přihlášení jsou omezena rychlostně na účet (jak počítadlo na IP, tak globální počítadlo účtu), aby se zpomalily pokusy o brute-force, a stejný limit pokrývá i krok s 2FA kódem, takže správné heslo nemůže resetovat počítadlo před hádáním kódu. Před tímto je hrubší omezovač požadavků na klienta na koncových bodech přihlášení / 2FA / nastavení, nastavitelný pomocí `RATE_LIMIT_AUTH_PER_15MIN` (výchozí hodnota 100; za reverzním proxy serverem nastavte `TRUST_PROXY`, aby se klíčovalo na skutečnou IP klienta).
