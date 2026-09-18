---
title: 'Tworzenie i zarządzanie serwerami'
description: 'Kliknij Utwórz serwer (górny pasek) lub kartę Utwórz serwer, aby otworzyć kreatora.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Powrót do spisu dokumentacji](/docs/)

## Tworzenie serwera

Kliknij **Utwórz serwer** (górny pasek) lub kartę **Utwórz serwer**, aby otworzyć kreatora.

![Utwórz serwer](/docs/images/create-wizard.png)

Kreator wstępnie wypełnia pola pamięci, procesora i limitu dysku na podstawie **Domyślnych ustawień dla nowych serwerów** na stronie Ustawienia, które administrator może zmienić w dowolnym momencie.

![Domyślne ustawienia dla nowych serwerów](/docs/images/settings-defaults.png)

Wybierasz:

- **Nazwę** (oraz opcjonalną ikonę, kolor akcentu i tagi do organizacji swojej floty).
- **Typ serwera** - vanilla, Paper, Fabric, Forge, NeoForge i inne, każdy zmapowany do odpowiedniego obrazu itzg w tle.
- **Wersję Minecraft** - `LATEST`, snapshot lub konkretną wersję.
- **Zasoby** - RAM (sterta), limit pamięci kontenera, CPU i limit dysku.

Preferujesz modpack? Zakładka **Z modpacku** instaluje zamiast tego paczkę CurseForge, Modrinth, FTB lub GT New Horizons (patrz [Modpacki](/docs/modpacks/)), lub przyjmuje **własny plik zip, który przesyłasz**: eksport modpacku CurseForge (`manifest.json`) lub dowolny plik zip z modami. Manifest (lub większość głosów spośród zidentyfikowanych plików zip) określa wersję ładowarki i Minecrafta, a każdy mod jest instalowany w jednym zadaniu. Możesz również zacząć od zapisanego [Szkicu](/docs/blueprints/).

Panel automatycznie wybiera odpowiednią wersję środowiska Java dla Twojej wersji, pobiera obraz, tworzy kontener i (opcjonalnie) go uruchamia, wszystko z jednego formularza.

## Lista serwerów

Strona **Serwery** zawiera listę całej Twojej floty ze statusem i szybkimi statystykami.

![Lista serwerów](/docs/images/servers-list.png)

## Pojedynczy serwer

![Gracze](/docs/images/players.png)

Otwarcie serwera daje Ci przestrzeń roboczą podzieloną na karty:

- **Przegląd** - status, statystyki na żywo, czas pracy i podstawowe kontrolki startu / stopu / restartu.
- **Konsola** - strumień logów na żywo i wprowadzanie poleceń, a także czat w grze ([szczegóły](/docs/console-and-chat/)).
- **Gracze** - kto jest online, a także ekwipunek, statystyki i [polecenia czatu](/docs/console-and-chat/).
- **Mody** - lista zainstalowanych modów, [przeglądarka modów](/docs/modpacks/) i aktualizacje zawartości.
- **Świat** - [światy, mapa na żywo i menedżer plików](/docs/worlds-and-files/).
- **Kopie zapasowe** - [migawki i przywracanie](/docs/backups/) dla tego serwera.
- **Monitorowanie** - historia i metryki na żywo dla poszczególnych serwerów, w tym raporty o awariach (patrz niżej).
- **Ustawienia** - wszystko o sposobie działania serwera, a także [integracje](/docs/integrations/) (Discord, strona statusu, zaproszenia, chatbot).

![Przegląd serwera](/docs/images/server-overview.png)

Szyna **Kontrolki świata** przesuwa się po każdej karcie: zegar w grze, pogoda, typowe zasady gry jako przełączniki, i "Pokaż wszystkie zasady świata" dla pozostałych.

![Kontrolki świata](/docs/images/world-controls.png)

**Monitorowanie → Na żywo** pokazuje TPS i milisekundy na tick, kartę stanu i stabilności z ostatnimi 24 godzinami / 7 dniami awarii i restartów, oraz rozmiary poszczególnych światów.

![Monitorowanie na żywo](/docs/images/monitoring-live.png)

## Ustawienia serwera

Zakładka **Ustawienia** to pełny interfejs konfiguracyjny: zmiana nazwy, zasoby, polityka aktualizacji, automatyczne uruchamianie / automatyczne ponowne uruchamianie, zmienne środowiskowe i zaawansowane opcje Docker. Pola, które zmieniają sposób działania kontenera, są wyraźnie oznaczone jako wymagające restartu.

![Ustawienia serwera](/docs/images/server-settings.png)

**O wskaźniku pamięci.** "RAM (sterta Java)" jest przekazywana Javie jako jej początkowa i maksymalna sterta, a Java wypełnia przydzieloną jej stertę w ciągu pierwszej minuty, z flagami Aikar / MeowIce lub bez nich. Dlatego wskaźnik pamięci stabilizuje się na około rozmiarze sterty i pozostaje tam nawet wtedy, gdy nikt nie gra; zaznaczenie na wskaźniku oznacza, gdzie sterta znajduje się poniżej limitu kontenera, a notatka pod nim to potwierdza. Jeśli wolisz, aby pamięć podążała za rzeczywistym użyciem, ustaw mniejszą **Początkową stertę** (zaawansowane): na stercie 2 GB zmniejszyło to zużycie w stanie bezczynności z 2,6 GB do około 1,3 GB według naszych pomiarów. Java potrzebuje również pamięci poza stertą (około 0,5 GB w wersji vanilla, 1,5 do 2 GB w dużym modpacku), do czego służy zapas limitu kontenera. Szczegóły znajdziesz w README w sekcji "Dwa limity pamięci".

> Zaawansowane pola nadpisywania Docker (niestandardowa nazwa kontenera, dodatkowy port i montowania powiązań, oraz surowe nadpisywania) są dostępne **tylko dla administratorów**, ponieważ montowanie powiązań wraz z dostępem panelu do Dockera jest równoważne z uprawnieniami roota na hoście. Patrz [Użytkownicy i role](/docs/users-and-roles/).

## Raporty o awariach i analiza mclo.gs

Raporty o awariach (pliki `crash-reports/*.txt` i pliki JVM `hs_err_pid*.log`) są automatycznie pobierane, analizowane do jednoliniowego podsumowania z wyjątkiem i podejrzanymi modami, i wyświetlane w sekcji **Monitorowanie → Historia**:

![Karta raportu o awarii](/docs/images/crash-mclogs-card.png)

Każda karta raportu oferuje wbudowaną przeglądarkę (z rozwijanymi sekcjami i podświetlonymi wyjątkami), kopiowanie stosu wywołań i pobieranie, a także dwie akcje [mclo.gs](https://mclo.gs):

- **Udostępnij na mclo.gs** publikuje raport jako publiczny fragment i kopiuje link - dokładnie to, o co proszą autorzy modów i kanały wsparcia na Discordzie. Link jest zapamiętywany w raporcie, więc nic nie jest nigdy przesyłane dwukrotnie.
- **Analizuj** uruchamia automatyczne analizy mclo.gs na fragmencie: znane problemy z sugerowanymi poprawkami (brakujące zależności, niezgodności wersji, powszechne konflikty modów), wyświetlane bezpośrednio w panelu.

![Analiza mclo.gs](/docs/images/crash-insights.png)

Obie akcje wymagają wyraźnego potwierdzenia, ponieważ fragment jest publiczny: raporty o awariach mogą zawierać nazwy graczy i pełną listę modów. Panel nigdy nie przesyła niczego samodzielnie.
