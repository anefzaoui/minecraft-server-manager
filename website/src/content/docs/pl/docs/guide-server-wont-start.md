---
title: 'Twój serwer Minecraft się nie uruchamia'
description: 'Serwer Minecraft, który się nie uruchamia, naprawiony w kolejności prawdopodobieństwa: logi, wersja Java, pamięć, EULA i port oraz mody.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Pracuj w dół tej listy. Jest ona uporządkowana według częstotliwości występowania danego problemu, a pierwsze cztery punkty obejmują większość z nich.

## 1. Przeczytaj ostatnie dwadzieścia linii, nie pierwsze

Przewiń do **końca** logu. Ślad stosu Java jest drukowany od środka na zewnątrz, więc góra tekstu jest najmniej interesującą częścią. To, czego potrzebujesz, to ostatnia linia `Caused by:` i wszystko, co po niej następuje. Ta pojedyncza linia zazwyczaj wskazuje problem.

Dwa kształty informują Cię, gdzie jesteś:

- `Exception in thread "main"` lub ścieżka do raportu o błędzie blisko końca oznacza, że sam proces gry zawiódł.
- Log po prostu się zatrzymuje w połowie linii, bez żadnego wyjątku, co oznacza, że coś zabiło proces z zewnątrz. Przejdź do punktu 3.

## 2. UnsupportedClassVersionError oznacza niewłaściwą Javę

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Plik klasy 52 to Java 8, 60 to 16, 61 to 17, 65 to 21, 69 to 25. Komunikat oznacza, że serwer potrzebuje nowszej Javy niż ta, na której działa; odwrotnie, stary pakiet na nowej Javie zazwyczaj kończy się błędem mieszania (mixin) lub błędem odbicia (reflection).

| Wersja Minecraft | Java |
| ---------------- | ---- |
| 1.16.5 i starsze | 8    |
| 1.17             | 16   |
| 1.18 i 1.19      | 17   |
| 1.20 do 1.20.4   | 17   |
| 1.20.5 do 1.21.x | 21   |
| 26.1 i nowsze    | 25   |

Stare pakiety autentycznie potrzebują Javy 8. Nowsza nie jest tutaj lepsza.

## 3. Kod wyjścia 137 to jądro, nie mod

Log zatrzymuje się w połowie zdania, nie ma raportu o błędzie, a kontener zgłasza 137. To zabicie z powodu braku pamięci: proces zażądał pamięci, której maszyna nie miała, więc został zakończony.

Prawie zawsze sterta Javy (heap) była ustawiona na tę samą liczbę, co pamięć maszyny. Sterta potrzebuje pamięci maszyny **minus** własny narzut JVM, który wynosi od 0,5 do 1,5 GB na serwerze z modami. Zmniejsz stertę lub zwiększ pamięć maszyny. [Ile RAM-u potrzebuje serwer](/docs/guide-server-memory/) zawiera liczby.

## 4. EULA i port

Dwa klasyki z jednozdaniowymi poprawkami:

- `You need to agree to the EULA in order to run the server.` Ustaw `eula=true` w `eula.txt` lub za pomocą zmiennej środowiskowej, której używa Twój system.
- `Address already in use` lub `FAILED TO BIND TO PORT`. Coś innego zajmuje port 25565, często poprzednia kopia tego samego serwera, która nigdy w pełni się nie zatrzymała. Znajdź ją i zatrzymaj, zamiast zmieniać port, bo inaczej będziesz mieć dwa.

## 5. Brakuje zależności moda

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Mody Fabric w przeważającej większości potrzebują Fabric API jako osobnego pliku. Mody Forge i NeoForge wymieniają swoje zależności w samym błędzie. Zainstaluj nazwaną wersję, nie najnowszą: "wymaga 0.91.x" oznacza tę linię, a 0.92 zakończy się tym samym sprawdzeniem.

Czasami brakującą zależnością jest sam loader:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Poprawką jest nowsza wersja loadera, nie inny mod. "47.4.14 lub powyżej" oznacza dowolną wersję od tej liczby w górę, a Forge nie publikuje każdego numeru, więc wersją do zainstalowania może być następna. W przypadku modpacka najpierw zaktualizuj pakiet: pakiet, którego własna wersja loadera jest za stara dla jego modów, jest błędem dla jego autora.

## 6. Mod jest dla niewłaściwego loadera lub wersji

Plik JAR dla innego loadera nie kończy się grzecznie. Spodziewaj się błędu mieszania (mixin), `NoClassDefFoundError` lub awarii w klasie, o której nigdy nie słyszałeś. Sprawdź stronę pliku JAR: zarówno loader, jak i wersja Minecraft muszą się dokładnie zgadzać. 1.20.1 i 1.20.4 to dla modów różne gry.

## 7. Świat pochodzi z nowszej wersji

```
This world was created by a newer version of Minecraft
```

Światy aktualizują się do przodu i nigdy do tyłu. Przywróć kopię zapasową sprzed aktualizacji lub uruchom wersję, której oczekuje świat. Nie ma ścieżki powrotnej, która zachowałaby fragmenty świata (chunki) w nienaruszonym stanie.

## Kiedy awaria nastąpiła po tygodniach działania

Inne pytanie, zazwyczaj inna odpowiedź:

- **Awaria nastąpiła pod obciążeniem**, z pomiarami czasu pokazującymi długie pauzy: zbieranie śmieci (garbage collection), więc spójrz na rozmiar sterty przed modami.
- **Awaria nastąpiła w tym samym punkcie świata**: uszkodzony fragment świata (chunk) lub zepsuta encja. Raport o błędzie zazwyczaj podaje współrzędne.
- **Awaria nastąpiła tuż po aktualizacji**: podejrzanym jest zaktualizowany mod, nawet jeśli ślad wskazuje gdzie indziej. Wycofaj go i sprawdź.
- **Awaria nastąpiła przy ponownym uruchomieniu, po wcześniejszym działaniu**: sprawdź dysk. Pełny dysk powoduje spektakularne i mylące błędy.

## Uzyskanie pomocy, która faktycznie pomaga

Opublikuj **cały log**, nie ostatnią linię, i powiedz, co zmieniłeś, zanim się zepsuło. Wklej go gdzieś przeznaczonym do tego celu, na przykład na [mclo.gs](https://mclo.gs), zamiast na czacie. Podaj wersję Minecraft, loader, pakiet i jego wersję oraz ile pamięci sterty ma serwer. Zgłoszenie z tymi czterema faktami zostanie rozpatrzone w jednej odpowiedzi; bez nich zajmie to pięć.

## W Minecraft Server Manager

Awaria jest wykrywana na podstawie wyjścia samego kontenera, więc serwer, który umiera o trzeciej nad ranem, jest rejestrowany z fragmentem logu, zamiast być znajdowany następnego dnia. Typowe podejrzenia na tej stronie (EULA, niewłaściwa Java, świat z nowszej wersji, zajęty port, brak pamięci Javy) są rozpoznawane w tym logu i nazwane w wpisie historii z informacją, co z nimi zrobić, a automatyczne ponowne uruchamianie ich nie dotyczy, ponieważ ponowne uruchomienie ich nie naprawi. Raporty o błędach są analizowane po otrzymaniu: wyjątek jest podświetlony, stos jest zwijalny, a mody pojawiające się w śladzie są wymienione jako podejrzane.

Każdy raport można udostępnić na mclo.gs z jego karty, gdy potrzebujesz pomocy (po potwierdzeniu, ponieważ wklejka jest publiczna), a menu **Pobierz** konsoli zawiera wszystkie pliki logów jako jeden plik zip, więc "opublikuj cały log" to pobranie, a nie projekt archeologiczny. Zabicie z powodu braku pamięci jest rejestrowane jako zabicie z powodu braku pamięci, co oszczędza zwykłą godzinę obwiniania moda. Jeśli coś innego faktycznie potrzebuje portu, karta **Port gry** w **Ustawienia → Konfiguracja** przenosi serwer na wolny port.

Loader, który jest za stary, jest zmieniany z zakładki **Wersje** serwera, która sprawdza, czy wersja istnieje i wykonuje kopię zapasową przed przebudową serwera ([zmiana wersji loadera modów](/docs/updates/#changing-the-mod-loader-version)).

Powiązane: [ile RAM-u potrzebuje serwer](/docs/guide-server-memory/), [wybór loadera](/docs/guide-choosing-a-loader/), [tworzenie i zarządzanie serwerami](/docs/servers/).
