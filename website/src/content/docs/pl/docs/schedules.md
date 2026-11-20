---
title: 'Harmonogramy'
description: 'Strona Harmonogramy automatyzuje powtarzalne zadania za pomocą wyrażeń cron. Bez zewnętrznego crona, bez skryptów.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Harmonogramy** automatyzuje powtarzalne zadania za pomocą wyrażeń cron. Bez zewnętrznego crona, bez skryptów.

![Harmonogramy](/docs/images/schedules.png)

## Co można zaplanować

- **Restartowanie**: nocne restartowanie, aby utrzymać długo działający serwer w dobrej kondycji.
- **Zatrzymywanie i uruchamianie**: wyłączenie serwera na noc i ponowne włączenie go rano.
- **Kopie zapasowe**: regularne migawki (oznaczone jako `scheduled` na stronie [Kopie zapasowe](/docs/backups/)). Harmonogram kopii zapasowych może również zmniejszyć świat po każdej kopii zapasowej ([zmniejszanie świata](/docs/world-shrink/)). Każdy nowy serwer automatycznie otrzymuje harmonogram codziennych kopii zapasowych.
- **Polecenia**: uruchamianie dowolnego polecenia serwera według harmonogramu.
- **Sprawdzanie aktualizacji**: okresowe odświeżanie tego, co jest nieaktualne. Zaplanowane sprawdzanie jest również tym, co stosuje aktualizacje dla serwerów ustawionych na [Automatyczną aktualizację](/docs/modpacks/#update-policy).

Każdy harmonogram dotyczy konkretnego serwera (lub panelu globalnie), działa na podstawie własnego wyrażenia cron i może być włączony lub wyłączony bez usuwania. Edytor podgląda następne czasy uruchomienia podczas pisania, czasy crona podążają za strefą czasową panelu (ustawioną w **Ustawieniach**), a tabela pokazuje następne uruchomienie każdego harmonogramu. Każde uruchomienie jest rejestrowane jako zdarzenie w historii, podobnie jak nieudane uruchomienie.

Panel uruchamia również własne harmonogramy konserwacji przy pierwszym uruchomieniu, które można zmienić lub wyłączyć: codzienne sprawdzanie aktualizacji, skanowanie pamięci masowej co sześć godzin, codzienne czyszczenie starych plików tymczasowych, przegląd wygasających banów co 15 minut (zdejmowanie tymczasowych banów, które wygasły) i nocne uzupełnianie metadanych zawartości (wypełnianie brakujących nazw modów i ikon).

## Kiedy serwer jest zajęty

Zaplanowana kopia zapasowa lub uruchomienie, które zastaje serwer w trakcie innej akcji (przywracanie, czyszczenie kopii zapasowej, zmiana portu), czeka i próbuje ponownie co minutę, aż ta akcja się zakończy, przez maksymalnie 30 minut. Oczekujące uruchomienie jest anulowane, jeśli ktoś w międzyczasie uruchomi lub zatrzyma serwer. Zaplanowane ponowne uruchomienie lub zatrzymanie nie jest ponawiane: jest pomijane i uruchamiane ponownie w następnym zaplanowanym czasie.
