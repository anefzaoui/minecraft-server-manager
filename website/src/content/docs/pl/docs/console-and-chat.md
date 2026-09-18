---
title: 'Konsola i polecenia czatu'
description: 'Zakładka Konsola strumieniuje logi serwera w czasie rzeczywistym i udostępnia pole tekstowe do wysyłania dowolnych poleceń serwera.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Powrót do spisu dokumentacji](/docs/)

## Konsola na żywo

Zakładka **Konsola** strumieniuje log serwera w czasie rzeczywistym i udostępnia pole tekstowe do wysyłania dowolnych poleceń serwera. Bez `docker exec`, bez SSH. Wyniki pojawiają się w linii, wraz z kolorami.

![Konsola](/docs/images/server-console.png)

Konsola jest również miejscem, gdzie panel odczytuje stan serwera: obserwuje log, aby sklasyfikować fazę uruchamiania („Ładowanie modów”, „Generowanie świata”, „Kończenie uruchamiania”) i wywołuje `list`, aby śledzić, kto jest online, dzięki czemu pulpit nawigacyjny i karty serwerów zawsze odzwierciedlają rzeczywistość.

To odpytywanie otwiera krótkotrwałe połączenie RCON w każdym cyklu, które serwer loguje jako parę `Thread RCON Client … started` / `shutting down` co około 20 sekund, oraz (na serwerach, których rdzeń lub wtyczki to powtarzają) linię `Rcon issued server command: …` dla każdego odczytu tylko do odczytu - `list` dla liczby graczy, plus odczyty `time query …` i `gamerule <name>`, gdy strona Kontroli Świata jest otwarta. Przełącznik **Ukryj szum RCON** nad logiem filtruje te linie (wraz z liniami startowymi listenere RCON). Jest on domyślnie włączony i zapamiętywany na przeglądarkę; wyłącz go, aby zobaczyć surowy strumień.

Polecenia wysyłane z panelu mogą być ogłaszane w grze pod etykietą dla każdego serwera, dzięki czemu gracze wiedzą, że działał operator, a nie tajemnicza konsola.

## Polecenia czatu

Polecenia czatu pozwalają graczom wywoływać akcje panelu, wpisując polecenie z prefiksem w czacie gry, na przykład `!spawn`, aby losowo się teleportować. Wykrywanie opiera się na logach, a wykonanie odbywa się przez serwer, więc **nie są wymagane żadne mody**.

![Polecenia czatu](/docs/images/chat-commands.png)

Każde polecenie ma:

- **Wyzwalacz** (np. `spawn`) i **prefiks** (domyślnie `!`).
- **Akcję**: losowy teleport, teleport do struktury, teleport do biomu lub wykonanie surowych poleceń konsoli.
- **Poziom uprawnień**: wszyscy, gracze z białej listy lub tylko operatorzy.
- **Czas odnowienia** oraz konfigurowalne wiadomości oczekujące / sukcesu / niepowodzenia z zastępczymi symbolami, takimi jak `{distance}`.

### Uwaga dotycząca bezpieczeństwa

Polecenia, które mogą zniszczyć serwer (`stop`, `op`, `ban`, `whitelist` i podobne), są dozwolone tylko przy wyzwalaczach **tylko dla operatorów**. Panel sprawdza je nawet wtedy, gdy są zagnieżdżone w łańcuchu `execute … run …`, więc wyzwalacz o niskich uprawnieniach nie może przemycić niebezpiecznego polecenia. Zwykły tekst czatu, który jedynie wspomina te słowa (jak wiadomość `say`), pozostaje nietknięty.
