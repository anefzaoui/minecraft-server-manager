---
title: 'Chatbot dla serwera Minecraft'
description: 'Panel oferuje skonfigurowanego przez administratora chatbota dla każdego zarządzanego serwera Minecraft, dostępnego w zakładce Ustawienia → Chatbot serwera.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Panel oferuje skonfigurowany przez administratora chatbot dla każdego zarządzanego serwera Minecraft, ustawiany w zakładce serwera **Ustawienia → Chatbot**. Łączy się on z punktem końcowym zgodnym z OpenAI dla funkcji chat-completions, w tym z Ollama na innym hoście w sieci LAN. Każdy serwer ma własny punkt końcowy, model, nazwę wywołania, personę, zasady transkrypcji, wiadomości powitalne i zasady uprawnień. Domyślnym wywołaniem jest `@wizard`, a domyślna persona przedstawia starożytnego, figlarnego czarodzieja w świecie gry; oba można edytować.

![Ustawienia chatbota](/docs/images/integrations-chatbot.png)

## Doświadczenie gracza

- Każdy gracz może użyć `@wizard <wiadomość>` (lub skonfigurowanego wywołania) do rozmowy i uzyskania deterministycznej pomocy dotyczącej przepisów vanilla, uwzględniającej wersję Minecraft.
- Powitania po dołączeniu i konfigurowalne, jednorazowe przypomnienia o sesji gry informują graczy o dostępności chatbota. `@wizard chat` otwiera krótkie okno rozmowy z możliwością opt-in; `@wizard bye` je zamyka.
- **Podstawowi użytkownicy** mogą wywoływać włączone uprawnienia dotyczące siebie/świata. **Kontrolerzy uprawnień** mogą wywoływać oddzielnie zweryfikowane akcje wpływające na innego gracza online. Gracze nie należący do żadnej z tych grup pozostają ograniczeni do trybu konwersacji.
- Samodzielne prezenty dla podstawowych użytkowników korzystają z listy dozwolonych przedmiotów. Kontrolerzy mogą dać innemu graczowi dowolny prawidłowy przedmiot vanilla lub modyfikowany z przestrzenią nazw, z zastrzeżeniem limitu ilości i innych zabezpieczeń uprawnień.

![Transkrypcje chatbota](/docs/images/chatbot-transcripts.png)

## Projekt i bezpieczeństwo

Konfiguracja i transkrypcje są dostępne tylko dla administratorów. Model nigdy nie otrzymuje surowego RCON ani arbitralnego wykonania poleceń. Wiadomość ujawnia tylko jedno, stałe narzędzie pasujące do jej wyraźnego zamiaru; kod serwera weryfikuje autoryzację, argumenty, flagi, ilości, czasy odnowienia i dokładne nazwy graczy online przed wykonaniem istniejącej operacji usługi. Selektory Minecraft są odrzucane, akcje między graczami nie mogą być skierowane do osoby wywołującej, uprawnienia rozpoczynają się w trybie symulacji, a każde próbowane uprawnienie jest audytowane. Nieobsługiwane modele wywołujące narzędzia przełączają się na tryb konwersacji.

Odpowiedzi są ograniczone do czatu Minecraft. Znane przepisy vanilla pochodzą z dołączonych, wersjonowanych danych przepisów i są renderowane jako stabilne rzędy 2x2/3x3; LLM nie jest ufany w tworzenie układów przepisów. Nieznane lub modyfikowane przepisy kierują gracza do JEI/REI zamiast fabrykowania odpowiedzi.

## Główne pliki implementacji

- `src/services/wizard.js`: konfiguracja na serwer, żądania zgodne z OpenAI, obsługa czatu, wiadomości powitalne, przechowywanie transkrypcji i limity odpowiedzi.
- `src/services/wizardPowers.js`: sprawdzanie ról, schematy narzędzi specyficzne dla zamiaru, walidacja, wykonanie, czasy odnowienia i audyt uprawnień.
- `src/services/wizardRecipes.js`: deterministyczne wyszukiwanie przepisów w wersjach i formatowanie siatki. Dane przepisów i przedmiotów pochodzą z dołączonego pakietu [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Wcześniejszy szkic tego dokumentu wskazywał na folder `src/data/recipes/`, który nigdy nie został zatwierdzony; takiego folderu nie ma, a dane znajdują się w pakiecie. Zobacz "Ślad zależności".)
- `src/analytics/ingest.js`: przekazuje przetworzone dołączenia, odejścia i czaty graczy do chatbota.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` i `views/partials/server/integrations.hbs` (przez `chatbot.hbs`): API administratora i zakładka Ustawienia → Chatbot na serwer.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js` i `019_wizard_power_controllers.js`: trwały schemat.
- `test/wizard.test.js`: testy autoryzacji, granic narzędzi, przechowywania, wiadomości powitalnych i zachowania czatu.

Wewnętrzne nazwy tras/modułów/tabel `wizard` są zachowane dla kompatybilności z aktualizacjami i API; "chatbot" to termin produktowy używany przez użytkowników. Podobnie pole `power_testers_json` mapuje się na grupę **Podstawowi użytkownicy** w interfejsie użytkownika.

## Ślad zależności (`minecraft-data`)

Pomoc dotycząca przepisów wykorzystuje pakiet `minecraft-data`. Jest on duży na dysku (około 429 MB po zainstalowaniu) i jest dostarczany w obrazie produkcyjnym, ponieważ jest to zależność środowiska uruchomieniowego, a nie deweloperska. Zachowujemy go celowo, aby pomoc dotycząca przepisów działała offline dla każdej wersji Minecraft bez połączenia sieciowego.

Uwagi dla każdego, kto spojrzy na to później (człowieka lub AI), aby rozmiar nie był zaskoczeniem:

- Obecnie używane są tylko dane dla wersji Java (`pc`). `wizardRecipes.js` odczytuje tabele `minecraftData.versions.pc` oraz dane specyficzne dla wersji: `recipes`, `items` i `blocks`. Pliki, których faktycznie dotyka, sumują się do około 15 MB dla każdej wersji pc.
- Około 330 MB pakietu to `data/bedrock`, a nic tutaj tego jeszcze nie odczytuje. Zostawiamy to celowo. Jeśli panel kiedykolwiek doda obsługę Minecraft Bedrock, dane przepisów i przedmiotów dla Bedrock są już tutaj, więc funkcja przepisów może zostać rozszerzona o obsługę serwerów Bedrock bez dodawania nowej zależności. Zacznij od `minecraftData.versions.bedrock` i podążaj tą samą ścieżką co dla pc.
- Jeśli rozmiar kiedykolwiek będzie musiał zostać zmniejszony przed dodaniem obsługi Bedrock, w tym repozytorium istnieje już wzorzec. `src/services/itemRegistry.js` pobiera pliki `minecraft-data` z CDN jsDelivr, gdy ich potrzebuje, i przechowuje je w pamięci podręcznej w `api_cache`. Albo to podejście, albo mały, ręcznie wybrany podzbiór `src/data/recipes/` obejmujący kilka popularnych wersji, znacznie zmniejszyłby obraz.

## Lokalna pamięć masowa i ręczna inspekcja

Wszystkie ustawienia i przechowywane transkrypcje znajdują się w bazie danych SQLite panelu pod adresem `/data/panel.db` w kontenerze panelu. Przy standardowym montowaniu Compose, ścieżka hosta to `${DATA_DIR_HOST}/panel.db` (na przykład `/opt/msm/data/panel.db`). Istotne tabele to `wizard_configs`, `wizard_transcripts` i `wizard_outreach`; audyty uprawnień to wiersze w tabeli `events` z typem `wizard-power`. Opcjonalny klucz API LLM jest szyfrowany AES-256-GCM za pomocą klucza panelu w spoczynku, `.secret-key` w folderze danych (oddzielnie od `SESSION_SECRET`).

Przed bezpośrednią edycją SQLite wykonaj kopię zapasową bazy danych i zatrzymaj panel, aby zapewnić bezpieczne zarządzanie jego plikiem WAL. Preferowane jest użycie interfejsu użytkownika/API administratora, ponieważ stosuje on walidację i szyfrowanie. Przechowuj pliki `panel.db`, `panel.db-wal` i `panel.db-shm` razem podczas kopiowania aktywnej bazy danych.
