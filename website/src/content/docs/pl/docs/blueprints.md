---
title: 'Schematy'
description: 'Schemat przechwytuje całą konfigurację serwera (typ, wersja, zasoby, środowisko, przypięcie paczki oraz opcjonalnie jego konfigurację i świat) w jednym pliku po'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Powrót do spisu dokumentacji](/docs/)

**Schemat** przechwytuje całą konfigurację serwera (typ, wersja, zasoby, środowisko, przypięcie paczki, a opcjonalnie także jego konfigurację i świat) do jednego przenośnego pliku, z którego możesz tworzyć nowe serwery.

![Schematy](/docs/images/blueprints.png)

## Eksportowanie

Z poziomu serwera wyeksportuj schemat i wybierz, co chcesz uwzględnić: konfigurację zawsze, a opcjonalnie osadzone pliki i świat. Wynik jest zapisywany w Twojej bibliotece schematów i można go pobrać, aby się nim podzielić.

## Importowanie i tworzenie ze schematu

Zaimportuj plik schematu (lub wybierz jeden z biblioteki), aby utworzyć nowy serwer, wstępnie skonfigurowany dokładnie tak samo jak oryginał. Jest to najszybszy sposób na:

- Uruchomienie identycznych serwerów (sieć serwerów minigier, kopie produkcyjne na potrzeby testów).
- Przeniesienie serwera między panelami.
- Zachowanie znanego, dobrego szablonu, do którego zawsze możesz wrócić.

Ponieważ schemat zapisuje dokładny [przypięty modpack](/docs/modpacks/), serwer z modpackiem odtworzony ze schematu instaluje tę samą przypiętą wersję, bez niespodziewanych aktualizacji.
