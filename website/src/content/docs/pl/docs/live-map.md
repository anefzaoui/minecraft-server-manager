---
title: 'Mapa na żywo'
description: 'Włącz interaktywną mapę 3D świata serwera za pomocą BlueMap jednym kliknięciem, dostępną tylko po zalogowaniu przez panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Zakładka **Świat → Mapa** serwera wyświetla na żywo, powiększalną mapę 3D świata gry, generowaną przez [BlueMap](https://bluemap.bluecolored.de/) (darmowe i otwarte oprogramowanie), z pozycjami graczy i wszystkimi wymiarami. Panel instaluje ją, konfiguruje i udostępnia; nigdy nie musisz otwierać portu ani edytować pliku konfiguracyjnego.

## Włączanie

1. Otwórz serwer, a następnie **Świat → Mapa**.
2. Naciśnij **Włącz mapę na żywo**. Panel zainstaluje wersję BlueMap pasującą do modloadera serwera i wersji Minecraft z Modrinth, zaakceptuje za Ciebie pobieranie zasobów BlueMap i wybierze dla niej wolny port.
3. Zrestartuj serwer (zmiana zostanie zastosowana przy następnym uruchomieniu, a serwer zostanie oznaczony jako oczekujący na restart).

BlueMap renderuje w tle, więc stworzenie nowej mapy i wygenerowanie pierwszych kafelków zajmuje kilka minut. Do tego czasu zakładka informuje, że mapa nie jest jeszcze gotowa i sama sprawdza ponownie. Gdy mapa będzie gotowa, opcja **Pełny ekran** otworzy ją w osobnej karcie przeglądarki.

Działa na serwerach z modloaderem (Fabric, Quilt, Forge, NeoForge) oraz na serwerach z pluginami (Paper, Purpur i reszta rodziny Paper, Spigot), w tym na serwerach z modpackami. Serwery Vanilla nie mają dostępnej wersji BlueMap, co jest zaznaczone na zakładce.

## Kto może ją zobaczyć

Mapa jest udostępniana wyłącznie przez panel, po zalogowaniu: każdy, kto może przeglądać serwer w panelu, może otworzyć jego mapę, i nikt inny. Port BlueMap nigdy nie powinien być otwarty na internet ([porty w skrócie](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Włączanie lub wyłączanie mapy wymaga uprawnienia **Ustawienia** serwera ([użytkownicy i role](/docs/users-and-roles/#per-server-permissions)).

Gdy sam panel działa w Dockerze, uzyskuje dostęp do BlueMap wewnątrz kontenera serwera; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) wyjaśnia szczegóły dla konfiguracji z reverse-proxy.

## Wyłączanie

**Wyłącz mapę** usuwa plik jar BlueMap zainstalowany przez panel i zwalnia jego port, ponownie od następnego restartu. Sam świat pozostaje nietknięty; wyrenderowane kafelki mapy pozostają w folderze serwera, dopóki ich nie usuniesz na zakładce **Pliki**.

Powiązane: [światy i pliki](/docs/worlds-and-files/), [zaproszenia i strona statusu](/docs/invites-and-status-page/).
