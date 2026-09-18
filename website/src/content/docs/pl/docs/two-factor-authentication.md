---
title: 'Uwierzytelnianie dwuskładnikowe'
description: 'Uwierzytelnianie dwuskładnikowe (2FA) dodaje drugi krok podczas logowania: po podaniu hasła wprowadzasz krótki kod z aplikacji uwierzytelniającej na swoim telefonie.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Uwierzytelnianie dwuskładnikowe (2FA) dodaje drugi krok do logowania: po podaniu hasła wprowadzasz krótki kod z aplikacji uwierzytelniającej na swoim telefonie. Nawet jeśli ktoś pozna Twoje hasło, nie będzie mógł się zalogować bez Twojego urządzenia.

Działa z każdym standardowym uwierzytelniaczem TOTP (Google Authenticator, Authy, 1Password, Microsoft Authenticator i innymi) i jest dostępne dla **każdego** konta, nie tylko administratorów. Ochrona własnego logowania nie jest czynnością związaną z zarządzaniem serwerem, więc widzowie i operatorzy również mogą ją włączyć.

## Włączanie 2FA

Otwórz menu konta (Twoje inicjały, w prawym górnym rogu) i wybierz **Uwierzytelnianie dwuskładnikowe**.

![Menu konta](/docs/images/2fa-user-menu.png)

Pojawi się okno rejestracji:

![Rejestracja](/docs/images/2fa-enroll.png)

1. **Zeskanuj kod QR** za pomocą swojej aplikacji uwierzytelniającej lub kliknij **Kopiuj** i wprowadź klucz ręcznie.
2. Wpisz **6-cyfrowy kod**, który teraz wyświetla Twoja aplikacja.
3. **Potwierdź swoje hasło.** Włączenie 2FA ponownie sprawdza Twoje hasło, więc przypadkowa otwarta sesja nie może go włączyć na urządzeniu innej osoby.
4. Kliknij **Włącz**.

### Zapisz swoje kody zapasowe

W momencie włączenia 2FA panel wyświetli zestaw jednorazowych **kodów zapasowych**.

![Kody zapasowe](/docs/images/2fa-backup-codes.png)

Każdy kod działa **raz**, aby umożliwić zalogowanie, jeśli kiedykolwiek stracisz dostęp do swojej aplikacji uwierzytelniającej. Zapisz je w bezpiecznym miejscu (menedżer haseł jest idealny), ponieważ nie zostaną one ponownie wyświetlone. Możesz wygenerować nowy zestaw w dowolnym momencie (co unieważni stare kody).

## Logowanie z 2FA

Od tego momentu logowanie będzie miało drugi krok. Po podaniu nazwy użytkownika i hasła panel poprosi o kod:

![Logowanie z 2FA](/docs/images/2fa-login-challenge.png)

Wprowadź aktualny 6-cyfrowy kod z aplikacji (lub jeden z kodów zapasowych) i jesteś zalogowany. Dopóki nie wykonasz tego kroku, sesja **nie** jest zalogowana: nie może uzyskać dostępu do żadnej strony ani API.

## Zarządzanie lub wyłączanie 2FA

Otwórz tę samą opcję **Uwierzytelnianie dwuskładnikowe** w menu konta, gdy jest ona włączona. Po potwierdzeniu hasła możesz:

- **Wygenerować ponownie kody zapasowe** - wydaje nowy zestaw i unieważnia stary.
- **Wyłączyć 2FA** - usuwa je z Twojego konta.

Obie operacje najpierw ponownie sprawdzają Twoje aktualne hasło.

## Zgubiono telefon _i_ kody zapasowe?

**Administrator** może zresetować 2FA innego użytkownika z poziomu **Ustawienia → Użytkownicy** (przycisk **Resetuj** w kolumnie 2FA). To usuwa 2FA dla konta, dzięki czemu użytkownik może zalogować się tylko za pomocą hasła i skonfigurować je ponownie. Administratorzy nie mogą zresetować _własnego_ 2FA bez hasła. Przechodzą przez normalny proces wyłączania z potwierdzeniem hasła, więc przejęta sesja administratora nie może usunąć własnego drugiego składnika.

## Warto wiedzieć

- Kody są oparte na czasie i zmieniają się co 30 sekund; panel akceptuje niewielkie przesunięcie zegara i cicho odzyskuje synchronizację, jeśli zegar serwera zostanie później poprawiony.
- Kod nie może zostać użyty ponownie - po użyciu do zalogowania, ten sam kod nie zadziała ponownie w swoim oknie czasowym.
- Błędne kody są ograniczane czasowo. Ograniczenie jest **współdzielone** z etapem hasła (blokada na konto plus ograniczenie `RATE_LIMIT_AUTH_PER_15MIN` na adres IP), więc wprowadzenie poprawnego hasła nie może zresetować licznika tuż przed odgadnięciem 6-cyfrowego kodu.
- Zmiany 2FA (włączenie, wyłączenie, resetowanie, użycie kodu zapasowego) są rejestrowane w [Dzienniku aktywności](/docs/activity/).
