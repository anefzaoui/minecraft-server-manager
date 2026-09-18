---
title: 'Architektura'
description: 'Minecraft Server Manager to aplikacja Node.js renderowana po stronie serwera, działająca w jednym procesie.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Minecraft Server Manager to aplikacja Node.js renderowana po stronie serwera, działająca w jednym procesie. Zarządza
serwerami Minecraft uruchomionymi jako kontenery Docker przy użyciu obrazu
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), komunikując się z demonem Docker przez jego API (nigdy przez wywoływanie `docker` CLI).

## Kształt środowiska uruchomieniowego

- **Express + Handlebars** renderują strony po stronie serwera. Nie ma SPA; JavaScript przeglądarki w `public/js/`
  jest ręcznie napisany jako stopniowe ulepszenie. Krok `esbuild` (`pnpm run build:js`) pakuje i
  minimalizuje go do `public/dist/js/`; aplikacja serwuje ten pakiet, gdy jest obecny, a surowe
  źródło w przeciwnym razie, więc uruchomienie w trybie deweloperskim bez budowania nadal działa.
- **`node:sqlite`** (wbudowany w Node; panel wymaga Node ≥ 24) to baza danych - synchroniczna,
  bez natywnych modułów, w trybie WAL. Mały runner migracji z wersjonowaniem stosuje `src/db/migrations/*` przy
  uruchomieniu. Przygotowane instrukcje są buforowane w `src/db/index.js` z kluczem opartym na tekście SQL.
- **`ws`** przenosi strumienie konsoli i statystyk na żywo. Oba są **pośredniczone**: jeden strumień nadrzędny
  `docker logs --follow` (lub `docker stats`) na serwer, rozdzielany raz i rozsyłany do każdej
  połączonej karty, zamiast jednego strumienia nadrzędnego na widza. Pośrednik konsoli przechowuje mały bufor powtórek
  dla późno dołączających kart i odłącza subskrybenta, którego gniazdo zbyt mocno się opóźnia, zamiast
  blokować wspólny strumień.
- **`dockerode`** to jedyny sposób, w jaki aplikacja komunikuje się z Dockerem. Punkt końcowy jest automatycznie wykrywany dla każdej platformy
  (nazwana pipa w Windows vs. gniazdo uniksowe).
- **Cały stan trwały znajduje się w jednym katalogu** (`$DATA_DIR`, domyślnie `./data`). Skopiowanie tego
  katalogu migruje cały panel.

## Warstwowanie

Zależności płyną w jednym kierunku:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parsowanie i walidacja wejścia, kształtowanie odpowiedzi
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   logika domenowa (rzeczywiste funkcje)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktura
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - jeden router na domenę (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), zamontowany w `web/app.js`. Routery walidują za pomocą zod, wywołują usługę i zwracają JSON
  lub renderują widok. Logika biznesowa nie należy tutaj. Dwa routery są zamontowane w **strefie publicznej**,
  przed `requireAuth`: `routes/status.js` (strony statusu HTML na serwer, opcjonalne) i
  `routes/apiV1.js` (`/api/v1`, tylko do odczytu API JSON uwierzytelniane przez token Bearer wygenerowany przez administratora z
  `services/apiTokens.js`, wyłączone, chyba że włączone w Ustawieniach; patrz `docs/public-api.md`).
- **`services/`** - serce aplikacji. Każda usługa jest właścicielem jednej domeny i może zależeć od
  infrastruktury i innych usług.
- **`docker/`** - opakowania `dockerode`: `connect` (wykrywanie punktu końcowego + stan demona), `containers`
  (tworzenie/uruchamianie/zatrzymywanie/ponowne tworzenie z montowaniami, limitami pamięci/CPU i etykietami), `logs`, `stats`,
  `images` i `watcher`, który zamienia zdarzenia Docker w historię + wykrywanie awarii.
- **`db/`** - opakowanie SQLite i runner migracji.
- **`storage/`** - inicjalizacja `./data`, **strażnik ścieżek** (`safeJoin`, kręgosłup bezpieczeństwa plików)
  i indeksator rozmiaru w tle + egzekwowanie limitów.

Przekrojowe:

- **`config/`** - konfiguracja środowiskowa plus **katalog pól**: jedno źródło prawdy dla
  ustawień serwera. Każda zmienna środowiskowa itzg jest katalogowana (etykieta, pomoc, typ, jednostka, domyślna,
  walidacja, sekcja, flagi zagrożenia). Kreator, formularze ustawień i walidacja zod są pochodne
  od niego, więc udostępnienie nowego ustawienia to zmiana danych, a nie nowe połączenia UI.
- **`events/`** - `recordEvent()` to jedyny punkt wejścia do dziennika historii; zdarzenia cyklu życia również
  przechwytują fragmenty logów kontenera do `data/logs/<id>/events/`.
- **`ws/`** - uwierzytelnione WebSockety konsoli + statystyk (ciasteczko sesji zweryfikowane przy uaktualnieniu, `Origin`
  sprawdzane w celu zablokowania przejmowania witryn), pośredniczone na serwer (patrz "Kształt środowiska uruchomieniowego").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` zwraca per-modułowy
  [Pino](https://getpino.io) logger; poziom z `LOG_LEVEL`, `makeFailureThrottle()` utrzymuje
  trwale awaryjną pętlę w tle na jednej linii logu plus linię "odzyskano".
  `src/utils/logSanitize.js` usuwa klucze w kształcie poświadczeń i tokeny webhook z ustrukturyzowanych
  metadanych; `src/config/logLevel.js` to wspólna lista dozwolonych poziomów (przechowywana oddzielnie, aby uniknąć cyklu require z
  `config`). `src/instrument.js` to uśpione połączenie Sentry, ładowane jako pierwsze w
  `src/server.js`. `src/web/middleware/requestLog.js` zapisuje jedną linię logu dostępu na żądanie
  (pomijając `/healthz` i zasoby statyczne). ESLint egzekwuje `no-console` w `src/**`, z
  `preflight.js`, `instrument.js` i `config/index.js` jako wyjątki (działają przed istnieniem loggera).
- **Ograniczanie szybkości** - `src/web/middleware/rateLimit.js` umieszcza `express-rate-limit` przed `/api`
  (`RATE_LIMIT_API_PER_MIN`, domyślnie 1200) i logowanie / 2FA / POSTy konfiguracji
  (`RATE_LIMIT_AUTH_PER_15MIN`, domyślnie 100); `0` wyłącza ogranicznik. Kluczuje na `req.ip`, więc
  `TRUST_PROXY` ma znaczenie za proxy. `/api/v1` ma własny ogranicznik na token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, domyślnie 120), kluczowany na hashu tokenu Bearer z fallbackiem IP.
  Oddzielny licznik miękki na konto w
  `src/web/middleware/auth.js` obsługuje blokadę logowania (na IP i globalnie na konto, zanikający).

## Kluczowe zachowania domenowe

- **Modpacki są zawsze przypinane.** Obraz automatycznie aktualizuje nieprzypięte paczki przy każdym ponownym uruchomieniu, więc
  panel rozwiązuje "latest" do konkretnego identyfikatora wersji w momencie instalacji i przypina go. Aktualizacje to
  jawny, skoordynowany przepływ (`updates/`): podgląd → kopia zapasowa przed aktualizacją → płynne zatrzymanie → ponowne przypięcie →
  ponowne utworzenie → monitorowanie stanu → przywracanie jednym kliknięciem.
- **Nakładka niestandardowych modów** jest zarządzana przez panel: dodane przez użytkownika mody trafiają do zdeduplikowanej biblioteki i
  są twardo linkowane do serwera, dzięki czemu przetrwają aktualizacje paczek. Wyłączenie jest świadome klasy.
- **Porty** są alokowane z podstawowego schematu (gra od `PORT_GAME_START` w górę, RCON = gra +
  `PORT_RCON_OFFSET`, Bedrock od `PORT_BEDROCK_START`), sprawdzane pod kątem dostępności i rezerwowane w
  bazie danych.
- **Limity dyskowe** są egzekwowane przez panel, ponieważ Docker nie może ograniczać użycia bind-mount: indeksator
  buforuje rozmiary katalogów, a operacje powiększania dysku są na nich blokowane.
- **Sekrety** (hasła RCON, klucze API, sekrety TOTP, adres URL webhooka Discord) są szyfrowane w spoczynku
  za pomocą AES-256-GCM przy użyciu dedykowanego losowego klucza w `$DATA_DIR/.secret-key` (tryb `0600`,
  automatycznie generowany). Jest niezależny od `SESSION_SECRET`; klucz pochodny od `SESSION_SECRET` jest przechowywany jako
  fallback tylko do deszyfrowania dla wartości zapisanych przed istnieniem dedykowanego klucza, a
  `src/services/secretsMigration.js` ponownie szyfruje je pod dedykowanym kluczem raz przy uruchomieniu.
  Plik `.secret-key`, który istnieje, ale nie może zostać sparsowany, jest krytycznym błędem uruchomienia (nigdy nie jest cicho
  regenerowany nad istniejącym). Schematy usuwają wszystkie sekrety podczas eksportu.

## Formaty danych i transmisji

- **`data/panel.db`** - baza danych SQLite. Codziennie migawkowana za pomocą `VACUUM INTO` do
  `data/backups/_panel/` (zachowywane 14 najnowszych); `PRAGMA integrity_check` uruchamia się przy
  uruchomieniu.
- **`data/.session-secret`** - automatycznie generowany sekret podpisywania ciasteczek, tworzony przy pierwszym uruchomieniu, jeśli
  `SESSION_SECRET` jest nieustawiony. Usunięcie go powoduje rotację sekretu (co unieważnia sesje).
- **`data/.secret-key`** - dedykowany 32-bajtowy klucz szyfrowania w spoczynku (tryb `0600`), automatycznie tworzony
  przy pierwszym uruchomieniu. Niezależny od `SESSION_SECRET`; jego usunięcie sprawia, że każde przechowywane poświadczenie
  jest nieodczytywalne, więc należy go przechowywać wraz z kopiami zapasowymi.
- **Schematy (`.mcserver.zip`)** - archiwum zip z `manifest.json` opisującym konfigurację, zasoby,
  przypięte odniesienie do paczki, manifest nakładki (adresy URL źródłowe + sha256), wybrane pliki konfiguracyjne i
  opcjonalnie świat. Import ponownie pobiera i weryfikuje hashe każdego moda oraz przydziela nowe porty.
- **Kontenery Docker** tworzone przez panel są nazwane i oznaczone etykietami, aby watcher mógł je znaleźć;
  panel jest odpowiedzialny za ich pełny cykl życia.

## Sekwencja uruchamiania

1. `require('./instrument')` (połączenie Sentry) przed wszystkim innym, następnie `require('./preflight')`
   aby jasno poinformować o nieobsługiwanej wersji Node.
2. Załaduj konfigurację; zapewnij/wygeneruj `.session-secret` **oraz** `.secret-key`.
3. `ensureDataRoot()` - utwórz układ `./data`, wyczyść `tmp/`.
4. Uruchom migracje bazy danych, a następnie `PRAGMA integrity_check` (głośno loguje, wskazuje na `data/backups/_panel`
   w przypadku błędu).
5. Szyfruj ponownie legacy sekrety kluczowane przez `SESSION_SECRET` pod `.secret-key` (`secretsMigration`).
6. Zainicjuj schematy startowe (zabezpieczone).
7. Uruchom serwer HTTP + WS. Na odsłoniętym interfejsie, wyświetl PIN `/setup` przy pierwszym uruchomieniu.
8. Zainstaluj strażnika środowiska uruchomieniowego po uruchomieniu (wyłapuje nieprzechwycone błędy; `MSM_EXIT_ON_FATAL=1` powoduje twarde wyjście dla wdrożeń nadzorowanych).
9. Uruchom usługi w tle: pośrednik WS, indeksator pamięci masowej, watchery awarii + inwentarza, harmonogram,
   most zdarzeń Discord i **dzienny timer konserwacji** (usuwanie starych wierszy analitycznych + migawka
   `panel.db`).
10. Zainicjuj Docker **w tle**. UI jest w pełni użyteczny, gdy demon jest wyłączony;
    funkcje Docker włączają się, gdy stanie się dostępny. Po połączeniu `refreshStatuses({ boot })`
    rekoncyluje buforowane statusy, emituje jednorazowe zdarzenie `offline-after-restart` dla serwera, który był
    włączony przed ponownym uruchomieniem panelu i nie zostanie przywrócony, a pętla uruchamiania rozpoczyna
    serwery `auto_start` plus odzyskuje serwery `auto_restart` znalezione jako awaryjne podczas awarii
    (z uwzględnieniem opóźnienia awarii).

> Kolejność instrument-przed-preflight to świadomy kompromis: pozwala przyszłej poprawce Sentry na pierwsze
> załatanie środowiska uruchomieniowego, kosztem nieco mniej przyjaznego komunikatu w przypadku naprawdę starego Node.

## Potok budowania

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM z podziałem kodu). `postinstall` uruchamia **tylko CSS**. `public/css/app.css`
i `public/dist/` to artefakty budowania ignorowane przez git; etap budowania Dockerfile uruchamia pełny
`pnpm run build` i kopiuje `public/` do obrazu uruchomieniowego. Zasoby statyczne są serwowane
z długim buforem `immutable`/długoterminowym dla plików z odciskiem palca, krótkim buforem dla CSS/JS, i
`no-cache` dla HTML i `/api`.
