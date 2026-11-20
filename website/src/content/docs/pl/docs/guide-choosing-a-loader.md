---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: który wybrać?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge czy Quilt: jaki typ serwera Minecraft uruchomić, zależnie od tego, co zainstalują twoi gracze.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Wybierz na podstawie tego, co chcesz, aby gracze zainstalowali, a nie na podstawie tego, co brzmi najszybciej.

| Chcesz                                                   | Uruchom to              | Gracze instalują |
| -------------------------------------------------------- | ----------------------- | ---------------- |
| Survival z przyjaciółmi, nic nadzwyczajnego              | Vanilla                 | Nic              |
| Publiczny serwer z rangami, zabezpieczeniami i moderacją | Paper                   | Nic              |
| Konkretny modpack z CurseForge lub Modrinth              | Cokolwiek jest napisane | Paczkę           |
| Nowoczesny modpack, który sam tworzysz                   | Fabric lub NeoForge     | Te same mody     |
| Stary paczka z ery 1.7 do 1.12                           | Forge                   | Te same mody     |

To jest cała decyzja dla większości ludzi. Reszta tej strony wyjaśnia dlaczego.

## Wtyczki i mody to nie to samo

To jest rozróżnienie, od którego wszystko inne zależy.

**Wtyczki** działają tylko na serwerze. Paper, Spigot i Bukkit je ładują. Gracze łączą się ze zwykłym,
niezmodyfikowanym klientem i nigdy się o tym nie dowiadują. Wszystko, co zasadniczo dotyczy zasad,
uprawnień, ekonomii, zabezpieczeń, minigier lub moderacji, jest wtyczką, i dlatego prawie każdy
publiczny serwer działa na Paper.

**Mody** zmieniają samą grę: nowe bloki, nowe wymiary, nowe maszyny. Klient musi załadować te same mody,
co serwer, inaczej nie będzie w stanie zrozumieć, co serwer mu mówi. Każdy, kto dołącza do serwera z
modami, najpierw instaluje paczkę.

Serwer nie może być znacząco jednym i drugim. Istnieją hybrydowe projekty, które dodają API wtyczek do
ładowarki modów, i działają one do momentu, gdy przestaną działać, zazwyczaj w najgorszym momencie.
Jeśli potrzebujesz obu, uruchom proxy z serwerem z modami i serwerem wtyczek za nim, zamiast jednej
hybrydy.

## Strona wtyczek

**Paper** jest domyślną odpowiedzią. Jest to fork Spigot z wieloletnią pracą nad wydajnością i plikiem
konfiguracyjnym dla prawie każdego zachowania, które kiedykolwiek zirytowało administratora. Wtyczki
Vanilla z ery Bukkit w większości nadal działają.

**Purpur** jest forkiem Paper z jeszcze większą liczbą opcji, w tym tych dotyczących rozgrywki. Wybierz go,
jeśli chcesz tych konkretnych przełączników; w przeciwnym razie Paper.

**Vanilla** jest warta uruchomienia, gdy celem jest niezmieniona gra. Jest wolniejsza przy wielu graczach i
nie ma systemu uprawnień, więc moderacja jest ręczna.

Paper domyślnie zmienia niektóre zachowania Vanilla w imię wydajności. Jeśli jakaś konstrukcja z
czerwonego kamienia z filmu nie działa na twoim serwerze, to zazwyczaj jest tego powód i zazwyczaj jest
to ustawienie.

## Strona modów

**Fabric** jest mały, aktualizuje się do nowej wersji Minecraft w ciągu kilku dni i zawiera większość
nowoczesnych modów poprawiających wydajność. Prawie każdy mod Fabric potrzebuje również Fabric API,
które jest osobnym pobraniem. Jeśli twoim celem jest szybki serwer z garstką modów poprawiających
komfort użytkowania, to jest to wybór dla ciebie.

**NeoForge** jest miejscem, gdzie stary ekosystem Forge wykonuje teraz swoją pracę dla aktualnych wersji.
Oddzielił się od Forge podczas wersji 1.20.1, a większość dużych paczek zbudowanych dla wersji 1.20.2 i
późniejszych jest skierowana do niego. Jeśli dzisiaj zaczynasz nową, ciężką paczkę, to jest to wybór dla
ciebie.

**Forge** nadal włada przeszłością. Wszystko z ery 1.7.10, 1.12.2 i 1.16.5, co stanowi sporą część
uwielbianych paczek, to Forge i zawsze tak będzie. Zachowaj go dla nich.

**Quilt** jest forkiem Fabric, który uruchamia większość modów Fabric. Istnieje z dobrych powodów, ale jeśli
nie masz konkretnego powodu, aby go wybrać, wybierz Fabric.

Mody dla jednej ładowarki nie działają na innej. Strona moda, która mówi Fabric, oznacza Fabric.

## Jeśli instalujesz paczkę, paczka decyduje

Nie wybieraj. Paczka podaje swoją ładowarkę i dokładną wersję Minecraft, a obie muszą się zgadzać.
"Wystarczająco blisko" nie istnieje w tym kontekście: paczka dla 1.20.1 nie działa na 1.20.4, a paczka
1.20.1 NeoForge nie działa na 1.20.1 Forge.

Zainstaluj paczkę według jej identyfikatora lub linku, zamiast ręcznie wybierać mody, i przypnij wersję.
Paczki się aktualizują, a aktualizacja, która pojawia się niespodziewanie w środku sezonu, jest
powodem uszkodzenia światów.

## Która wersja Java

Wymagania Minecraft przesuwają się wraz z grą, a uruchomienie niewłaściwej wersji powoduje niepomocny
błąd `UnsupportedClassVersionError` zamiast jasnego komunikatu.

| Wersja Minecraft | Java |
| ---------------- | ---- |
| 1.16.5 i starsze | 8    |
| 1.17             | 16   |
| 1.18 i 1.19      | 17   |
| 1.20 do 1.20.4   | 17   |
| 1.20.5 do 1.21.x | 21   |
| 26.1 i nowsze    | 25   |

Stare paczki naprawdę potrzebują Javy 8; to jedno z niewielu miejsc w oprogramowaniu, gdzie najnowsza
wersja jest błędna.

## W Minecraft Server Manager

Kreator tworzenia pyta, co chcesz uruchomić, i wybiera wersję Java z powyższej tabeli, dzięki czemu
niezgodność nigdy nie występuje przypadkowo. Vanilla, Paper i Purpur znajdują się w zakładce
**Vanilla**; zakładka **From Mods** obsługuje Fabric, Forge, NeoForge lub Quilt, z wersją Minecraft i
kompilacją ładowarki (najnowszą lub przypiętą przez ciebie). Instalacja paczki z CurseForge, Modrinth
lub GT New Horizons przypina ją do dokładnej wersji. Aktualizacja następuje tylko wtedy, gdy ją
zastosujesz (lub po codziennym sprawdzeniu, jeśli polityka aktualizacji serwera to **Auto-Update**),
zawsze najpierw tworzy kopię zapasową i można ją wycofać.

Przeglądarka modów wie, jaką ładowarkę uruchamia serwer i odpowiednio filtruje to, co oferuje, dzięki
czemu plik jar Fabric nie może przypadkowo trafić na serwer NeoForge.

Powiązane: [tworzenie i zarządzanie serwerami](/docs/servers/), [modpacki](/docs/modpacks/),
[ile RAM potrzebuje serwer](/docs/guide-server-memory/).
