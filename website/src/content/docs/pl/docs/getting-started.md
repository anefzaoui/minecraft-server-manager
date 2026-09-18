---
title: 'Pierwsze kroki'
description: 'Po pierwszym otwarciu panelu poprosi Cię o utworzenie konta administratora.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Powrót do spisu dokumentacji](/docs/)

## Pierwsza konfiguracja

Po pierwszym uruchomieniu panelu poprosi Cię o utworzenie konta administratora. Jest to jedyne konto, które istnieje, dopóki nie dodasz kolejnych, i ma pełną kontrolę.

Wybierz nazwę użytkownika i hasło o długości co najmniej 8 znaków. To wszystko: jesteś zalogowany i przeniesiony bezpośrednio do pulpitu nawigacyjnego.

> **Publiczne instalacje są chronione kodem PIN.** Jeśli uruchomisz panel powiązany z adresem innym niż pętla zwrotna (`PANEL_HOST` inny niż `127.0.0.1`), strona konfiguracji poprosi również o **6-cyfrowy kod PIN**. Panel wyświetla go w konsoli podczas uruchamiania. Wprowadź go wraz z nazwą użytkownika i hasłem. Zapobiega to sytuacji, w której osoba postronna, która pierwsza uzyska dostęp do portu, może przejąć konto administratora. Kod PIN znika po utworzeniu konta administratora.

## Logowanie

Po konfiguracji panel jest chroniony ekranem logowania. Wprowadź swoją nazwę użytkownika i hasło, aby kontynuować.

![Logowanie](/docs/images/login.png)

Jeśli [uwierzytelnianie dwuskładnikowe](/docs/two-factor-authentication/) jest włączone na Twoim koncie, zostaniesz poproszony o 6-cyfrowy kod z aplikacji uwierzytelniającej zaraz po podaniu hasła.

## Poruszanie się po panelu

Wszystko znajduje się w lewym bocznym pasku:

- **Pulpit** - wszystkie serwery w skrócie ([szczegóły](/docs/dashboard/)).
- **Serwery**, **Modpacki**, **Światy**, **Schematy** - tworzenie i zarządzanie serwerami oraz ich zawartością.
- **Aktualizacje**, **Kopie zapasowe**, **Harmonogramy**, **Pamięć masowa**, **Aktywność** - strona operacyjna: co jest nieaktualne, Twoje migawki, automatyzacja, wykorzystanie dysku i dziennik audytu.
- **Ustawienia** (na dole): użytkownicy, klucze API i konfiguracja panelu.

Górny pasek zawiera przycisk **Utwórz serwer**, przełącznik **motywu** (ciemny/jasny) oraz **menu konta**, gdzie możesz zarządzać [uwierzytelnianiem dwuskładnikowym](/docs/two-factor-authentication/) lub się wylogować.

## Na telefonie lub tablecie

Każda strona jest zaprojektowana najpierw z myślą o wąskim ekranie, a następnie rozszerza się: boczny pasek chowa się za przyciskiem menu, tabele danych składają się w karty, paski narzędzi zawijają się, a szyna sterowania światem zwija się do karty, którą otwierasz, gdy jej potrzebujesz. Przyciski i znaczniki mają odpowiedni rozmiar obszaru dotykowego. Nic nie jest dostępne tylko na komputerze stacjonarnym.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Pulpit na telefonie" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Przegląd serwera na telefonie" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsola na telefonie" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Zakładka modów na telefonie" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Ustawienia na telefonie" width="180">
</p>

## Czego potrzebujesz

Panel komunikuje się z Dockerem w celu uruchamiania serwerów, dlatego potrzebuje dostępu do demona Docker (Docker Desktop lub gniazda Docker Engine). Gdy Docker jest dostępny, kafelek Docker na pulpicie nawigacyjnym pokazuje **Połączono** i jego wersję. Jeśli nie jest, panel nadal działa. Nie możesz uruchamiać serwerów, dopóki demon nie zostanie uruchomiony.

## Następne kroki

- [Utwórz swój pierwszy serwer →](/docs/servers/)
- [Zabezpiecz swoje konto za pomocą 2FA →](/docs/two-factor-authentication/)
