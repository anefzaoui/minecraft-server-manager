---
title: 'Schematy'
description: 'Schematy zapisują całą konfigurację serwera Minecraft jako wielokrotnego użytku przepis na tworzenie nowych serwerów. Sekrety nigdy nie są uwzględniane.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Powrót do spisu dokumentacji](/docs/)

**Schemat** przechwytuje całą konfigurację serwera (typ, wersja, zasoby, środowisko, przypięcie paczki, niestandardowe mody i opcjonalnie jego konfigurację i świat) do jednego przenośnego pliku `.mcserver.zip`, z którego można tworzyć nowe serwery. Sekrety (hasła, tokeny i klucze w środowisku) nigdy nie są zapisywane w schemacie.

![Schematy](/docs/images/blueprints.png)

## Eksportowanie

Z serwera na karcie **Ustawienia → Konfiguracja**, użyj opcji **Eksportuj jako schemat** i wybierz, co chcesz uwzględnić: zawsze konfigurację serwera, katalogi konfiguracyjne (domyślnie włączone) i opcjonalnie same pliki niestandardowych modów (większy plik, który instaluje się bez pobierania czegokolwiek) oraz aktywny świat. Wynik jest zapisywany w twojej bibliotece schematów i można go pobrać do udostępnienia.

**Klonuj serwer**, na tej samej karcie, wykonuje eksport i import w jednym kroku, aby utworzyć kopię serwera, z jego światem lub bez.

## Importowanie i tworzenie ze schematu

Zaimportuj plik schematu (**Importuj schemat** na stronie **Schematy**) lub wybierz jeden z biblioteki (**Utwórz serwer** na jego karcie lub zakładce **Ze schematu** w kreatorze), aby utworzyć nowy serwer wstępnie skonfigurowany dokładnie tak jak oryginał. Nowy serwer otrzymuje własne porty i nowe hasło RCON. Niestandardowe mody, które nie zostały osadzone, są pobierane ponownie i sprawdzane pod kątem sum kontrolnych zapisanych w schemacie. Biblioteka zawiera również dwa schematy startowe, jeden dla Paper i jeden dla Fabric.

Jest to najszybszy sposób na:

- Uruchomienie identycznych serwerów (sieć serwerów minigier, kopie produkcyjne do testów).
- Przeniesienie serwera między panelami.
- Zachowanie znanego, dobrego szablonu, do którego zawsze można wrócić.

Ponieważ schemat zapisuje dokładne [przypięcie paczki](/docs/modpacks/), serwer modpack utworzony ze schematu instaluje tę samą przypiętą wersję, bez niespodziewanych aktualizacji.
