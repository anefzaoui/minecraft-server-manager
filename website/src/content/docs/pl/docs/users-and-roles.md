---
title: 'Użytkownicy i role'
description: 'Panel jest wieloużytkownikowy.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Panel obsługuje wielu użytkowników. Zarządzaj kontami w sekcji **Ustawienia → Użytkownicy**.

![Użytkownicy](/docs/images/settings-users.png)

## Trzy role

| Rola         | Uprawnienia                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Wszystko: zarządzanie użytkownikami, kluczami API, globalnymi plikami, zaawansowanymi nadpisaniami Docker oraz każdą akcją serwera.                                   |
| **operator** | Uruchamianie i konfigurowanie serwerów (start/stop, konsola, kopie zapasowe, światy, mody, większość ustawień), ale bez dostępu do obszarów tylko dla administratora. |
| **viewer**   | Tylko do odczytu. Podgląd serwerów i ich statusu, bez możliwości wprowadzania zmian.                                                                                  |

Każdy użytkownik, w tym przeglądający (viewer), może zarządzać własnym [uwierzytelnianiem dwuskładnikowym](/docs/two-factor-authentication/), ponieważ ochrona własnego loginu nie jest czynnością związaną z zarządzaniem serwerem.

## Tylko dla administratorów – dlaczego?

Kilka funkcji jest celowo ograniczonych tylko do administratorów:

- **Zarządzanie użytkownikami, kluczami API i globalnymi plikami.**
- **[Publiczne API](/docs/public-api/)** – włączanie `/api/v1` oraz tworzenie, ograniczanie zakresu lub unieważnianie tokenów Bearer typu "tylko do odczytu".
- **Zaawansowane nadpisania Docker** – niestandardowa nazwa kontenera, dodatkowe publikowane porty oraz bind mounty. Bind mount pozwala zmapować dowolną ścieżkę hosta do kontenera, co w połączeniu z dostępem panelu do Docker jest równoznaczne z uzyskaniem uprawnień roota na hoście. Te pola są widoczne tylko dla administratorów.

Niestandardowe nazwy kontenerów nie mogą również znajdować się w przestrzeni nazw `msm-` panelu, dzięki czemu ręcznie nazwany kontener nigdy nie przesłoni innego serwera i nie spowoduje wysłania polecenia stop lub komendy do niewłaściwej instancji.

## Zarządzanie kontami

![Zdjęcie profilowe](/docs/images/profile-picture.png)

Administratorzy mogą tworzyć użytkowników, zmieniać role, resetować hasła i usuwać konta z poziomu tabeli Użytkownicy. Kolumna **2FA** pokazuje, czy dany użytkownik ma włączone uwierzytelnianie dwuskładnikowe; administrator może **zresetować** 2FA innego użytkownika (w przypadku utraty telefonu i kodów zapasowych), ale nigdy nie może wyłączyć własnego 2FA bez podania hasła, co jest obsługiwane przez proces samoobsługowy.

Nieudane próby logowania są ograniczane czasowo dla każdego konta (zarówno licznik na IP, jak i globalny licznik konta), aby spowolnić ataki typu brute-force. Ten sam limit obejmuje etap wprowadzania kodu 2FA, dzięki czemu poprawne hasło nie zresetuje licznika przed próbą odgadnięcia kodu. Przed tym mechanizmem znajduje się dodatkowy, mniej restrykcyjny ogranicznik żądań na IP klienta dla endpointów logowania / 2FA / konfiguracji, który można dostosować za pomocą `RATE_LIMIT_AUTH_PER_15MIN` (domyślnie 100; w przypadku korzystania z reverse proxy należy ustawić `TRUST_PROXY`, aby ogranicznik działał w oparciu o rzeczywisty adres IP klienta).
