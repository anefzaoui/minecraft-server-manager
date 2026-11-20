---
title: 'Integracje'
description: 'Każdy serwer posiada swoje integracje w grupie Ustawienia: Discord, publiczna Strona Statusu, jednoklikowe Zaproszenia oraz opcjonalna zakładka Chatbot (tylko dla administratorów).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Każdy serwer posiada swoje integracje w grupie **Ustawienia**: **Discord**, publiczna **Strona statusu**, **Zaproszenia** jednym kliknięciem i opcjonalna zakładka **Chatbot** (tylko dla administratorów). Ta strona dotyczy Discorda; [zaproszenia i strona statusu](/docs/invites-and-status-page/) omawiają te dwie funkcje, a [chatbot](/docs/chatbot/) ma swoją własną stronę.

## Powiadomienia Discord

Panel przekazuje zdarzenia serwera do kanału Discord za pomocą webhooka. Bez bota, bez OAuth.

### Konfiguracja

1. W Discord: **Ustawienia serwera → Integracje → Webhooki → Nowy Webhook**. Wybierz kanał i skopiuj adres URL webhooka.
2. W panelu otwórz zakładkę **Ustawienia → Discord** serwera, wklej adres URL w pole **Adres URL Webhooka**, włącz kartę **włącz**, a następnie **Zapisz**. Adres URL jest przechowywany zaszyfrowany (w tym samym magazynie danych, co klucze API).
3. Użyj opcji **Wyślij test**, aby potwierdzić działanie.

![Integracja Discord](/docs/images/integrations-discord.png)

Aby zastąpić zapisany adres URL, wklej nowy i zapisz; pozostaw pole puste, aby zachować bieżący. Zapisany adres URL jest wyświetlany zamaskowany (token jest ukryty).

### Co jest wysyłane

Powiadomienia są pogrupowane w kategorie, które można włączać i wyłączać. Wszystkie są domyślnie włączone.

| Kategoria             | Zdarzenia                                                                      |
| --------------------- | ------------------------------------------------------------------------------ |
| **Start / stop**      | Serwer uruchomiony, serwer zatrzymany                                          |
| **Awaryjne**          | Awaria, wykryto pętlę awarii, nowy raport z awarii                             |
| **Kopie zapasowe**    | Utworzono kopię zapasową, przywrócono kopię zapasową                           |
| **Aktualizacje**      | Zastosowano aktualizację, cofnięto aktualizację, aktualizacja nie powiodła się |
| **Wyrzucenia / bany** | Gracz wyrzucony, gracz zbanowany                                               |
| **Alerty**            | Rzeczy, które cicho pozostawiają serwer w stanie zepsucia (patrz niżej)        |

### Kategoria Alerty

`Alerty` to kanał "coś wymaga interwencji człowieka", dla warunków, które wcześniej były widoczne tylko w panelu:

| Zdarzenie               | Znaczenie                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Kontener został zatrzymany z powodu braku pamięci.                                                                     |
| `unhealthy`             | Proces jest uruchomiony, ale sonda `mc-health` zawodzi: działający, ale martwy serwer.                                 |
| `startup-stalled`       | Nadal się uruchamia po około 10 minutach bez komunikatu "Gotowe" w logach (z diagnozą, co naprawić, jeśli jest znana). |
| `stop-failed`           | Grzeczne zatrzymanie nie zadziałało, a kontener nadal działa.                                                          |
| `schedule-failed`       | Zaplanowany restart / kopia zapasowa / polecenie nie powiodło się.                                                     |
| `quota-exceeded`        | Włączony tryb ścisły limitu miejsca na dysku został przekroczony i serwer został zatrzymany.                           |
| `offline-after-restart` | Serwer był uruchomiony przed restartem panelu, teraz nie jest i nie zostanie automatycznie uruchomiony.                |
| `port-change-failed`    | Zmiana portu nie powiodła się i serwer nie mógł zostać przywrócony na stary port, więc jest niedostępny.               |
| `auto-restart-gave-up`  | Awaryjny serwer nie został zrestartowany, ponieważ inna akcja zajmowała go zbyt długo.                                 |

### Jak działa dostarczanie

Działający w tle most przekazuje [log zdarzeń](/docs/activity/) co 15 sekund i przekazuje zmapowane wiersze. Jeśli wysłanie webhooka POST nie powiedzie się tymczasowo, ten wiersz jest ponawiany podczas późniejszych odpytań, zamiast być odrzucany; po kilku nieudanych próbach wiersz jest pomijany, a błędy dostarczania są rejestrowane co najwyżej raz na godzinę na serwer. Po restarcie panelu most wysyła zdarzenia, których jeszcze nie dostarczył, ale nigdy nie dalej niż dwie godziny wstecz; przy pierwszym uruchomieniu zaczyna od najnowszego zdarzenia.
