---
title: 'Modpacki'
description: 'Instaluj modpacki CurseForge, Modrinth, FTB i GT New Horizons jako serwery, zawsze przypięte do dokładnej wersji paczki.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Modpacki** (oraz zakładka **Z modpacka** w [kreatorze tworzenia](/docs/servers/)) instaluje modpack jako serwer, zawsze **przypięty do dokładnej wersji paczki**, dzięki czemu ponowne uruchomienie nigdy nie zaktualizuje jej po cichu.

![Modpacki](/docs/images/modpacks.png)

## Obsługiwane platformy

- **CurseForge**: wyszukiwanie po nazwie. Wymaga klucza API CurseForge (dodaj go w **Ustawienia → Klucze API**).
- **Modrinth**: wyszukiwanie po nazwie.
- **FTB**: paczki Feed The Beast, tylko przez API (numeryczne ID paczki plus jawne ID wersji). Panel jeszcze nie sprawdza aktualizacji paczek FTB.
- **GT New Horizons**: paczka ekspercka 1.7.10, instalowana z własnego indeksu wydań GTNH. GTNH wybiera środowisko uruchomieniowe Java dla każdej wersji paczki (2.8.0+ działa na **Java 25** dzięki wbudowanym łatkom lwjgl3ify, starsze wydania na Java 21 lub 17), a kreator podnosi RAM i dysk serwera do rozsądnych minimów.
- **Niestandardowy zip**: wcale nie opublikowana paczka. Prześlij **eksport modpacka CurseForge** (plik zip z `manifest.json`, który aplikacja CurseForge tworzy dla wybranej grupy modów), **`.mrpack` Modrinth** lub **dowolny zip z plikami modów**. Panel masowo przetwarza manifest (lub identyfikuje każdy plik moda po skrócie/odcisku palca/metadanych), podgląda, co pasuje, i instaluje wszystko w jednym zadaniu, w tym konfiguracje `overrides/` paczki, jeśli wyrazisz na to zgodę. Mody, których autorzy nie zezwalają na automatyczne pobieranie, są wymienione z linkiem do przeglądarki i miejscem na ręczne przesłanie zamiast powodowania błędu instalacji.

## Jak działa przypinanie

Po wybraniu paczki panel określa dokładną wersję, zapisuje ją i instaluje. Na stronie **Aktualizacje** zostaniesz poinformowany o dostępności nowszej wersji (chyba że [polityka aktualizacji](#update-policy) serwera to **Tylko ręcznie**); aktualizacja jest celowym, zabezpieczonym działaniem z kopią zapasową przed aktualizacją i możliwością wycofania zmian. Serwery śledzące stabilne wersje nigdy nie otrzymują wersji beta. Własna zakładka **Wersje** serwera odpowiada na drugą część pytania: które przyszłe wersje Minecrafta mogą być obsługiwane przez posiadane mody ([aktualizacje](/docs/updates/#minecraft-version-compatibility)).

Wersja mod loadera również pochodzi z paczki: serwer instaluje wersję Forge, NeoForge lub Fabric, którą deklaruje paczka. Jeśli paczka Forge lub Fabric CurseForge deklaruje wersję zbyt starą dla swoich modów, zakładka **Wersje** może ją nadpisać do czasu naprawy paczki; aktualizacja paczki usuwa nadpisanie, ponieważ nowa wersja deklaruje własną ([zmiana wersji mod loadera](/docs/updates/#changing-the-mod-loader-version)).

Serwery utworzone na bardzo starych wersjach panelu (przed 0.9.7) mogły pozostać _nieprzypięte_, co oznaczało, że obraz kontenera po cichu instalował najnowszą wersję paczki przy każdym uruchomieniu. Panel naprawia je teraz przy starcie: blokuje każdą z nich do wersji, która jest faktycznie zainstalowana (odczytana z własnych rekordów panelu lub manifestu instalacji obrazu, nigdy świeżo określonego "najnowszego") i loguje zdarzenie. Jeśli nie może określić, co jest zainstalowane, strona Ustawienia serwera wyświetla ostrzeżenie z przyciskiem **Wybierz wersję…** (paczki CurseForge, Modrinth i GTNH), który otwiera [wybierak wersji](#changing-the-pack-version), a każda próba zapisania nieprzypiętej konfiguracji modpacka jest odrzucana.

## Polityka aktualizacji

Każdy serwer ma kartę **Polityka aktualizacji** w zakładce **Ustawienia → Konfiguracja**, a wszystkie trzy opcje oznaczają to, co mówią:

- **Tylko ręcznie** (domyślnie): nic się nigdy nie zmienia samo, a serwer jest całkowicie pomijany na odznace aktualizacji i stronie Aktualizacje. Tryb "zostaw mnie w spokoju": idealny dla ręcznie dostrojonej lub zaimportowanej paczki, której nigdy nie chcesz dotykać. Nie blokuje to wersji: [**Zmień wersję…**](#changing-the-pack-version) działa przy każdej polityce. Aby być informowanym o nowych wersjach i stosować je jednym kliknięciem, wybierz **Powiadom mnie**.
- **Powiadom mnie**: codzienne sprawdzanie wyświetla dostępne aktualizacje jako odznakę i na stronie Aktualizacje; ich zastosowanie zawsze wymaga Twojego kliknięcia.
- **Automatyczna aktualizacja**: po zaplanowanym codziennym sprawdzeniu, oczekujące aktualizacje **paczki** są stosowane tą samą zabezpieczoną ścieżką co ręczna aktualizacja: kopia zapasowa przed aktualizacją, monitorowanie stanu i automatyczne wycofanie zmian, jeśli nowa wersja nie uruchomi się poprawnie. Aktualizacje, które przeniosłyby serwer do innej wersji Minecrafta, są zawsze pomijane z wydarzeniem zamiast tego: konwersja świata na stałe jest decyzją, której panel nie podejmie za Ciebie. Ręczne przyciski **Sprawdź teraz** tylko sprawdzają; nigdy nie uruchamiają automatycznych aktualizacji.

## Aktualizacja paczki

Z przypiętego serwera możesz zaktualizować do nowszej wersji w jednym działaniu. Panel najpierw tworzy kopię zapasową, zamienia przypiętą wersję, przebudowuje serwer (ponownie określa wersję Java, jeśli nowa wersja wymaga innego środowiska uruchomieniowego) i monitoruje pierwsze uruchomienie, z dużym oknem dla dużych paczek, takich jak GTNH, które pobierają kilka gigabajtów i budują świat z kilkuset modami przy pierwszym uruchomieniu.

## Zmiana wersji paczki

Aby uruchomić konkretną wersję, nowszą lub starszą, użyj **Zmień wersję…** na karcie paczki w zakładce **Przegląd** serwera. Na stronie **Modpacki**, otwarcie karty zainstalowanej paczki daje ten sam wybór: wybierz wersję z listy rozwijanej i kliknij **Przełącz na tę wersję**. Oba wymagają uprawnienia **Zawartość** serwera i oba są dostępne dla paczek CurseForge, Modrinth i GTNH (paczki FTB jeszcze nie mają listy wersji). Lista pokazuje 25 najnowszych wersji dla CurseForge i Modrinth oraz każde wydanie GTNH.

Przełączenie odbywa się przez tę samą zabezpieczoną ścieżkę co aktualizacja: kopia zapasowa przed aktualizacją, nowy pin, przebudowa i monitorowane pierwsze uruchomienie, z możliwością wycofania zmian jednym kliknięciem, jeśli serwer się nie uruchomi poprawnie. Twoje niestandardowe mody są przenoszone, podobnie jak wyłączone mody paczki, wraz z innymi ustawieniami instalacji paczki (wymuszone mody, ignorowane pliki, dodatkowe projekty). Instalacja innej paczki resetuje te ustawienia, ponieważ mają one sens tylko dla paczki, dla której zostały stworzone.

Każda wersja jest wymieniona z wersją Minecrafta, którą obsługuje, w porównaniu z wersją, na którą świat został ostatnio zapisany:

- **Ta sama wersja Minecrafta**: przełączenie po normalnym potwierdzeniu. Powrót do starszej wersji paczki może spowodować utratę bloków i przedmiotów z modów, których ta wersja nie posiada, więc kopia zapasowa pozostaje w zakładce Kopie zapasowe w obu przypadkach.
- **Nowsza wersja Minecrafta**: dozwolone po potwierdzeniu, które ostrzega, że świat jest konwertowany na stałe. Kopia zapasowa wykonana najpierw jest jedynym sposobem na powrót do starego świata.
- **Starsza wersja Minecrafta**: niedostępna. Minecraft nie może załadować świata na starszej wersji niż ta, która go ostatnio zapisała, więc panel odmawia zamiast pozostawić serwer, który ulega awarii przy starcie.
