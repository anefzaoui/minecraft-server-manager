---
title: 'Integracje'
description: 'Każdy serwer posiada swoje integracje w grupie Ustawienia: Discord, publiczna Strona Statusu, jednoklikowe Zaproszenia oraz opcjonalna zakładka Chatbot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Każdy serwer posiada swoje integracje w grupie **Ustawienia**: **Discord**, publiczna **Strona Statusu**, **Zaproszenia** dostępne jednym kliknięciem oraz opcjonalna zakładka **Chatbot**. Ta strona dotyczy Discorda (pozostałe mają własną dokumentację i pomoc w konfiguracji w panelu).

## Powiadomienia Discord

Panel przekazuje zdarzenia serwera na kanał Discord za pomocą webhooka. Bez bota, bez OAuth.

### Konfiguracja

1. W Discord: **Ustawienia serwera → Integracje → Webhooki → Nowy Webhook**. Wybierz kanał i skopiuj adres URL webhooka.
2. W panelu otwórz zakładkę serwera **Ustawienia → Discord**, wklej adres URL w pole **Adres URL Webhooka**, włącz kartę **włącz**, i **Zapisz**. Adres URL jest przechowywany w zaszyfrowanej formie (w tym samym magazynie danych co klucze API).
3. Użyj **Wyślij test**, aby potwierdzić działanie.

![Integracja Discord](/docs/images/integrations-discord.png)

Aby zastąpić zapisany adres URL, wklej nowy i zapisz; pozostaw pole puste, aby zachować obecny. Zapisany adres URL jest wyświetlany w formie zamaskowanej (token jest ukryty).

### Co jest wysyłane

Powiadomienia są pogrupowane w kategorie, które można włączać i wyłączać. Wszystkie są domyślnie włączone.

| Kategoria             | Zdarzenia                                                                  |
| --------------------- | -------------------------------------------------------------------------- |
| **Start / stop**      | Serwer uruchomiony, serwer zatrzymany                                      |
| **Awaryjne**          | Wykryto awarię, pętlę awarii, nowy raport z awarii                         |
| **Kopie zapasowe**    | Utworzono kopię zapasową, przywrócono kopię zapasową                       |
| **Aktualizacje**      | Zastosowano aktualizację, cofnięto aktualizację, błąd aktualizacji         |
| **Wyrzucenia / Bany** | Gracz wyrzucony, gracz zbanowany                                           |
| **Alerty**            | Rzeczy, które po cichu pozostawiają serwer w stanie zepsucia (patrz niżej) |

### Kategoria Alerty

`Alerty` to kanał "coś wymaga interwencji człowieka", dla warunków, które wcześniej były widoczne tylko w panelu:

| Zdarzenie               | Znaczenie                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Kontener został zatrzymany z powodu braku pamięci.                                                                     |
| `unhealthy`             | Proces działa, ale sonda `mc-health` zawodzi: serwer jest aktywny, ale martwy.                                         |
| `startup-stalled`       | Nadal trwa uruchamianie po około 10 minutach bez komunikatu "Gotowe" w logach (z diagnozą problemu, jeśli jest znana). |
| `stop-failed`           | Bezproblemowe zatrzymanie nie powiodło się i kontener nadal działa.                                                    |
| `schedule-failed`       | Nie powiodło się zaplanowane ponowne uruchomienie / kopia zapasowa / polecenie.                                        |
| `quota-exceeded`        | W trybie ścisłym przekroczono limit miejsca na dysku i serwer został zatrzymany.                                       |
| `offline-after-restart` | Serwer był aktywny przed restartem panelu, teraz nie jest i nie zostanie automatycznie uruchomiony.                    |
| `crash-report`          | Nowy raport z awarii został przechwycony i przeanalizowany.                                                            |
| `update-failed`         | Zabezpieczona aktualizacja nie uruchomiła się poprawnie.                                                               |

### Jak działa dostarczanie

Proces w tle sprawdza [log aktywności](/docs/activity/) co 15 sekund i przekazuje dopasowane wiersze. Jeśli wysłanie webhooka tymczasowo się nie powiedzie, ten wiersz zostanie ponowiony podczas późniejszych sprawdzeń zamiast zostać pominiętym; trwale niedostępny webhook zostanie wyciszony (jedna linia logu na godzinę) po kilku próbach. Proces nigdy nie odtwarza zdarzeń sprzed uruchomienia panelu.
