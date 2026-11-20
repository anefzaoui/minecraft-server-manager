---
title: 'Zaproszenia i strona statusu'
description: 'Zaproś znajomych na serwer, podając adres, wersję i paczkę modów klienta, oraz udostępnij publiczną stronę statusu, która wyświetla tylko to, co wybierzesz.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Dwie karty w grupie **Ustawienia** serwera pomagają graczom go znaleźć i dołączyć: **Zaproszenia** zawiera wszystko, czego potrzebuje przyjaciel, aby się połączyć, a **Strona statusu** publikuje małą publiczną stronę pokazującą, czy serwer jest aktywny. Obie wymagają uprawnienia **Ustawienia** serwera ([użytkownicy i role](/docs/users-and-roles/#per-server-permissions)).

## Zaproszenia

**Ustawienia → Zaproszenia** zawiera kartę **Zaproś znajomych**:

- **Adres do udostępnienia** zawiera listę adresów maszyny w Twojej sieci lokalnej z portem gry serwera, Twój publiczny adres, jeśli panel mógł go wykryć (gracze spoza Twojej sieci mogą się połączyć tylko przez przekierowanie portów), oraz **Niestandardowy adres…** dla domeny lub adresu, który sam skonfigurowałeś, na przykład `play.example.com:25565`.
- **Tekst zaproszenia** to gotowa do wklejenia wiadomość z nazwą serwera, wybranym adresem oraz jego wersją i typem Minecraft. **Kopiuj tekst zaproszenia** umieszcza go w schowku. Gdy biała lista jest włączona, tekst prosi znajomych o ich nazwy użytkownika Minecraft, a karta przypomina o dodaniu każdego znajomego w karcie **Gracze** przed jego dołączeniem.
- **Czego potrzebują znajomi** mówi, co jest potrzebne po stronie gracza: nic poza odpowiednią wersją Minecraft dla serwera vanilla lub z wtyczkami (Paper i podobne), lub modami serwera dla serwera z modami.

### Zestaw modów klienta

Na serwerze z modami karta oferuje również **Pobierz zestaw modów klienta (.mrpack)**. Znajomi importują go do Prism Launcher lub Modrinth App, który instaluje wersję Minecraft serwera i mod loader, pobiera mody i dodaje serwer do ich listy gier wieloosobowych z wybranym adresem.

Plik jest tworzony z modów, które sam dodałeś do serwera (nakładka niestandardowych modów), pochodzących z Modrinth. Mody z innych źródeł są zamiast tego wymienione na karcie, dzięki czemu znajomi mogą ręcznie dodać te pliki do swojego folderu `mods`. Na serwerze utworzonym z zestawu modów, znajomi powinni zainstalować ten zestaw, w wersji, na której działa serwer, w swoim launcherze; karta **Przegląd** pokazuje wersję.

### Granie przez internet

**Granie przez internet (przekierowanie portów)** na dole karty wyjaśnia stronę routera: przekieruj port gry serwera (TCP i UDP) do maszyny, na której działa panel, a następnie udostępnij swój publiczny adres z portem. Jeśli Twój dostawca internetu używa CGNAT, przekierowanie portów nie zadziała, a usługa tunelowania (na przykład playit.gg) jest rozwiązaniem. Panel sam nie otwiera portów routera. Tylko porty gry powinny być dostępne w internecie; zachowaj zamknięte własny port panelu i porty RCON ([porty w skrócie](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Strona statusu

**Ustawienia → Strona statusu** włącza publiczną stronę dla jednego serwera, domyślnie wyłączoną:

1. Włącz kartę.
2. Wybierz **Adres strony**: strona będzie dostępna pod adresem `/status/<adres>` na Twoim panelu, a adres składa się z 3 do 40 małych liter, cyfr lub myślników, unikalnych dla Twoich serwerów.
3. Naciśnij **Zapisz**. **Otwórz stronę** i **Kopiuj link** następnie podadzą Ci link do udostępnienia.

Każdy, kto ma link, widzi nazwę serwera, jego MOTD, wersję, czy jest uruchomiony, liczbę graczy i czas pracy, i nic więcej. Strona nie zawiera linku do panelu i nie wymaga logowania. Odczytuje status serwera w pamięci panelu, dzięki czemu odwiedzający nigdy nie obciążają demona Docker.

Wyłączenie strony zachowuje jej adres, więc ponowne jej włączenie przywraca ten sam link. Dla własnej strony lub bota, [publiczne API](/docs/public-api/) zwraca ten sam rodzaj statusu w formacie JSON.

Powiązane: [Powiadomienia Discord](/docs/integrations/), [mapa na żywo](/docs/live-map/), [tworzenie i zarządzanie serwerami](/docs/servers/).
