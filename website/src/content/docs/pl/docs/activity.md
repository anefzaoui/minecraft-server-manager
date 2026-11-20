---
title: 'Dziennik aktywności'
description: 'Strona Aktywność to pełny ślad audytu: przeszukiwalny, chronologiczny zapis wszystkiego, co wydarzyło się w panelu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Aktywność** to pełny dziennik audytu: przeszukiwalny, chronologiczny zapis wszystkiego, co wydarzyło się w panelu. Filtruj według serwera lub typu zdarzenia, przeszukuj podsumowania i eksportuj przefiltrowane dane jako CSV lub JSON. Wpisy, które przechwyciły logi (np. awarię), otwierają je na miejscu.

![Aktywność](/docs/images/activity.png)

## Co jest rejestrowane

- **Uwierzytelnianie**: logowania (w tym informacja, czy użyto 2FA lub kodu zapasowego), blokady kont, zmiany haseł oraz włączanie, wyłączanie lub resetowanie 2FA.
- **Cykl życia serwera**: tworzenie, uruchamianie, zatrzymywanie, restartowanie, awarie, automatyczne restarty i zdarzenia braku pamięci.
- **Alerty**: zablokowane uruchamiania, błędy zatrzymania, nieudane harmonogramy, zatrzymania z powodu limitów, niezdrowe kontenery, wyłączenie po restarcie.
- **Dane**: utworzone i przywrócone kopie zapasowe, wyeksportowane szablony, zainstalowane i zaktualizowane pakiety, zmiany modów i światów oraz edycje plików.
- **Gracze**: wyrzucenia, bany, zmiany na liście dozwolonych i uprawnień administratora, notatki o graczach.
- **Konfiguracja**: zmiany poleceń czatu, zmiany użytkowników i ról, zmiany uprawnień dla poszczególnych serwerów, zmiany portów gry i edycje ustawień.

Każdy wpis rejestruje, kto to zrobił (nazwa użytkownika lub panel/harmonogram dla zautomatyzowanych działań), którego serwera dotyczy i kiedy. [Pulpit nawigacyjny](/docs/dashboard/) pokazuje najnowsze wpisy; ta strona zawiera pełną historię. Operatorzy i widzowie widzą tylko wpisy dotyczące serwerów, które mogą przeglądać (plus te dotyczące całego panelu), a zmiany uprawnień dla poszczególnych serwerów są widoczne tylko dla administratorów. Zdarzenia cyklu życia i alerty mogą być również przekazywane do Discorda (patrz [Integracje](/docs/integrations/)).

Ponieważ przechwytuje zdarzenia związane z bezpieczeństwem (logowania, zmiany 2FA, zmiany ról i uprawnień), dziennik aktywności jest również pierwszym miejscem, do którego należy się udać, jeśli coś jest nie tak z kontem.
