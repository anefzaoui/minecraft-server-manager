---
title: 'Pakiety modów'
description: 'Strona Pakiety modów (oraz zakładka Z pakietu modów w kreatorze tworzenia) instaluje pakiet modów jako serwer, zawsze przypięty do dokładnej wersji pakietu, dzięki czemu restart może'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Modpacki** (oraz zakładka **Z modpacka** w [kreatorze tworzenia](/docs/servers/)) instaluje modpack jako serwer, zawsze **przypięty do dokładnej wersji paczki**, dzięki czemu ponowne uruchomienie nigdy nie zaktualizuje jej po cichu.

![Modpacki](/docs/images/modpacks.png)

## Obsługiwane platformy

- **CurseForge** - wyszukaj lub wklej adres URL paczki. Wymaga klucza API CurseForge do wyszukiwania i prywatnych paczek (dodaj go w Ustawienia → Klucze API).
- **Modrinth** - wyszukaj po nazwie.
- **FTB** - paczki Feed The Beast.
- **GT New Horizons** - paczka ekspercka 1.7.10, instalowana z własnego indeksu wydań GTNH. GTNH wybiera środowisko uruchomieniowe Java dla każdej wersji paczki (2.8.0+ działa na **Java 25** za pomocą dołączonych łatek lwjgl3ify, starsze wydania na Java 21 lub 17), a kreator podnosi limit RAM i dysku serwera do rozsądnych minimów.
- **Niestandardowy zip** - wcale nie opublikowana paczka: prześlij **eksport modpacka CurseForge** (plik zip z `manifest.json`, który aplikacja CurseForge tworzy dla ręcznie wybranej grupy modów) lub **dowolny plik zip z modami**. Panel rozwiązuje manifest masowo za pomocą API CurseForge (lub identyfikuje każdy plik zip po skrócie/odcisku palca/metadanych), wyświetla podgląd tego, co pasuje, i instaluje wszystko w jednym zadaniu - w tym konfiguracje z `overrides/` paczki, jeśli wyrazisz na to zgodę. Mody, których autorzy nie zezwalają na automatyczne pobieranie, są wymienione z linkiem do przeglądarki i miejscem na ręczne przesłanie zamiast powodowania błędu instalacji.

## Jak działa przypinanie

Po wybraniu paczki panel rozwiązuje dokładną wersję, zapisuje ją i instaluje. Na stronie **Aktualizacje** zostaniesz poinformowany, gdy dostępna będzie nowsza wersja; aktualizacja jest celowym, zabezpieczonym działaniem z kopią zapasową przed aktualizacją i możliwością wycofania zmian. Serwery śledzące stabilne wersje nigdy nie otrzymują wersji beta.

Serwery utworzone na bardzo starych wersjach panelu (przed 0.9.7) mogły pozostać _nieprzypięte_, co oznaczało, że obraz kontenera po cichu instalował najnowszą wersję paczki przy każdym uruchomieniu. Panel teraz naprawia je przy starcie: przypina każdy z nich do wersji, która jest faktycznie zainstalowana (odczytana z własnych rekordów panelu lub manifestu instalacji obrazu, nigdy świeżo rozwiązanego "najnowszego") i loguje zdarzenie. Jeśli nie może określić, co jest zainstalowane, strona Ustawienia serwera wyświetla ostrzeżenie z prośbą o ręczne wybranie wersji, a wszelkie próby zapisania nieprzypiętej konfiguracji modpacka są odrzucane.

## Polityka aktualizacji

Każdy serwer ma politykę aktualizacji w **Ustawieniach**, a wszystkie trzy opcje oznaczają to, co mówią:

- **Tylko ręcznie** - nic nigdy się nie zmienia samoistnie, a serwer jest całkowicie pomijany w odznakach aktualizacji i na stronie Aktualizacje. Tryb "zostaw mnie w spokoju": idealny dla ręcznie dostrojonego lub zaimportowanego modpacka, którego nigdy nie chcesz dotykać.
- **Powiadom mnie** (domyślnie) - codzienne sprawdzanie wyświetla dostępne aktualizacje jako odznakę i na stronie Aktualizacje; ich zastosowanie zawsze zależy od Twojego kliknięcia.
- **Automatyczna aktualizacja** - po zaplanowanym codziennym sprawdzaniu, oczekujące aktualizacje **paczki** są stosowane tą samą zabezpieczoną ścieżką co ręczna aktualizacja: kopia zapasowa przed aktualizacją, monitorowanie stanu i automatyczne wycofanie zmian, jeśli nowa wersja nie uruchomi się poprawnie. Aktualizacje, które przeniosłyby serwer do innej wersji Minecrafta, są zawsze pomijane z logowaniem zdarzenia - konwersja świata na stałe jest decyzją, której panel nie podejmie za Ciebie. Ręczne przyciski "sprawdź teraz" tylko sprawdzają; nigdy nie uruchamiają automatycznych aktualizacji.

## Aktualizacja paczki

Z przypiętego serwera możesz zaktualizować do nowszej wersji w jednym działaniu. Panel najpierw tworzy kopię zapasową, zamienia przypiętą wersję, odtwarza kontener (ponownie rozwiązując Java, jeśli nowa wersja wymaga innego środowiska uruchomieniowego) i monitoruje pierwsze uruchomienie, z dużym oknem dla dużych paczek, takich jak GTNH, które pobierają kilka gigabajtów i budują świat z kilkuset modami przy pierwszym uruchomieniu.
