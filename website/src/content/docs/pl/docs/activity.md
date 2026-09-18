---
title: 'Dziennik aktywności'
description: 'Strona Aktywność to pełny ślad audytu: przeszukiwalny, chronologiczny zapis wszystkiego, co wydarzyło się w panelu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Aktywność** to pełny dziennik audytu: przeszukiwalny, chronologiczny zapis wszystkiego, co wydarzyło się w panelu.

![Aktywność](/docs/images/activity.png)

## Co jest rejestrowane

- **Uwierzytelnianie** - logowania (w tym czy użyto 2FA lub kodu zapasowego), włączanie, wyłączanie lub resetowanie 2FA.
- **Cykl życia serwera** - tworzenie, uruchamianie, zatrzymywanie, restartowanie, awarie i zdarzenia braku pamięci.
- **Alerty** - zablokowane uruchamiania, błędy zatrzymania, nieudane harmonogramy, zatrzymania z powodu limitów, niezdrowe kontenery, serwery offline po restarcie.
- **Dane** - utworzone i przywrócone kopie zapasowe, wyeksportowane szablony, instalacje i aktualizacje paczek.
- **Konfiguracja** - zmiany komend czatu, zmiany ról i edycje ustawień.

Każdy wpis rejestruje, kto to zrobił (nazwa użytkownika lub panel/harmonogram dla akcji automatycznych), którego serwera dotyczy i kiedy. [Pulpit nawigacyjny](/docs/dashboard/) pokazuje najnowsze wpisy; ta strona to pełna historia. Zdarzenia cyklu życia i alerty mogą być również przekazywane do Discorda (patrz [Integracje](/docs/integrations/)).

Ponieważ przechwytuje zdarzenia związane z bezpieczeństwem (logowania, zmiany 2FA, zmiany ról), dziennik aktywności jest również pierwszym miejscem, do którego należy się udać, jeśli coś jest nie tak z kontem.
