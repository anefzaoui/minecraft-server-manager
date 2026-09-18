---
title: 'Kopie zapasowe'
description: 'Strona Kopie zapasowe zawiera migawki z całej Twojej floty, wraz z rozmiarem, powodem utworzenia i wiekiem.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Kopie zapasowe** zawiera migawki wszystkich serwerów, wraz z ich rozmiarem, powodem utworzenia i wiekiem.

![Kopie zapasowe](/docs/images/backups.png)

## Tworzenie kopii zapasowej

Z zakładki **Kopie zapasowe** serwera (lub za pomocą [harmonogramu](/docs/schedules/)) możesz jednym kliknięciem utworzyć migawkę całego katalogu serwera. Panel najpierw uspokaja świat (`save-off` → `save-all`), kompresuje dane do archiwum, a następnie ponownie włącza zapisywanie (`save-on`), dzięki czemu kopie zapasowe są spójne nawet na działającym serwerze. Kompresja działa w osobnym wątku roboczym, aby nie blokować panelu. Każda kopia zapasowa może zawierać notatkę.

Każde archiwum jest **sprawdzane pod kątem integralności** w momencie zapisu: panel ponownie otwiera archiwum i odczytuje jego zawartość. Uszkodzone lub niemożliwe do otwarcia archiwum jest usuwane, a żądanie utworzenia kopii zapasowej kończy się niepowodzeniem od razu, zamiast ujawniać problem miesiące później, gdy przywrócenie jest jedyną rzeczą między Tobą a utratą danych. Puste archiwum (serwer, który nigdy nie został uruchomiony) jest dozwolone, ale oznaczone w zdarzeniach.

Zaznacz **"Zmniejsz również świat po utworzeniu kopii zapasowej"** (w zakładce Kopie zapasowe lub w harmonogramie tworzenia kopii zapasowych), aby usunąć rzadko odwiedzane fragmenty świata po bezpiecznym zapisaniu archiwum (patrz **[Zmniejszanie świata](/docs/world-shrink/)**). Zmniejszanie działa tylko wtedy, gdy serwer jest zatrzymany; na działającym serwerze kopia zapasowa nadal jest tworzona, a zmniejszanie jest pomijane.

![Kopie zapasowe serwera](/docs/images/server-backups.png)

## Powody tworzenia kopii zapasowych

Kopie zapasowe są tagowane według powodu ich utworzenia:

- **manualne** - kliknąłeś przycisk.
- **zaplanowane** - utworzone przez [harmonogram](/docs/schedules/). Każdy nowy serwer otrzymuje również automatycznie dzienną kopię zapasową (rozłożoną między 02:00 a 05:59), dzięki czemu serwer ma automatyczne zabezpieczenie od pierwszego dnia, a nie tylko przed aktualizacjami.
- **przed aktualizacją** - tworzone automatycznie przed aktualizacją paczki, dzięki czemu aktualizacja jest zawsze odwracalna.
- **przed przywróceniem** - tworzone automatycznie tuż przed przywróceniem lub zresetowaniem świata, jako siatka bezpieczeństwa na wypadek, gdyby przywrócenie nie było tym, czego oczekiwałeś.

## Retencja

Retencja jest ograniczona **na serwer, na powód**: zachowywane są najnowsze kopie z każdej grupy, starsze są automatycznie usuwane po każdej udanej kopii zapasowej:

| Powód               | Zachowane |
| ------------------- | --------- |
| zaplanowane         | 10        |
| przed aktualizacją  | 10        |
| manualne            | 20        |
| przed przywróceniem | 5         |

`przed przywróceniem` ma swój własny mały "koszyk", właśnie po to, aby automatyczna kopia zapasowa bezpieczeństwa nigdy nie nadpisała kopii `manualnej`, którą celowo zachowałeś.

Dwa opcjonalne limity stosują się ponad liczbę kopii na powód, oba domyślnie wyłączone: **maksymalny wiek** (kopie starsze niż N dni są usuwane, niezależnie od powodu) i **maksymalny łączny rozmiar** na serwer (najstarsze kopie są usuwane, dopóki łączny rozmiar nie zmieści się w limicie, najpierw kopie `przed przywróceniem`). Najnowsza kopia zapasowa serwera nigdy nie jest usuwana przez żaden z tych limitów. Wszystkie te ustawienia można zmienić globalnie na stronie Ustawienia i nadpisać dla poszczególnych serwerów na jego karcie Kopie zapasowe.

Kopie zapasowe można **zmienić nazwę** z listy kopii zapasowych (przycisk zmiany nazwy w każdym wierszu). Archiwum na dysku i rekord w panelu poruszają się razem, dzięki czemu pobieranie, przywracanie i retencja nadal działają z nową nazwą.

![Zmiana nazwy kopii zapasowej](/docs/images/backup-rename.png)

> Retencja jest automatycznie ograniczona, ale duże archiwa z modami nadal wliczają się do [limitu miejsca na dysku](/docs/storage/) serwera, więc miej oko na łączny rozmiar dla dużych paczek.

## Przywracanie

Przywracanie kopii zapasowej zatrzymuje serwer (weryfikując, czy kontener faktycznie się zatrzymał, zanim dotknie jakiekolwiek pliki), tworzy kopię zapasową bezpieczeństwa `przed przywróceniem`, zastępuje **cały katalog serwera** migawką i pozostawia go zatrzymanym, abyś mógł go ponownie uruchomić. Ponieważ aktualizacje paczek zawsze najpierw tworzą kopię zapasową `przed aktualizacją`, zawsze możesz cofnąć nieudaną aktualizację.

## Własna baza danych panelu

Kopie zapasowe serwera obejmują tylko katalogi świata poszczególnych serwerów. Własna baza danych panelu (`panel.db`, zawierająca użytkowników, role, sekrety 2FA, harmonogramy, przypięte paczki i historię) jest migrowana oddzielnie podczas codziennego harmonogramu konserwacji:

- `VACUUM INTO` zapisuje spójną, zdefragmentowaną kopię do `data/backups/_panel/`; zachowywane są **14** najnowszych kopii.
- Przy starcie panel uruchamia `PRAGMA integrity_check` i głośno loguje, jeśli wystąpi błąd, wskazując na `data/backups/_panel` jako najnowszą dobrą kopię.

Utwórz kopię zapasową całego drzewa `data/` (zawiera ono również `.secret-key`, klucz szyfrowania w spoczynku), a zrobisz kopię zapasową wszystkiego.
