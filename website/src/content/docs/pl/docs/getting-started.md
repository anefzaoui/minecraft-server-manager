---
title: 'Pierwsze kroki'
description: 'Zainstaluj Minecraft Server Manager i dokończ początkową konfigurację: sprawdzenie systemu, strefa czasowa i konto administratora.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Powrót do spisu dokumentacji](/docs/)

## Pierwsza konfiguracja

Przy pierwszym uruchomieniu panelu, krótki kreator przeprowadzi Cię przez proces:

1. **Kontrola systemu** upewnia się, że Docker jest dostępny, Node.js jest wystarczająco nowy, a folder danych jest zapisywalny. Jeśli Docker nie działa, nadal możesz kontynuować; tworzenie i uruchamianie serwerów poczeka, aż zacznie działać.
2. **Utwórz konto administratora**. Jest to jedyne konto istniejące do momentu dodania kolejnych i posiada pełną kontrolę. Wybierz nazwę użytkownika (od 2 do 32 znaków) i hasło o długości co najmniej 8 znaków. Po utworzeniu zostaniesz automatycznie zalogowany.
3. **Konfiguracja panelu** (opcjonalnie): publiczny adres domenowy do wyświetlania graczom w adresach połączeń, klucz API CurseForge i Twoja strefa czasowa. Wszystko to można później zmienić w **Ustawieniach**.

Ostatni krok oferuje **Utwórz serwer** lub **Przejdź do pulpitu nawigacyjnego**.

![Krok Kontrola systemu podczas pierwszej konfiguracji](/docs/images/setup-system-check.png)

> **Instalacje dostępne publicznie są chronione PIN-em.** Jeśli uruchomisz panel powiązany z adresem innym niż pętla zwrotna (`PANEL_HOST` inny niż `127.0.0.1`), strona konfiguracji poprosi również o **6-cyfrowy PIN**. Panel wyświetli go w konsoli podczas uruchamiania. Wprowadź go wraz z nazwą użytkownika i hasłem. Zapobiega to sytuacji, w której osoba postronna, która pierwsza uzyska dostęp do portu, przejmie konto administratora. PIN znika po utworzeniu konta administratora.

## Logowanie

Po zakończeniu konfiguracji panel jest chroniony ekranem logowania. Wprowadź swoją nazwę użytkownika i hasło, aby kontynuować.

![Logowanie](/docs/images/login.png)

Jeśli [uwierzytelnianie dwuskładnikowe](/docs/two-factor-authentication/) jest włączone na Twoim koncie, zaraz po podaniu hasła zostaniesz poproszony o 6-cyfrowy kod z Twojej aplikacji uwierzytelniającej.

## Nawigacja

Wszystko jest dostępne z lewego paska bocznego:

- **Pulpit nawigacyjny** - wszystkie serwery w skrócie ([szczegóły](/docs/dashboard/)).
- **Serwery**, **Modpacki**, **Światy**, **Szkice** - tworzenie i zarządzanie serwerami oraz ich zawartością.
- **Aktualizacje**, **Kopie zapasowe**, **Harmonogramy**, **Pamięć masowa**, **Aktywność** - strona operacyjna: co jest nieaktualne, Twoje migawki, automatyzacja, wykorzystanie dysku i dziennik audytu.
- **Uprawnienia** (na dole, tylko dla administratorów): co każdy użytkownik może robić na każdym serwerze ([szczegóły](/docs/users-and-roles/#per-server-permissions)).
- **Ustawienia** (na dole, tylko dla administratorów): klucze API, konfiguracja panelu, domyślne ustawienia dla nowych serwerów, [retencja kopii zapasowych](/docs/backups/#retention), użytkownicy, bezpieczeństwo logowania i publiczne API.

Poniżej znajdują się listy Twoich serwerów. Otwarcie jednego z nich pokazuje jego własne zakładki: **Przegląd**, **Konsola**, **Gracze**, **Mody**, **Świat**, **Kopie zapasowe**, **Monitorowanie** i **Ustawienia**, większość z powiązanymi podzakładkami (na przykład **Ustawienia → Konfiguracja** zawiera ustawienia serwera i jego port gry). Zobacz [Pojedynczy serwer](/docs/servers/#a-single-server).

Górny pasek zawiera przycisk **Utwórz serwer**, **przełącznik motywu** (ciemny/jasny) i **menu konta**, gdzie możesz zmienić swoje zdjęcie profilowe, zarządzać [uwierzytelnianiem dwuskładnikowym](/docs/two-factor-authentication/) lub się wylogować.

## Na telefonie lub tablecie

Każda strona jest najpierw zaprojektowana z myślą o wąskim ekranie, a następnie rozszerzana: pasek boczny chowa się za przyciskiem menu, tabele danych składają się w karty, paski narzędzi zawijają się, a szyna sterowania światem zwija się do karty, którą otwiera się w razie potrzeby. Przyciski i znaczniki mają odpowiedni rozmiar obszaru dotykowego. Nic nie jest dostępne tylko na komputerach stacjonarnych.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Pulpit nawigacyjny na telefonie" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Przegląd serwera na telefonie" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsola na telefonie" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Zakładka Mody na telefonie" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Kompatybilność wersji na telefonie" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Ustawienia na telefonie" width="180">
</p>

## Co jest potrzebne

Panel komunikuje się z Dockerem w celu uruchamiania serwerów, dlatego potrzebuje dostępu do demona Dockera (Docker Desktop lub gniazda Docker Engine). Gdy Docker jest dostępny, kafelek Docker na pulpicie nawigacyjnym pokazuje **Połączono** i jego wersję. Jeśli nie jest, panel nadal działa. Nie można jednak uruchamiać serwerów, dopóki demon nie zostanie uruchomiony.

## Następne kroki

- [Utwórz swój pierwszy serwer →](/docs/servers/)
- [Zabezpiecz swoje konto za pomocą 2FA →](/docs/two-factor-authentication/)
