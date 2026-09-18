---
title: 'Chatbot Minecraft na serwer'
description: 'Ten fork dodaje skonfigurowanego przez administratora chatbota do każdego zarządzanego serwera Minecraft.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Ten fork dodaje skonfigurowanego przez administratora chatbota do każdego zarządzanego serwera Minecraft. Łączy się on z kompatybilnym z OpenAI punktem końcowym `chat-completions`, w tym z Ollama na innym hoście w sieci LAN. Każdy serwer ma własny punkt końcowy, model, nazwę wywołania, personę, politykę transkrypcji, wiadomości outreach i politykę uprawnień. Domyślnym wywołaniem jest `@wizard`, a domyślna persona przedstawia starożytnego, figlarnego czarodzieja z gry; oba są edytowalne.

![Ustawienia chatbota](/docs/images/integrations-chatbot.png)

## Doświadczenie gracza

- Każdy gracz może użyć `@wizard <wiadomość>` (lub skonfigurowanej nazwy wywołania) do rozmowy i uzyskania deterministycznej pomocy w zakresie przepisów vanilla, uwzględniającej wersję Minecraft.
- Powitania po dołączeniu i konfigurowalne, jednorazowe przypomnienie o sprawdzeniu obecności informują graczy o dostępności chatbota. `@wizard chat` otwiera krótkie okno rozmowy z możliwością opt-in; `@wizard bye` je zamyka.
- **Podstawowi użytkownicy** mogą wywoływać włączone uprawnienia dotyczące siebie/świata. **Kontrolerzy uprawnień** mogą wywoływać oddzielnie zweryfikowane akcje wpływające na innego gracza online. Gracze z żadnej z tych grup pozostają tylko w trybie rozmowy.
- Podstawowe samoprzydzielanie przedmiotów przez użytkowników korzysta z listy dozwolonych przedmiotów. Kontrolerzy mogą przekazać innemu graczowi dowolny prawidłowy przedmiot vanilla lub modyfikowany z przestrzenią nazw, z zastrzeżeniem limitu ilości i innych zabezpieczeń uprawnień.

![Transkrypcje chatbota](/docs/images/chatbot-transcripts.png)

## Projekt i bezpieczeństwo

Konfiguracja i transkrypcje są dostępne tylko dla administratorów. Model nigdy nie otrzymuje surowego RCON ani arbitralnego wykonania poleceń. Wiadomość ujawnia tylko jedno stałe narzędzie pasujące do jej wyraźnego zamiaru; kod serwera weryfikuje autoryzację, argumenty, flagi, ilości, czasy odnowienia i dokładne nazwy graczy online przed wykonaniem istniejącej operacji usługi. Selektory Minecraft są odrzucane, akcje między graczami nie mogą być skierowane do wywołującego, uprawnienia zaczynają się w trybie symulacji, a każde próbowane uprawnienie jest audytowane. Nieobsługiwane modele wywoływania narzędzi przełączają się na tryb tylko rozmowy.

Odpowiedzi są ograniczone do czatu Minecraft. Znane przepisy vanilla pochodzą z dołączonych, wersjonowanych danych przepisów i są renderowane jako stabilne rzędy 2x2/3x3; LLM nie jest ufany w tworzeniu układów przepisów. Nieznane lub modyfikowane przepisy kierują gracza do JEI/REI zamiast fabrykowania odpowiedzi.

## Główne pliki implementacji

- `src/services/wizard.js`: konfiguracja per-serwer, żądania kompatybilne z OpenAI, obsługa czatu, outreach, przechowywanie transkrypcji i limity odpowiedzi.
- `src/services/wizardPowers.js`: sprawdzanie ról, schematy narzędzi specyficzne dla zamiaru, walidacja, wykonanie, czasy odnowienia i audyt uprawnień.
- `src/services/wizardRecipes.js`: deterministyczne wyszukiwanie przepisów w wersjach i formatowanie siatki. Dane przepisów i przedmiotów pochodzą z dołączonego pakietu [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Wcześniejszy szkic tego dokumentu wskazywał na folder `src/data/recipes/`, który nigdy nie został zatwierdzony; taki folder nie istnieje, a dane znajdują się w pakiecie. Zobacz "Rozmiar zależności".)
- `src/analytics/ingest.js`: przekazuje sparsowane dołączenia, odejścia i czat graczy do chatbota.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` i `views/partials/server/integrations.hbs`: API administratora i interfejs użytkownika Integracji per-serwer.
- `src/db/migrations/011_wizard_chat.js` do `019_wizard_power_controllers.js`: trwały schemat.
- `test/wizard.test.js`: testy autoryzacji, granic narzędzi, retencji, outreach i zachowania czatu.

Wewnętrzne nazwy tras/modułów/tabel `wizard` są zachowane dla kompatybilności z aktualizacjami i API; "chatbot" to termin produktowy używany przez użytkowników. Podobnie, przechowywane pole `power_testers_json` odpowiada grupie **Podstawowi użytkownicy** w interfejsie użytkownika.

## Rozmiar zależności (`minecraft-data`)

Pomoc w przepisach wykorzystuje pakiet `minecraft-data`. Jest on duży na dysku (około 429 MB po zainstalowaniu) i jest dostarczany w obrazie produkcyjnym, ponieważ jest to zależność czasu wykonania, a nie deweloperska. Zachowujemy go celowo, aby pomoc w przepisach działała offline dla każdej wersji Minecraft bez połączenia sieciowego.

Uwagi dla każdego, kto spojrzy na to później (człowieka lub AI), aby rozmiar nie był zaskoczeniem:

- Obecnie używane są tylko dane Java (`pc`). `wizardRecipes.js` odczytuje tabele `minecraftData.versions.pc` oraz tabele `recipes`, `items` i `blocks` dla poszczególnych wersji. Pliki, których faktycznie dotyka, sumują się do około 15 MB dla każdej wersji pc.
- Około 330 MB pakietu to `data/bedrock`, a nic tutaj tego jeszcze nie odczytuje. Zostawiamy to celowo. Jeśli panel kiedykolwiek doda obsługę Minecraft Bedrock, dane przepisów i przedmiotów Bedrock są już tutaj, więc funkcja przepisów może zostać rozszerzona o obsługę serwerów Bedrock bez dodawania nowej zależności. Zacznij od `minecraftData.versions.bedrock` i podążaj tą samą ścieżką co dla pc.
- Jeśli rozmiar kiedykolwiek będzie musiał zostać zmniejszony przed wdrożeniem obsługi Bedrock, w tym repozytorium istnieje już wzorzec. `src/services/itemRegistry.js` pobiera pliki `minecraft-data` z CDN jsDelivr, gdy ich potrzebuje, i przechowuje je w pamięci podręcznej w `api_cache`. Albo to podejście, albo mały, ręcznie wybrany podzbiór `src/data/recipes/` obejmujący kilka popularnych wersji, znacznie zmniejszyłby rozmiar obrazu.

## Lokalna pamięć masowa i ręczna inspekcja

Wszystkie ustawienia i przechowywane transkrypcje znajdują się w bazie danych panelu SQLite pod adresem `/data/panel.db` w kontenerze panelu. Przy standardowym montowaniu Compose, ścieżka hosta to `${DATA_DIR_HOST}/panel.db` (na przykład `/opt/msm/data/panel.db`). Istotne tabele to `wizard_configs`, `wizard_transcripts` i `wizard_outreach`; audyty uprawnień to wiersze w tabeli `events` z typem `wizard-power`. Opcjonalny klucz API LLM jest szyfrowany AES-256-GCM przy użyciu `SESSION_SECRET` panelu, zazwyczaj utrwalany jako `${DATA_DIR_HOST}/.session-secret`.

Kopiuj bazę danych i zatrzymaj panel przed bezpośrednią edycją SQLite, aby jego WAL był bezpiecznie obsługiwany. Preferowane jest użycie interfejsu użytkownika/API administratora, ponieważ stosuje on walidację i szyfrowanie. Zachowaj pliki `panel.db`, `panel.db-wal` i `panel.db-shm` razem podczas kopiowania aktywnej bazy danych.
