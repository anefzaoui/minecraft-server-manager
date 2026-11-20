---
title: 'Przenoszenie serwera Minecraft na inny hosting'
description: 'Przeniesienie świata jest łatwe. Przeniesienie serwera, do którego gracze nadal mogą się logować, z zachowaniem ich ekwipunków, domów i uprawnień, to część, która często sprawia problemy.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Przeniesienie świata jest łatwe. Przeniesienie serwera, na który gracze nadal mogą się logować, z zachowaniem ich ekwipunku, domów i uprawnień, to część, która często sprawia problemy. Poniższa kolejność pozwala skrócić czas niedostępności do kilku minut i zapewnia drogę powrotną, jeśli nowy komputer okaże się rozczarowaniem.

## Najpierw oceń sytuację

Zapisz te informacje przed dotknięciem czegokolwiek. Każdy z tych punktów doprowadził do nieudanej migracji, gdy został zignorowany zamiast sprawdzony:

- **Wersja i loader Minecraft**, dokładnie. 1.20.1 NeoForge to nie to samo co 1.20.1 Forge.
- **Lista modów lub wtyczek z wersjami.** Świat nie załaduje się bez modów, które go stworzyły.
- **Wersja Java**, która powinna być zgodna z wersją Minecraft.
- **`level-name`** z `server.properties`. Folder świata często nie nazywa się `world`.
- **Tryb online.** Jeśli stary serwer działał z `online-mode=false`, a nowy działa z włączonym, lub odwrotnie, każdy gracz otrzyma zupełnie inne UUID, a co za tym idzie, zupełnie nowy, pusty ekwipunek. To najczęstszy i najbardziej bolesny błąd na tej stronie.
- **Wszystko, co znajduje się poza folderem serwera**, na przykład baza danych MySQL używana przez wtyczkę.

## Kopiuj, gdy działa, a potem skopiuj ponownie, gdy jest zatrzymany

Sztuczka polega na tym, aby najpierw wykonać powolne kopiowanie, aby skrócić czas niedostępności.

1. **Gdy serwer działa**, skopiuj cały katalog serwera na nowy komputer. Na dużym świecie może to potrwać godzinę; nikt tego nie zauważy, ponieważ nic nie zostało zatrzymane.
2. **Ogłoś restart, a następnie prawidłowo zatrzymaj serwer.** Grzeczne zatrzymanie powoduje, że gra zapisuje świat; zabicie procesu tego nie robi.
3. **Skopiuj ponownie.** Tym razem przenoszone są tylko zmienione pliki, więc zajmuje to od kilku sekund do kilku minut.
4. **Uruchom go na nowym komputerze**, jeśli to możliwe, na niepublicznym porcie i dołącz do niego samodzielnie. Sprawdź znaną bazę, swój ekwipunek i upewnij się, że wtyczki lub mody załadowały się bez błędów.
5. **Następnie** skieruj graczy na nowy serwer.

`rsync -a --delete` jest zazwyczaj używanym narzędziem do kroków 1 i 3. Zachowaj uprawnienia i znaczniki czasu: świat skopiowany jako nieprawidłowy użytkownik to serwer, który się nie uruchomi, a błąd nie będzie tego jasno wskazywał.

## Jeszcze nie usuwaj starego serwera

Zachowaj stary komputer, zatrzymany, ale nienaruszony, przez co najmniej kilka dni. To jedyna prawdziwa opcja przywrócenia. Trzymaj go wyłączonym, a nie działającym, aby nikt przypadkowo nie dołączył do porzuconej kopii i nie budował tam przez tydzień.

## Spraw, aby adres przetrwał przeniesienie

Jeśli gracze łączą się z surowym adresem IP, każde przeniesienie zmusza każdego gracza do edycji listy serwerów, a niektórzy z nich nigdy tego nie robią.

Użyj nazwy hosta, którą kontrolujesz, wskazującej na serwer. Przeniesienie staje się wtedy zmianą DNS, a adres w kliencie każdego gracza pozostaje taki sam. Zmniejsz czas życia rekordu (TTL) na dzień przed przeniesieniem, aby zmiana szybko się rozpropagowała.

Jeśli chcesz, aby gracze wpisywali zwykłą domenę, podczas gdy serwer działa na niestandardowym porcie, rekord SRV to umożliwia. Jest to ten sam mechanizm, którego używają komercyjni dostawcy hostingu, aby udostępniać adresy typu `play.something.net`.

## Sprawdź nowy komputer przed zaufaniem mu

Trzy rzeczy, które różnią się między hostami i sprawiają problemy po przeniesieniu:

- **Zapora sieciowa.** Twój port gry musi być otwarty i tylko twój port gry. Nie udostępniaj panelu zarządzania ani mapy w Internecie tylko dlatego, że działały lokalnie.
- **Prędkość pojedynczego rdzenia.** Minecraft znacznie bardziej dba o to, jak szybki jest jeden rdzeń, niż o to, ile ich jest. Osiem wolnych rdzeni będzie działać gorzej niż dwa szybkie.
- **Dysk.** Świat na dysku talerzowym lub mocno współdzielonym wolumenie będzie się zacinał podczas ładowania fragmentów.

## Opuszczanie zarządzanego panelu

Jeśli przechodzisz od dostawcy hostingu, który zapewnił Ci panel sterowania zamiast maszyny, znajdź opcję pobierania lub menedżera plików i pobierz cały katalog serwera, a nie tylko świat. Pobierz same pliki JAR wtyczek i modów, a nie listę: wersje mają znaczenie, a "najnowsza" w przyszłym miesiącu będzie innym plikiem.

Sprawdź również, czy Twoje kopie zapasowe należą do Ciebie. Kopia zapasowa, która istnieje tylko w panelu, który opuszczasz, nie jest kopią zapasową, którą posiadasz.

## W Minecraft Server Manager

Cały panel to jeden katalog. Skopiowanie go na inny komputer i uruchomienie panelu tam przenosi wszystkie serwery, światy, kopie zapasowe i ustawienia, co sprawia, że przeniesienie samego panelu jest raczej kopiowaniem niż migracją.

Dla jednego serwera zamiast wszystkich, szkic (blueprint) przechwytuje jego konfigurację, zestaw modów i przypisaną wersję paczki (oraz, jeśli zaznaczysz, aktywny świat) jako pojedynczy plik `.mcserver.zip`, który można zaimportować na innym panelu, aby odtworzyć ten sam serwer. Światy można pobierać i instalować osobno, gdy trzeba przenieść tylko świat.

Jeśli port gry używany przez serwer jest już zajęty na nowym komputerze lub chcesz najpierw przetestować na niepublicznym porcie, zmień go w **Ustawienia → Konfiguracja**: karta **Port gry** zawiera opcję **Użyj następnego wolnego portu**. Działający serwer zapyta przed restartem na nowym porcie, a jeśli nie może się tam uruchomić, wróci do starego. Przełącz go na publiczny port, gdy skierujesz na niego graczy.

Powiązane: [szkice (blueprints)](/docs/blueprints/), [kopie zapasowe, które faktycznie się przywracają](/docs/guide-backups/), [światy i pliki](/docs/worlds-and-files/).
