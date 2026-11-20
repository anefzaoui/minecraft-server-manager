---
title: 'Konsola i polecenia czatu'
description: 'Zakładka Konsola strumieniuje logi serwera w czasie rzeczywistym i udostępnia pole tekstowe do wysyłania dowolnych poleceń serwera.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Powrót do spisu dokumentacji](/docs/)

## Konsola na żywo

Zakładka **Konsola** strumieniuje log serwera w czasie rzeczywistym i udostępnia pole tekstowe do wysyłania poleceń serwera. Bez `docker exec`, bez SSH. Wyniki pojawiają się na bieżąco, wraz z kolorami. Wysyłanie poleceń wymaga uprawnienia Konsola dla danego serwera; bez niego nadal można obserwować log.

Nad logiem można filtrować linie według tekstu (lub `/wyrażenia regularnego/`) i poziomu (INFO, WARN, ERROR), a opcja **Pobierz** oferuje ostatnie dane wyjściowe, cały plik `latest.log` lub wszystkie pliki logów jako archiwum zip.

![Konsola](/docs/images/server-console.png)

Konsola jest również miejscem, z którego panel odczytuje stan serwera: obserwuje log, aby sklasyfikować fazę uruchamiania („Ładowanie modów”, „Generowanie świata”, „Zakończenie uruchamiania”) i wywołuje `list`, aby śledzić, kto jest online, dzięki czemu pulpit nawigacyjny i karty serwerów zawsze odzwierciedlają rzeczywistość.

To odpytywanie otwiera krótkotrwałe połączenie RCON w każdym cyklu, które serwer loguje jako parę `Thread RCON Client … started` / `shutting down` co około 20 sekund, oraz (na serwerach, których rdzeń lub wtyczki to powtarzają) linię `Rcon issued server command: …` dla każdego odczytu tylko do odczytu ( `list` dla liczby graczy, plus odczyty `time query …` i `gamerule <name>`, gdy Kontrola Świata jest otwarta). Przełącznik **Ukryj szum konsoli** nad logiem filtruje te linie (wraz z liniami uruchamiania nasłuchującego RCON). Jest on domyślnie włączony i zapamiętywany na przeglądarkę; wyłącz go, aby zobaczyć surowy strumień.

Polecenia wysyłane z panelu mogą być ogłaszane w grze pod etykietą specyficzną dla serwera (pole **Ogłaszaj jako…**), dzięki czemu gracze wiedzą, że działał operator, a nie tajemnicza konsola.

## Czat

**Konsola → Czat** wysyła wiadomości do gry podczas działania serwera: wiadomości **Formatowane** przyjmują kolory i formatowanie i mogą być wysyłane do wszystkich lub jednego gracza online, a **Proste** wysyłają prosty komunikat `[Serwer]` do wszystkich.

![Konsola → Czat](/docs/screenshots/04-chat.png)

## Komendy czatu

Komendy czatu (**Konsola → Komendy**) pozwalają graczom wywoływać akcje panelu, wpisując komendę z prefiksem w czacie gry, na przykład `!spawn`, aby losowo się teleportować. Wykrywanie opiera się na logach, a wykonanie odbywa się przez serwer, więc **nie są wymagane żadne mody**.

![Komendy czatu](/docs/images/chat-commands.png)

Każda komenda ma:

- **Wyzwalacz** (np. `spawn`), wpisywany po **prefiksie** serwera (domyślnie `!`, jeden lub dwa znaki, nigdy `/`).
- **Akcję**: losowy teleport, teleport do struktury, teleport do biomu lub wykonanie surowych poleceń konsoli.
- **Poziom uprawnień**: wszyscy, gracze z białej listy lub tylko operatorzy.
- **Limit czasu na gracza** (domyślnie 30 sekund) oraz konfigurowalne komunikaty o oczekiwaniu / sukcesie / błędzie z symbolami zastępczymi, takimi jak `{distance}`.

### Uwaga dotycząca bezpieczeństwa

Komendy, które mogą zniszczyć serwer (`stop`, `op`, `ban`, `whitelist` i podobne), są dozwolone tylko dla wyzwalaczy **tylko dla operatorów**. Panel sprawdza je nawet wtedy, gdy są zagnieżdżone w łańcuchu `execute … run …`, więc wyzwalacz o niskich uprawnieniach nie może przemycić niebezpiecznej komendy. Zwykły tekst czatu, który jedynie wspomina te słowa (jak wiadomość `say`), jest ignorowany.
