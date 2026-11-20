---
title: 'Kopie zapasowe'
description: 'Strona Kopie zapasowe zawiera migawki ze wszystkich twoich serwerów, wraz z rozmiarem, przyczyną i wiekiem, z możliwością filtrowania według serwera i przyczyny.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Kopie zapasowe** zawiera migawki wszystkich serwerów, z informacjami o rozmiarze, przyczynie i wieku, z możliwością filtrowania według serwera i przyczyny.

![Kopie zapasowe](/docs/images/backups.png)

## Tworzenie kopii zapasowej

Z zakładki **Kopie zapasowe** serwera (lub za pomocą [harmonogramu](/docs/schedules/)) możesz jednym kliknięciem utworzyć migawkę całego katalogu serwera. Panel najpierw uspokaja świat (`save-off` → `save-all`), kompresuje dane do archiwum ZIP, a następnie ponownie włącza zapisywanie (`save-on`), dzięki czemu kopie zapasowe są spójne nawet na działającym serwerze. Kompresja działa w osobnym wątku roboczym, aby nie blokować panelu. Kopia zapasowa uruchomiona przez API może zawierać notatkę.

Każde archiwum jest **sprawdzane pod kątem integralności** w momencie zapisu: panel ponownie otwiera plik ZIP i odczytuje jego zawartość. Uszkodzone lub niemożliwe do otwarcia archiwum jest usuwane, a żądanie utworzenia kopii zapasowej kończy się niepowodzeniem od razu, zamiast ujawniać problem miesiące później, gdy przywrócenie jest jedyną rzeczą między Tobą a utratą danych. Puste archiwum (serwer, który nigdy nie został uruchomiony) jest dozwolone, ale oznaczone w zdarzeniu.

Zaznacz **"Zmniejsz również świat po utworzeniu kopii zapasowej"** (na karcie Kopie zapasowe lub w harmonogramie tworzenia kopii zapasowych), aby usunąć rzadko odwiedzane fragmenty świata po bezpiecznym zapisaniu archiwum (patrz **[Zmniejszanie świata](/docs/world-shrink/)**). Zmniejszanie działa tylko wtedy, gdy serwer jest zatrzymany; na działającym serwerze kopia zapasowa nadal jest tworzona, a zmniejszanie jest pomijane.

![Kopie zapasowe serwera](/docs/images/server-backups.png)

## Przyczyny kopii zapasowych

Kopie zapasowe są oznaczane etykietami według powodu ich utworzenia:

- **ręczne**: kliknąłeś **Utwórz kopię zapasową teraz**. Zastępowanie aktywnego świata serwera światem z biblioteki również najpierw tworzy kopię zapasową typu `ręczne`.
- **zaplanowane**: utworzone przez [harmonogram](/docs/schedules/). Każdy nowy serwer jest również automatycznie tworzony z codzienną zaplanowaną kopią zapasową (rozłożoną między 02:00 a 05:59), dzięki czemu serwer ma automatyczne zabezpieczenie od pierwszego dnia, a nie tylko przed aktualizacjami.
- **przed aktualizacją**: tworzone automatycznie przed aktualizacją paczki lub zmianą wersji Minecraft, dzięki czemu aktualizacja jest zawsze odwracalna.
- **przed przywróceniem**: tworzone automatycznie tuż przed przywróceniem lub zresetowaniem świata, jako siatka bezpieczeństwa na wypadek, gdyby przywrócenie nie było tym, czego oczekiwałeś.

## Retencja

Retencja jest ograniczona **na serwer, na przyczynę**: zachowywane są najnowsze kopie z każdej grupy, starsze są automatycznie usuwane po każdej udanej kopii zapasowej:

| Przyczyna           | Domyślnie zachowane |
| ------------------- | ------------------- |
| zaplanowane         | 10                  |
| przed aktualizacją  | 10                  |
| ręczne              | 20                  |
| przed przywróceniem | 5                   |

`przed przywróceniem` (nazywane w panelu kopiami bezpieczeństwa) ma swój własny mały zasób, właśnie po to, aby automatyczna kopia bezpieczeństwa nigdy nie mogła nadpisać kopii `ręcznej`, którą celowo zachowałeś.

Dwa opcjonalne limity stosują się ponad liczbę kopii na przyczynę, oba domyślnie wyłączone: **maksymalny wiek** (kopie starsze niż N dni są usuwane, niezależnie od przyczyny) i **maksymalny całkowity rozmiar** na serwer (najstarsze są usuwane, dopóki całkowity rozmiar nie zmieści się w limicie: najpierw kopie bezpieczeństwa, potem zaplanowane, a potem reszta). Najnowsza kopia zapasowa serwera nigdy nie jest usuwana przez żaden z tych limitów.

### Zmiana ustawień

Administratorzy ustawiają ogólną politykę panelu w sekcji **Retencja kopii zapasowych** na stronie **Ustawienia** (**Wypełnij wbudowane** przywraca domyślne wartości z powyższego do formularza, gotowe do zapisania). Serwer może różnić się pod względem każdej z sześciu wartości: otwórz jego zakładkę **Kopie zapasowe** i rozwiń **Retencja dla tego serwera**. Każde pole jest puste, chyba że serwer je ustawił, a puste pole stosuje się do wartości ogólnej panelu (pokazanej wewnątrz). Serwer może więc na przykład zachować 3 zaplanowane kopie zapasowe i używać ogólnych wartości panelu dla wszystkiego innego; wyczyszczenie pola przywraca je do wartości ogólnej panelu.

![Sekcja Retencja kopii zapasowych w Ustawieniach](/docs/images/settings-retention.png)

![Retencja dla tego serwera na karcie Kopie zapasowe serwera](/docs/images/server-retention.png)

Zapisywanie nigdy niczego nie usuwa samo w sobie. Jeśli nowe limity spowodowałyby przekroczenie limitów istniejących kopii zapasowych, panel wyświetla, dla każdego serwera, ile kopii każdego rodzaju zostałoby usuniętych, ile miejsca to zwolni i ile lat ma najstarsza z nich. Informuje również, czy serwer już przekraczał swoje limity przed tą zmianą (na przykład po wcześniejszym **Od następnej kopii zapasowej**), ponieważ zastosowanie teraz przycina wszystko, co przekracza limit, a nie tylko to, co dodaje ta edycja. Następnie pyta, jak je zastosować:

- **Usuń teraz** usuwa dokładnie te kopie zapasowe, które właśnie wymienił, nic więcej: kopia zapasowa utworzona w międzyczasie czeka na następne przycięcie. Ze strony Ustawień, serwer w trakcie przywracania, tworzenia kopii zapasowej lub podobnej akcji jest pomijany i przycinany po następnej kopii zapasowej; na własnej karcie Kopie zapasowe serwera zostaniesz poproszony o ponowną próbę po zakończeniu tej akcji. Podczas usuwania starych kopii zapasowych serwera (zwykle sekund), inne akcje na tym serwerze muszą czekać: zaplanowana kopia zapasowa lub uruchomienie, które trafią w tym czasie, próbują ponownie co minutę, aż będą mogły (przez maksymalnie 30 minut), awaryjny serwer jest restartowany w ciągu około 20 sekund od zakończenia (przez maksymalnie 30 minut), a zaplanowany restart lub zatrzymanie, które koliduje z tym, jest pomijane do następnego terminu.
- **Od następnej kopii zapasowej** zachowuje je na razie; każdy serwer przycina swoje kopie zapasowe przy następnym tworzeniu, tak jak zawsze.

![Okno dialogowe z listą tego, co usunęłyby nowe limity](/docs/images/retention-preview.png)

Kopia zapasowa, która jest przywracana, nigdy nie jest usuwana podczas trwania przywracania: retencja pozostawia ją w spokoju (i nie usuwa innych kopii zapasowych, aby zrobić dla niej miejsce), a ręczne usunięcie jest odrzucane do momentu zakończenia przywracania.

Te same ustawienia są dostępne dla skryptów jako punkty końcowe API administratora: `GET`/`POST /api/backups/retention` i `/api/servers/:id/backups/retention`. Ogólne wartości panelu nie mogą być `null`. Dla serwera, wartość `null` (lub `""`) usuwa ten klucz, dzięki czemu ponownie stosuje się ogólną wartość panelu, a `{ "reset": true }` usuwa je wszystkie. Pod każdym z tych dwóch ścieżek, `POST …/preview` raportuje, co zmiana by usunęła bez usuwania jej (`backups`, `bytes`, `servers`, `ids` i podział na serwery `byServer`), a `POST …/apply` stosuje zapisane zasady teraz i odpowiada `{ deleted, skipped }` dla całego panelu (`skipped` liczy zajęte serwery) lub `{ deleted }` dla jednego serwera. Wyślij `{ "token": "..." }` z podglądu (ważny przez 10 minut) lub jego `{ "ids": [...] }` aby usunąć tylko te; bez żadnego z nich, wszystko, co przekracza limit, zostanie usunięte. Zastosowanie na pojedynczym serwerze na zajętym serwerze zwraca 409.

Kopie zapasowe można **zmienić nazwy** z listy kopii zapasowych (przycisk zmiany nazwy w każdym wierszu). Archiwum na dysku i rekord panelu poruszają się razem, dzięki czemu pobieranie, przywracanie i retencja nadal działają z nową nazwą.

![Zmiana nazwy kopii zapasowej](/docs/images/backup-rename.png)

> Retencja jest automatycznie ograniczona, ale duże archiwa z modami nadal wliczają się do [limitu dyskowego](/docs/storage/) serwera, więc miej oko na całkowity rozmiar dla dużych paczek.

## Przywracanie

Przywracanie kopii zapasowej zatrzymuje serwer (weryfikując, czy kontener faktycznie się zatrzymał, zanim dotknie jakichkolwiek plików), tworzy kopię bezpieczeństwa typu `przed przywróceniem`, zastępuje **cały katalog serwera** migawką i pozostawia go zatrzymanym, abyś mógł go ponownie uruchomić. Archiwum jest najpierw rozpakowywane na boku i włączane dopiero po pełnym rozpakowaniu, więc przywracanie, które zakończy się niepowodzeniem w połowie, pozostawia bieżące pliki nietknięte. Ponieważ aktualizacje paczek zawsze najpierw tworzą kopię zapasową typu `przed aktualizacją`, zawsze możesz cofnąć złą aktualizację.

## Własna baza danych panelu

Kopie zapasowe serwera obejmują tylko własny folder każdego serwera. Własna baza danych panelu (`panel.db`, zawierająca użytkowników, role, sekrety 2FA, harmonogramy, przypięte paczki i historię) jest migrowana osobno podczas codziennego harmonogramu konserwacji:

- `VACUUM INTO` zapisuje spójną, zdefragmentowaną kopię do `backups/_panel/` w folderze danych; zachowywane są najnowsze **14** kopii.
- Po uruchomieniu panel wykonuje `PRAGMA integrity_check` i głośno loguje, jeśli się nie powiedzie, wskazując na `backups/_panel` jako najnowszą dobrą kopię.

Wykonaj kopię zapasową całego folderu danych (zawiera on również `.secret-key`, klucz szyfrowania w spoczynku), a wykonasz kopię zapasową wszystkiego.
