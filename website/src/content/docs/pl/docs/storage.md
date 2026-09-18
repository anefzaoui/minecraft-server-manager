---
title: 'Magazyn'
description: 'Strona Magazyn pokazuje, gdzie wykorzystywane jest Twoje miejsce na dysku: użycie na serwer i jego trend w czasie.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Pamięć masowa** pokazuje, gdzie kończy się Twoje miejsce na dysku: użycie na serwer i jego trend w czasie.

![Pamięć masowa](/docs/images/storage.png)

## Limity dysku są egzekwowane przez panel

Docker nie może ograniczyć użycia dysku przez bind mount, więc robi to panel. Indeksator rozmiaru działający w tle skanuje katalog danych, buforuje rozmiar każdego serwera i egzekwuje limit dysku ustawiony dla każdego serwera. Gdy dane serwera (świat + kopie zapasowe + wszystko inne) zbliżają się do swojego limitu, panel zatrzymuje niekontrolowany wzrost, zamiast pozwolić jednemu serwerowi wypełnić Twój host.

Ustaw limit serwera w jego [ustawieniach](/docs/servers/). Serwery z modami i ich [kopie zapasowe](/docs/backups/) mogą być duże, więc daj im trochę miejsca.

## Czyszczenie

Widok Pamięć masowa pomaga znaleźć, co usunąć (stare kopie zapasowe, nieużywane światy lub serwer, który znacznie przekroczył oczekiwania), zanim zabraknie Ci miejsca.
