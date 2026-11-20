---
title: 'Kopie zapasowe serwera Minecraft, które faktycznie się przywracają'
description: 'Jak tworzyć kopie zapasowe serwera Minecraft, które faktycznie się przywracają: spójne kopie, przechowywane gdzie indziej i przetestowane przynajmniej raz.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Większość serwerów posiada kopie zapasowe. Znacznie mniej posiada kopie zapasowe, które działają, a różnica jest odkrywana tylko w najgorszym dniu. Dzielą je trzy rzeczy: kopia jest spójna, znajduje się gdzie indziej i ktoś ją przynajmniej raz przywrócił.

## Kopiowanie świata podczas jego braku zapisu

Działający serwer stale zapisuje pliki regionów. Skopiuj je w trakcie zapisu, a otrzymasz plik, który jest w połowie stary i w połowie nowy, co albo uniemożliwi jego wczytanie, albo wczyta go z dziurą w ziemi tam, gdzie kiedyś była czyjaś baza. Nic Cię nie ostrzeże, ponieważ kopiowanie się powiodło.

Istnieją dwa poprawne sposoby wykonania kopii:

1. **Zatrzymaj serwer**, skopiuj, uruchom go ponownie. Proste, uczciwe i niepopularne z powodu przestojów.
2. **Najpierw powiedz grze, aby przestała zapisywać.** Uruchom `save-off`, następnie `save-all flush`, poczekaj na zakończenie, skopiuj, a następnie `save-on`. Świat jest kompletny i cichy przez czas trwania kopiowania.

Nigdy nie pomijaj bezpośredniego kopiowania. Migawka na poziomie systemu plików lub woluminu jest w porządku tylko wtedy, gdy jest prawdziwie atomowa, a `cp -r` podczas umieszczania bloków przez graczy nie jest.

## Kopiuj więcej niż tylko świat

Przywrócenie samego świata daje Ci teren i traci serwer. Chcesz również:

- `server.properties` i wszystko inne, co określa zasady.
- Pliki modów lub wtyczek, w dokładnych wersjach, które były uruchomione. Świat nie załaduje się bez modów, które stworzyły jego bloki.
- Dane graczy, w tym `whitelist.json`, `ops.json` oraz foldery statystyk i osiągnięć.
- Wersję paczki, jeśli pochodziła z paczki. Zapisanie jej się liczy.

Najszybsza kontrola stanu każdej kopii zapasowej: czy możesz odbudować ten serwer na nowej maszynie tylko z archiwum? Jeśli odpowiedź wymaga zdania zaczynającego się od "a potem zainstaluję ponownie", nie jest to kompletna kopia zapasowa.

## Jedna kopia na tym samym dysku to nie kopia zapasowa

Kopia zapasowa, która znajduje się na chronionej maszynie, chroni tylko przed jednym błędem: usunięciem czegoś.
Nie chroni przed awarią dysku, zawieszeniem konta przez dostawcę ani błędem, który usuwa cały katalog.

Zachowaj prostotę zamiast perfekcji:

- Jedna lokalna kopia, dla powszechnego przypadku, jakim jest czyjeś zniszczenie lub zła aktualizacja.
- Jedna kopia gdzie indziej. Inna maszyna, magazyn obiektów lub domowe NAS pobierające co noc przez SSH.
- Wystarczająca historia, aby przetrwać problem, którego nie zauważyłeś od razu. Uszkodzenia są często wykrywane po kilku dniach, a jeśli przechowujesz trzy dni kopii zapasowych, już nadpisałeś dobrą.

Siedem codziennych kopii plus cztery tygodniowe pokrywa prawie każdy rzeczywisty incydent i kosztuje bardzo mało miejsca.

## Przetestuj przywracanie, zanim będzie potrzebne

Wybierz kopię zapasową, przywróć ją na zapasowym serwerze i dołącz. To cały test, zajmuje piętnaście minut i wyłapuje wszystkie klasyczne błędy: brak folderu modów w archiwum, świat wymagający wersji, której już nie używasz, uprawnienia uniemożliwiające odczyt plików, uszkodzony upload.

Zrób to raz podczas konfiguracji kopii zapasowych i jeszcze raz po każdej dużej zmianie na serwerze.

## Rozmiar i jak go utrzymać w ryzach

Światy rosną, ponieważ gracze eksplorują. Świat, w którym ktoś leciał dziesięć tysięcy bloków w linii prostej, niesie ze sobą wszystkie fragmenty wzdłuż tej linii na zawsze, a większość tych fragmentów nigdy nie zostanie ponownie odwiedzona.

Trzy dźwignie, w kolejności ich zwrotu:

1. **Przycinaj nieodwiedzone fragmenty.** Narzędzia, które przycinają według czasu ostatniego dotknięcia, zazwyczaj usuwają dużą część dobrze odwiedzanego świata bez widocznego wpływu na rozgrywkę.
2. **Kompresuj poprawnie.** Pliki regionów dobrze się kompresują; archiwa z nich nie korzystają z niczego egzotycznego.
3. **Nie przechowuj każdej godzinnej kopii przez rok.** Retencja jest ważniejsza niż kompresja.

## W Minecraft Server Manager

Kopie zapasowe przyjmują ścieżkę `save-off`, flush, kopiowanie, `save-on`, a zatrzymanie lub ponowne uruchomienie żądane w trakcie tworzenia kopii zapasowej jest odrzucane do momentu zakończenia kopiowania, zamiast z nim konkurować. Archiwum obejmuje cały katalog serwera, więc mody, konfiguracja i dane graczy podróżują razem ze światem.

Kopie zapasowe mogą działać w harmonogramie obok restartów i poleceń, a każdy nowy serwer zaczyna z codziennym harmonogramem kopii zapasowych. Retencja liczy każdy rodzaj osobno, więc dziesięć zaplanowanych kopii, które się gromadzą, nie może wypchnąć tej, którą wykonałeś ręcznie przed ryzykowną zmianą, a na górze stosują się limity wieku i rozmiaru. Administratorzy zmieniają wszystko na stronie Ustawienia lub dla każdego serwera na jego karcie Kopie zapasowe. Przywracanie najpierw pobiera nową kopię zapasową, więc przywrócenie do niewłaściwego punktu w czasie jest samo w sobie odwracalne. Świat można zmniejszyć samodzielnie lub jako część kopii zapasowej, co jest dźwignią, która ma największe znaczenie dla rozmiaru.

Cały panel, w tym każda kopia zapasowa, znajduje się w jednym katalogu. Kopiowanie tego katalogu gdzie indziej jest połową historii poza maszyną i jest celowo jedyną rzeczą, którą musisz skopiować.

Powiązane: [kopie zapasowe w panelu](/docs/backups/), [harmonogramy](/docs/schedules/), [zmniejszanie świata](/docs/world-shrink/), [przenoszenie serwera na innego hosta](/docs/guide-moving-a-server/).
