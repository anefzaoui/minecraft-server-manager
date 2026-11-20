---
title: 'Aktualizacje'
description: 'Śledź i stosuj aktualizacje wersji Minecraft, modpacków, modów i wtyczek na każdym serwerze, z polityką dla każdego serwera.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Aktualizacje** śledzi, co jest nieaktualne na wszystkich Twoich serwerach w jednym miejscu:

- Wersje **modpacków** ([modpacki](/docs/modpacks/)) w porównaniu do Modrinth / CurseForge / indeksu wydań GTNH.
- **Niestandardowa zawartość**, którą sam dodałeś (mody, datapacki, paczki zasobów, pluginy), każda w porównaniu do jej źródła: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) lub GitHub Releases. Wyszukiwanie na GitHubie używa ponownej walidacji ETag, więc codzienne sprawdzanie ledwo narusza limit żądań.
- Nieaktualność **obrazu Docker**: identyfikator obrazu każdego kontenera serwera w porównaniu do świeżo pobranego tagu (zduplikowanego na serwerach z tym samym tagiem), oferowane jako uaktualnienie wymagające jedynie przebudowy.
- **Przypięte wersje samodzielne**: dla serwera bez zarządzanego packa, jawne przypięcie `mc_version` w porównaniu do manifestu Mojang i jawna zmienna środowiskowa wersji loadera (`PAPER_BUILD`, `FORGE_VERSION` itp.) w porównaniu do rejestru loadera. Buildy Paper pochodzą z aktualnego **Fill v3 API** PaperMC (starszy punkt końcowy v2 przestał otrzymywać nowe wersje Minecraft). Na serwerze z modami nowsza wersja Minecraft jest oferowana dopiero po tym, jak [sprawdzenie wersji](#minecraft-version-compatibility) wykaże, że każdy zainstalowany mod ma dla niej build. Przypięty serwer Forge otrzymuje zalecany build Forge, nigdy build starszy niż ten, do którego jest przypięty, a serwer przypięty do wydania nigdy nie otrzymuje wersji pre-release (ten, który jest już na wersji beta, może otrzymać nowszą betę lub wydanie). Zastosowanie buildu loadera najpierw tworzy kopię zapasową przed aktualizacją. Przeniesienie serwera Forge lub NeoForge do nowej wersji Minecraft czyści przypięty numer buildu loadera, ponieważ build jest tworzony dla jednej wersji Minecraft; słowo kluczowe, takie jak `latest`, jest zachowywane, ponieważ samo podąża za wersją. Aby samodzielnie wybrać konkretny build, zobacz [zmiana wersji loadera modów](#changing-the-mod-loader-version).

![Aktualizacje](/docs/images/updates.png)

## Jak to działa

Panel sprawdza przypięte wersje każdego serwera w porównaniu do źródła nadrzędnego i wyświetla wszystko, co ma nowsze wydanie. Odpowiadająca liczba pojawia się również w kafelku "Dostępne aktualizacje" na [pulpicie nawigacyjnym](/docs/dashboard/).

Sprawdzanie odbywa się codziennie według domyślnego [harmonogramu](/docs/schedules/) i na żądanie za pomocą opcji **Sprawdź wszystko teraz**. Opcja **Ignoruj** w wierszu zatrzymuje oferowanie tej konkretnej wersji; nowsza wersja jest ponownie oferowana. **Polityka** aktualizacji jest per-serwer: panel pozostawia wszystko ręcznie (domyślnie, co również utrzymuje serwer z dala od tej strony), tylko powiadamia Cię, lub sam stosuje aktualizacje packów ([polityka aktualizacji](/docs/modpacks/#update-policy)).

## Kompatybilność wersji Minecraft

Nowsza wersja Minecraft nie jest uaktualnieniem, jeśli Twoje mody nie mogą się z nią przenieść. Każdy serwer ma swoją własną zakładkę **Wersje** (w sekcji Mody), która odpowiada na to pytanie:

- Wersja, którą serwer aktualnie uruchamia, i **najwyższa wersja, dla której każdy zainstalowany mod ma build**.
- Jeden zwijany wiersz dla każdej przyszłej wersji Minecraft, z informacją, ile modów jest gotowych, a ile jeszcze nic nie opublikowało. Otwórz wiersz, aby zobaczyć, które mody pozostałyby w tyle, a które są w porządku.

![Kompatybilność wersji](/docs/images/server-versions.png)

Naciśnij **Sprawdź przyszłe wersje**, aby to uruchomić. Nic nie skanuje się samo: sprawdzenie odczytuje każdy plik jar w folderze modów serwera i pyta Modrinth i CurseForge o każdy z nich, więc dzieje się to tylko wtedy, gdy o to poprosisz. Postęp i częściowe wyniki są zapisywane w trakcie, więc zamknięcie strony lub odświeżenie niczego nie traci, a sprawdzenie przerwane restartem panelu informuje o tym i oferuje ponowne uruchomienie. Wszystko, co przerwany check już ustalił, jest zachowywane, więc ponowne uruchomienie nie powtarza tej pracy.

Raport opisuje tylko serwer, dla którego został utworzony. Zmień wersję Minecraft, loadera lub same mody (dodaj jeden, usuń jeden, zaktualizuj jeden), a raport zostanie oznaczony jako nieaktualny i przestanie być używany, dopóki ponownie nie uruchomisz sprawdzania.

Mody są identyfikowane na podstawie własnej listy plików modpacka, jeśli istnieje, a w przeciwnym razie na podstawie zawartości pliku, w ten sam sposób, w jaki launcher rozpoznaje plik jar. Dwa rodzaje modów nie mogą być odpowiedzi:

- **Nie można zidentyfikować**: ręcznie zbudowany plik jar lub prywatny build, którego żaden rejestr nie rozpoznaje.
- **Nie można sprawdzić**: mod z GitHub Releases, Hangar lub SpigotMC, lub taki, którego projekt został usunięty. Te nie publikują listy, dla której wersji Minecraft jest przeznaczony każdy build.

Dopóki którykolwiek z nich jest zainstalowany, panel w ogóle nie zaoferuje jednoklikowej aktualizacji wersji Minecraft, ponieważ nie może uczciwie powiedzieć, co by się zepsuło. Zastosowanie wersji powyżej tego, co obsługują mody, jest odrzucane i wskazuje mody, które to blokują.

Mody, które **wyłączyłeś**, nie biorą udziału: serwer ich nie ładuje, więc wyłączenie moda jest realnym sposobem na ominięcie blokera. Włączenie lub wyłączenie moda oznacza konieczność ponownego sprawdzenia raportu.

Dotyczy to serwerów, które uruchamiają mody: Fabric, Forge, NeoForge i Quilt. Serwery pluginów typu Paper zachowują zwykłe zachowanie najnowszego wydania i nie mają zakładki Wersje, ponieważ dwa z rejestrów, z których pochodzą pluginy, nie publikują niczego, co można by odczytać.

![Otwarta wersja, pokazująca, które mody pozostałyby w tyle](/docs/images/server-versions-expanded.png)

Otwarcie wersji najpierw wyświetla mody bez buildu dla niej (te, które decydują o odpowiedzi) i trzyma gotowe za kliknięciem. Duże packi ładują stronę modów na raz, więc serwer z 300 modami otwiera się tak szybko, jak serwer z pięcioma modami.

## Zmiana wersji loadera modów

Zakładka **Wersje** zawiera również kartę **Wersja loadera**. Pokazuje ona, jaki build Forge, NeoForge, Fabric lub Quilt jest zainstalowany na serwerze i, tam gdzie można go zmienić, wybór do przełączenia na inny.

- **Serwer Forge, NeoForge, Fabric lub Quilt** może uruchomić dowolny opublikowany build. Wybór wyświetla ostatnie buildy dla wersji Minecraft serwera, z oznaczeniem zalecanych i najnowszych buildów Forge. **Inny build…** przyjmuje dowolny starszy według jego numeru, a **Domyślny** wraca do pozwolenia serwerowi na wybór.
- **Modpack Forge lub Fabric CurseForge** instaluje wersję loadera zadeklarowaną przez własny manifest, więc zwykłym sposobem na jej zmianę jest aktualizacja packa. Gdy sam pack podaje złą wersję (mod wewnątrz niego prosi o nowszy Forge niż instaluje pack), karta może to nadpisać, a **Wersja modpacka** usuwa nadpisanie. Aktualizacja packa również je usuwa, ponieważ nowa wersja deklaruje własny loader. Jeśli nowa wersja nadal podaje złą, ustaw nadpisanie ponownie.
- **Modpack NeoForge CurseForge lub modpack Modrinth** pokazuje swój loader, ale nie można go nadpisać: obraz serwera stosuje nadpisanie tylko do packów Forge i Fabric. Jego loader podąża za wersją packa, więc zamiast tego zaktualizuj packa. Loader packa FTB również nie może być tutaj zmieniony. Jego karta zazwyczaj się nie pojawia, ponieważ własny instalator FTB przechowuje rekordy, których panel nie odczytuje.

Panel sprawdza, czy build istnieje, zanim zada Ci jakiekolwiek pytania. Build Forge lub NeoForge jest tworzony dla jednej wersji Minecraft, więc na serwerze, który podąża za najnowszym wydaniem, przypięcie go również utrzymuje serwer na wersji Minecraft, którą aktualnie uruchamia (potwierdzenie o tym informuje). Wybranie **Domyślny** później usuwa przypięcie, ale zachowuje tę wersję Minecraft. Serwer, który podążał za najnowszym wydaniem, może również przejść na inny obraz Javy po ponownym zbudowaniu, ten, którego ta wersja potrzebuje. Taki serwer, który nigdy nie został uruchomiony, jest proszony o jednokrotne uruchomienie, aby panel wiedział, jaka to wersja. Forge pomija numery buildów (nie ma 47.4.14 między 47.4.13 a 47.4.15), więc mod, który "wymaga 47.4.14 lub wyżej", jest zadowolony przez następny build w górę, a odmowa go nazywa. Zmiana wymaga kopii zapasowej przed aktualizacją, a następnie przebudowuje serwer. Nowy build jest instalowany przy następnym uruchomieniu serwera, a karta informuje o tym do tego czasu.

## Cofanie aktualizacji moda

Każdy build, z którego mod został zaktualizowany, pozostaje w współdzielonej bibliotece, więc aktualizacja, która coś zepsuła, jest odwracalna. Wiersz moda w zakładce **Mody** otrzymuje przycisk **Cofnij**, który przywraca poprzedni build. Nie ma pobierania, więc działa nawet wtedy, gdy projekt został od tego czasu usunięty z rejestru. Build, od którego się cofnąłeś, przestaje być oferowany, dopóki nie pojawi się nowszy.

![Cofnij moda do buildu, z którego został zaktualizowany](/docs/images/mods-revert.png)

## Stosowanie aktualizacji

Aktualizacje nigdy nie są ciche. Kiedy wybierzesz uaktualnienie packa (lub [przełączenie go na inną wersję](/docs/modpacks/#changing-the-pack-version), w tym starsze), panel:

1. Tworzy **kopię zapasową przed aktualizacją** (więc jest odwracalna; domyślnie zachowywane jest 10 ostatnich kopii zapasowych przed aktualizacją na serwer, zobacz [retencję](/docs/backups/#retention)).
2. Ponownie przypina dokładną nową wersję.
3. Przebudowuje serwer, w razie potrzeby ponownie rozwiązując środowisko uruchomieniowe Javy.
4. Monitoruje pierwsze uruchomienie, z budżetem czasowym na platformę.

Jeśli nie uruchomi się poprawnie, przywracasz kopię zapasową przed aktualizacją. Serwer śledzący stabilne wydania nigdy nie otrzymuje wersji beta, a link do dziennika zmian wskazuje na rzeczywiste porównanie per-wersja, gdzie źródło je udostępnia. Nieudana aktualizacja uruchamia również [powiadomienie](/docs/integrations/) na Discordzie, jeśli integracja jest skonfigurowana.
