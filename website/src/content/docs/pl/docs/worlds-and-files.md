---
title: 'Światy i pliki'
description: 'Biblioteka światów, przesyłanie i zamiana światów, zakładka modów i wtyczek oraz menedżer plików w przeglądarce.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Powrót do spisu dokumentacji](/docs/)

## Światy

Strona **Światy** to biblioteka światów: każdy zapisany świat w jednym miejscu. **Prześlij świat** pobiera archiwum `.zip` lub `.tar` i automatycznie znajduje w nim świat. **Zapisz do biblioteki** tworzy migawkę działającego świata serwera (działa, gdy serwer jest uruchomiony), a każdy świat z biblioteki można pobrać lub zainstalować na dowolnym serwerze za pomocą **Zainstaluj do…**. Instalacja albo zastępuje świat serwera (serwer musi być zatrzymany, a jego bieżący świat jest najpierw tworzony jako kopia zapasowa), albo dodaje go obok, do późniejszej aktywacji. Przed każdą instalacją uruchamiana jest kontrola zgodności.

Zakładka **Świat → Światy** własnego serwera wyświetla światy na tym serwerze. Stamtąd można aktywować inny świat (przy zatrzymanym serwerze), pobrać, zduplikować, zmienić nazwę lub [zmniejszyć](/docs/world-shrink/) świat, skopiować go na inny serwer, usunąć nieaktywny i zresetować aktywny świat z nowym, zachowanym lub niestandardowym ziarnem (najpierw oferowana jest kopia zapasowa). Ta sama biblioteka znajduje się poniżej, z opcją **Zainstaluj tutaj**.

![Światy](/docs/images/worlds.png)

## Menedżer plików

W sekcji **Świat** serwera, zakładka **Pliki** to pełnoprawny menedżer plików w przeglądarce dla katalogu danych tego serwera. Listuj, czytaj, edytuj, zmieniaj nazwy, przenoś, kopiuj, usuwaj i przesyłaj pliki, twórz foldery i wyszukuj tekst w plikach w folderze za pomocą **Znajdź w plikach**: wszystko, co normalnie robiłbyś przez SSH, z poziomu przeglądarki.

![Menedżer plików](/docs/images/server-files.png)

Pliki tekstowe otwierają się w edytorze z limitem 8 MB; większe pliki można pobrać. Przesyłanie plików akceptuje do 20 plików na raz.

### Pozostawanie w piaskownicy

Każda operacja na plikach jest ograniczona do katalogu danych serwera. Panel rozwiązuje każdą ścieżkę i odrzuca wszystko, co mogłoby ją opuścić: nawigację `..`, ścieżki bezwzględne, a nawet dowiązania symboliczne wskazujące poza katalog (w tym wiszące, które jeszcze nie istnieją). Modyfikacja lub wtyczka nie może umieścić linku, aby oszukać menedżera plików do odczytu lub zapisu w innym miejscu hosta.

## Mody

Dla serwerów z modyfikacjami i wtyczkami, zakładka **Mody** (własna grupa w bocznym pasku serwera) zarządza zestawem modów: przeglądaj i dodawaj mody, oraz zobacz, co jest zainstalowane. Z każdego wiersza zainstalowanego modu można go zaktualizować (lub zignorować tę aktualizację), [przywrócić](/docs/updates/#undoing-a-mod-update) go, wyłączyć lub usunąć, a **Zaktualizuj wszystko** zastosuje wszystkie dostępne aktualizacje z jednym restartem. Aktualizacje modów i paczek pojawiają się również na stronie [Aktualizacje](/docs/updates/).

### Dodawanie modów

![Mody](/docs/images/mods.png)

Cztery sposoby, wszystkie z paska narzędzi zakładki Mody:

- **Szukaj modów**: przeszukuj **Modrinth lub CurseForge** (przycisk CurseForge pojawia się po zapisaniu klucza API w **Ustawienia → Klucze API**), a na serwerach z wtyczkami także **Hangar** (własny rejestr wtyczek PaperMC) i **SpigotMC** (przez proxy CDN Spiget), oba bez kluczy. Zakładka **Datapacks** przeszukuje datapacki Modrinth. Wszystko jest filtrowane według ładowarki serwera i wersji Minecraft (pole wyboru pokazuje również wersje, które nie są oznaczone jako kompatybilne, na własne ryzyko); serwery Quilt automatycznie widzą również wersje oznaczone jako fabric, ponieważ Quilt uruchamia mody Fabric. Wyniki już obecne na serwerze pokazują odznakę **Zainstalowano**. Jeśli autor CurseForge zabrania automatycznego pobierania (lub zasób SpigotMC jest hostowany poza witryną), panel informuje o tym z góry i oferuje ścieżkę **Otwórz CurseForge** (lub **Otwórz SpigotMC**) + **Prześlij Jar** zamiast błędu w połowie instalacji.

  ![Szukanie w Hangarze](/docs/images/mods-search-hangar.png)

- **Importuj Zip**: jeden przycisk, trzy kształty, automatyczne wykrywanie:
  - **Modpack Modrinth (`.mrpack`)**: każdy przypięty plik jest kanonizowany z powrotem do swojego projektu Modrinth poprzez wyszukiwanie skrótu (dzięki czemu zaimportowane mody zachowują prawdziwe nazwy, ikony i pozostają możliwe do aktualizacji; pliki, których Modrinth nie zna, instalują się z własnego adresu URL paczki), weryfikowany podczas pobierania na podstawie sum kontrolnych `sha512` paczki i podglądany z werdyktami dopasowania. Pliki tylko dla klienta są pomijane widocznie, a oba drzewa nadpisywania (`overrides/`, następnie `server-overrides/`; kopia specyficzna dla serwera wygrywa) mogą być zastosowane.

    ![Import mrpack](/docs/images/mrpack-import.png)

  - **Eksport modpacka CurseForge** (zip tworzony przez aplikację CurseForge, z `manifest.json`): każdy przypięty mod jest rozwiązywany masowo, podglądany z ostrzeżeniami (niewłaściwa ładowarka/wersja MC dla tego serwera, pliki już niedostępne na CurseForge, mody wymagające ręcznego pobrania) i instalowany z rzeczywistym postępem. `overrides/` paczki (konfiguracje, skrypty) mogą być opcjonalnie zastosowane; każdy plik, który zostałby nadpisany, jest najpierw tworzony jako kopia zapasowa w `.import-backups/<timestamp>/` wewnątrz folderu serwera.
  - **Zwykły zip plików jar**, które zebrałeś samemu: każdy plik jar jest identyfikowany (dopasowanie skrótu Modrinth → odcisk palca CurseForge → własne metadane pliku jar) i oceniany w stosunku do serwera (_pasuje / niewłaściwa ładowarka / niewłaściwa wersja MC / już zainstalowany / niezidentyfikowany_), dzięki czemu wybierasz, co faktycznie należy, zanim cokolwiek zostanie zainstalowane.
- **Dodaj przez URL**: wklej prawie wszystko: strony projektów Modrinth, CurseForge, Hangar lub SpigotMC, repozytorium GitHub lub adres URL wydania (wystarczy `owner/repo`; instalacje GitHub preferują najnowsze stabilne wydanie i pomijają pliki poboczne `-sources`/`-javadoc`), prosty slug Modrinth, lub dowolny bezpośredni adres URL `.jar`. Panel rozwiązuje właściwą wersję dla ładowarki serwera i wersji MC.

  ![Dodaj przez link](/docs/images/mods-add-by-link.png)

- **Prześlij Jar** (z mechanizmu zastępczego wyszukiwania lub resolvera pobierania w toku): przesłane pliki jar są identyfikowane w ten sam sposób, dzięki czemu zachowują swoją prawdziwą nazwę, wersję, ikonę i stają się możliwe do aktualizacji.

Każda instalacja z rejestru jest **weryfikowana sumą kontrolną podczas pobierania**: strumień jest sprawdzany pod kątem najsilniejszego skrótu publikowanego przez rejestr (sha512 → sha256 → sha1 → md5), a niezgodność przerywa proces, zanim cokolwiek trafi na serwer.

Cały zip (`.mrpack` włącznie) może również **utworzyć serwer**: w kreatorze, na zakładce **Z modpacka**, prześlij go, a manifest paczki (lub większość głosów spośród zidentyfikowanych plików jar) wypełni ładowarkę, wersję Minecraft i wersję ładowarki.
