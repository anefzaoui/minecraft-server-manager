---
title: 'Użytkownicy i role'
description: 'Konta, role administratora, operatora i widza oraz uprawnienia dla poszczególnych serwerów w Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Panel jest wielostanowiskowy. Zarządzaj kontami w sekcji **Ustawienia → Użytkownicy**.

![Użytkownicy](/docs/images/settings-users.png)

## Trzy role

| Rola         | Domyślnie dla każdego serwera                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Wszystko: zarządzanie użytkownikami, kluczami API, plikami globalnymi, zaawansowanymi nadpisaniami Docker, i wszystkimi akcjami serwera.                               |
| **operator** | Uruchamianie i konfigurowanie serwerów (start/stop, konsola, kopie zapasowe, światy, mody, większość ustawień), ale nie obszarów dostępnych tylko dla administratorów. |
| **viewer**   | Tylko do odczytu. Podgląd serwerów i ich statusu, bez możliwości wprowadzania zmian.                                                                                   |

Każdy użytkownik, w tym widz, może zarządzać własnym [uwierzytelnianiem dwuskładnikowym](/docs/two-factor-authentication/), ponieważ ochrona własnego logowania nie jest akcją zarządzania serwerem.

Rola jest **domyślna** dla każdego serwera. Aby nadać komuś inne uprawnienia na jednym serwerze, użyj poniższych uprawnień dla poszczególnych serwerów.

## Uprawnienia dla poszczególnych serwerów

Strona **Uprawnienia** (w menu bocznym lub **Uprawnienia serwera** w sekcji **Ustawienia → Użytkownicy**) wyświetla siatkę: operatorzy i widzowie wzdłuż boku, serwery w poprzek. Kliknij komórkę, aby zdecydować, co dany użytkownik może zrobić na tym jednym serwerze. Administratorzy nie są wymienieni, ponieważ zawsze mają wszystko.

![Uprawnienia](/docs/images/settings-permissions.png)

Każda komórka to zestaw uprawnień:

| Uprawnienie        | Co pozwala na tym serwerze                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Wyświetlanie**   | Podgląd serwera, jego statusu, wyjścia konsoli, graczy, historii i statystyk.                                                        |
| **Zasilanie**      | Uruchamianie, zatrzymywanie, restartowanie, zabijanie i przebudowywanie serwera.                                                     |
| **Konsola**        | Uruchamianie poleceń konsoli i szybkich akcji świata, wysyłanie czatu i zarządzanie poleceniami czatu.                               |
| **Gracze**         | Wyrzucanie, banowanie, dodawanie do białej listy, nadawanie uprawnień operatora i edytowanie notatek graczy.                         |
| **Zawartość**      | Instalowanie i usuwanie modów, wtyczek, pakietów, światów, datapacków i edytowanie ekwipunku.                                        |
| **Kopie zapasowe** | Tworzenie, przywracanie, pobieranie i usuwanie kopii zapasowych.                                                                     |
| **Pliki**          | Przeglądanie, edytowanie, przesyłanie i pobieranie plików serwera, zarchiwizowanych logów i pakietów logów; eksportowanie szablonów. |
| **Ustawienia**     | Zmiana ustawień serwera, właściwości, integracji, ikony i wersji aktualizacji.                                                       |
| **Usuwanie**       | Usuwanie serwera.                                                                                                                    |

![Edytor uprawnień](/docs/images/permissions-editor.png)

Poniżej siatki, **Co obejmuje każde uprawnienie** rozwija każde uprawnienie, pokazując, co osoba może zrobić, czego nie obejmuje, oraz dokładne ścieżki panelu, które odblokowuje. Ta ostatnia lista jest sprawdzana pod kątem działającego kodu przez zestaw testów.

![Odnośnik do uprawnień](/docs/images/permissions-reference.png)

Na telefonie siatka układa się w jedną kartę na użytkownika, z wierszem na serwer.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Uprawnienia na telefonie" width="180">
</p>

Jak elementy pasują do siebie:

- **Rola jest domyślna.** Operator zaczyna ze wszystkimi uprawnieniami na każdym serwerze; widz zaczyna tylko z uprawnieniem Wyświetlanie. Komórka napisaną jasnym tekstem (jej etykietka mówi "Domyślna rola") nigdy nie została zmieniona.
- **Komórka nadpisuje rolę tylko dla tego serwera.** Nadaj widzowi Zasilanie i Konsolę na jednym serwerze, a będzie mógł go uruchamiać, podczas gdy wszystkie inne serwery pozostaną dla niego tylko do odczytu. Odbierz uprawnienie Usuwanie operatorowi na głównym serwerze, a zachowa on wszystko inne.
- **Każde uprawnienie obejmuje Wyświetlanie.** Nie możesz działać na serwerze, którego nie możesz zobaczyć.
- **Wyłącz wszystko, aby ukryć serwer.** Znika on z menu bocznego użytkownika, pulpitu nawigacyjnego, kopii zapasowych, harmonogramów, aktywności, aktualizacji, pakietów modów, statusu na żywo, uruchomionych zadań i szablonów, a biblioteka światów przestaje go wymieniać. Bezpośredni link, wywołanie API lub gniazdo konsoli odpowiada "nie znaleziono", tak samo jak serwer, który nie istnieje.
- **Akcje obejmujące cały panel nadal podążają za rolą.** Tworzenie serwerów (w tym klonowanie), przechowywanie, użytkownicy, klucze API, ustawienia globalne i harmonogramy obejmujące cały panel nie są specyficzne dla serwera, więc widz z uprawnieniami na niektórych serwerach nadal nie może nic z tego zrobić. Operatorzy zachowują tworzenie serwerów i harmonogramy obejmujące cały panel; przechowywanie, użytkownicy, klucze API i ustawienia globalne są dostępne tylko dla administratorów.
- **Harmonogramy podążają za serwerem.** Zaplanowany restart, kopia zapasowa lub polecenie na serwerze wymaga odpowiedniego uprawnienia (Zasilanie, Kopie zapasowe lub Konsola), niezależnie od roli.
- **Szablony również podążają za serwerem.** Eksportowanie serwera jako szablonu wymaga uprawnienia Pliki, ponieważ archiwum zawiera jego pliki. Szablon wyeksportowany z serwera, którego ktoś nie może zobaczyć, jest również ukryty przed tą osobą.
- **Obszary dostępne tylko dla administratorów pozostają dostępne tylko dla administratorów** na każdym serwerze: chatbot, retencja kopii zapasowych i zaawansowane nadpisania Docker.

Każda zmiana jest zapisywana w dzienniku aktywności z informacją, kto co zmienił; wpisy te są widoczne tylko dla administratorów. Usunięcie użytkownika usuwa jego wiersze. Usunięcie serwera nie usuwa ich, więc serwer ukryty przed kimś pozostaje ukryty w swojej historii i zachowanych kopiach zapasowych.

Istniejące instalacje działają bez zmian: dopóki administrator nie edytuje komórki, każdy użytkownik ma dokładnie to, co przyznała mu jego rola wcześniej.

## Dostępne tylko dla administratorów i dlaczego

Kilka rzeczy jest celowo ograniczonych do administratorów:

- **Zarządzanie użytkownikami, przechowywanie, ustawienia globalne, klucze API i pliki globalne.**
- **[Publiczne API](/docs/public-api/)**: włączanie `/api/v1` oraz tworzenie, zakresowanie lub odwoływanie jego tokenów Bearer tylko do odczytu.
- **Zaawansowane nadpisania Docker**: niestandardowa nazwa kontenera, dodatkowe publikacje portów i montowania wiązań. Montowanie wiązań może mapować dowolną ścieżkę hosta do kontenera, a w połączeniu z dostępem panelu do Dockera jest to efektywnie root na hoście. Te pola pojawiają się tylko dla administratorów.

Niestandardowe nazwy kontenerów nie mogą również znajdować się w przestrzeni nazw `msm-` własnego panelu, więc ręcznie nazwany kontener nigdy nie może przyćmić innego serwera i przekierować polecenia stop lub polecenia do niewłaściwej instancji.

## Zarządzanie kontami

![Zdjęcie profilowe](/docs/images/profile-picture.png)

Administratorzy mogą tworzyć użytkowników, zmieniać role, resetować hasła i usuwać konta z tabeli Użytkownicy. Kolumna **2FA** pokazuje, czy dany użytkownik ma włączone uwierzytelnianie dwuskładnikowe; administrator może zresetować 2FA innego użytkownika za pomocą opcji **Resetuj 2FA** w menu akcji tego użytkownika (w przypadku utraty telefonu i kodów zapasowych), ale nigdy nie może wyłączyć własnego bez hasła, co jest obsługiwane przez przepływ samoobsługowy.

Nieudane logowania są ograniczane czasowo na konto (zarówno licznik na adres IP, jak i globalny licznik konta), aby spowolnić próby ataku siłowego, a ten sam limit obejmuje etap kodu 2FA, dzięki czemu poprawne hasło nie może zresetować licznika przed odgadywaniem kodu. Przed tym znajduje się bardziej ogólny ogranicznik żądań na adres IP klienta dla punktów końcowych logowania / 2FA / konfiguracji, który można dostroić za pomocą `RATE_LIMIT_AUTH_PER_15MIN` (domyślnie 100; za serwerem proxy, ustaw `TRUST_PROXY`, aby kluczował się na rzeczywistym adresie IP klienta).
