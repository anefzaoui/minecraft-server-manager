---
title: 'Panel główny'
description: 'Panel główny to Twoja baza wypadowa: każdy serwer, jego status na żywo i bieżący strumień tego, co się dzieje.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Panel główny to Twoja baza wypadowa: każdy serwer, jego status na żywo i bieżący strumień tego, co się działo.

![Dashboard](/docs/images/dashboard.png)

## Kafelki podsumowania

Na górze:

- **Serwery online**: ile Twoich serwerów jest aktualnie uruchomionych, w stosunku do całkowitej liczby.
- **Połączeni gracze**: łączna liczba graczy na wszystkich uruchomionych serwerach.
- **Dostępne aktualizacje**: ile serwerów, paczek lub modów ma nowszą wersję ([zobacz Aktualizacje](/docs/updates/)).
- **Docker**: czy panel może połączyć się z demonem Dockera i jego wersja.

Drugi rząd dodaje **Przydzielona pamięć** (i ile jest używane), **Użyte miejsce na dysku** we wszystkich folderach danych serwera, **Stan · 24h** (awarie, zatrzymania z powodu braku pamięci i automatyczne restarty w ciągu ostatniego dnia) oraz **Aktualizacje** podzielone na aktualizacje modów i poziomu serwera. Poniżej nich, **Serwery według statusu** zlicza Twoje serwery w każdym stanie, a **Przegląd zasobów** przedstawia wykres udziału pamięci i procesora każdego serwera.

## Karty serwerów

Każdy serwer jest wyświetlany jako karta ze swoim statusem (Uruchomiony, Uruchamianie, Zatrzymany, Awaria i stany pośrednie, takie jak Niezabezpieczony lub Zablokowany), typem i wersją Minecrafta, portem gry oraz tagami. Każda karta pokazuje użycie **graczy** i **dysku** w stosunku do limitu; uruchomione serwery pokazują również na żywo **CPU** i **pamięć**, aktualizowane w sposób ciągły.

Kliknij kartę, aby otworzyć ten serwer. Pusta karta **Utwórz serwer** i przycisk **Utwórz serwer** w górnym pasku rozpoczynają [kreatora tworzenia](/docs/servers/).

Możesz wyszukiwać swoje serwery (po nazwie, typie, wersji lub tagu), sortować je według statusu, nazwy, rozmiaru, ostatniego uruchomienia lub daty utworzenia, a także przełączać się między układem siatki i listy za pomocą przełącznika po prawej stronie.

## Ostatnia aktywność

Kanał na dole pokazuje najnowsze wpisy z czytelnego dziennika audytu panelu: logowania, kopie zapasowe, eksporty schematów, sprawdzanie aktualizacji, zmiany poleceń czatu, uruchamianie i zatrzymywanie serwerów oraz inne. Każdy wpis jest oznaczony serwerem, do którego należy (lub samym panelem) i jak dawno temu miał miejsce. **Wyświetl wszystko** otwiera pełną historię na stronie [Aktywność](/docs/activity/).
