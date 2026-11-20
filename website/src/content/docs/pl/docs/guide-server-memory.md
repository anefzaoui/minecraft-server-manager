---
title: 'Ile RAM potrzebuje serwer Minecraft?'
description: 'Ile RAM potrzebuje serwer Minecraft dla wersji vanilla, Paper, z lekkimi modami i dużymi modpackami, oraz ile zostawić dla maszyny.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Krótka odpowiedź, dla serwera, na którym faktycznie będzie się grać:

| Co uruchamiasz                                     | Stos Java (heap) | Przydziel maszynie |
| -------------------------------------------------- | ---------------- | ------------------ |
| Vanilla lub Paper, do 10 graczy                    | 2 GB             | 4 GB               |
| Paper z pluginami, 10 do 30 graczy                 | 4 GB             | 6 GB               |
| Lekki pakiet modów, 40 do 80 modów                 | 4 GB             | 6 GB               |
| Duży pakiet "wszystko co się da", 150 do 300 modów | 6 do 8 GB        | 10 GB              |
| GregTech New Horizons i podobne potwory            | 8 do 12 GB       | 16 GB              |

Dwie liczby, nie jedna. Tego właśnie brakuje w większości poradników i dlatego ludzie kupują serwer 4 GB, przydzielają Javie 4 GB, a potem patrzą, jak on pada.

## Stos (heap) i maszyna to różne liczby

Stos Javy (`-Xmx`) to ilość pamięci, którą sama gra może wykorzystać na świat, encje i dane modów. Maszyna, czyli kontener, musi pomieścić ten stos **oraz** wszystko inne, czego potrzebuje Java: metadane klas, stosy wątków, księgowość garbage collectora, bufory sieciowe i samą maszynę wirtualną JVM. Ten narzut wynosi około 0,5 do 1,5 GB dla serwera z modami.

Jeśli stos jest równy pamięci maszyny, jądro systemu zabija serwer w momencie, gdy Java sięga po ten narzut. W Dockerze pojawia się to jako kod wyjścia 137, a w logach nic – proces po prostu znika w połowie zdania. Ludzie zwykle obwiniają moda.

Bezpieczna zasada: **stos plus 25 procent, i co najmniej jeden gigabajt zapasu.** Stos 8 GB wymaga maszyny 10 GB.

## Więcej RAM-u to nie więcej wydajności

Minecraft jest w większości operacji ograniczony przez pojedynczy wątek. Przydzielenie pakietowi 40 modów 16 GB nie sprawi, że fragmenty świata będą generować się szybciej; sprawi, że każda pauza garbage collectora będzie dłuższa, ponieważ jest więcej do przeszukania. Serwer, który zacina się co trzydzieści sekund, często ma za duży stos, a nie za mały.

Zwiększ stos, gdy zobaczysz te objawy, i nie inaczej:

- `java.lang.OutOfMemoryError: Java heap space` w logach.
- Powtarzające się komunikaty "Can't keep up! Is the server overloaded?" z pauzami garbage collectora w statystykach.
- Użycie pamięci, które rośnie do sufitu i pozostaje tam zablokowane przez godziny.

## Dlaczego twój serwer pokazuje 12 GB użycia, gdy nikt nie jest online

Bo tak mu kazałeś. Dwa domyślne ustawienia działają razem:

1. Popularny obraz Docker ustawia początkowy stos równy maksymalnemu, więc `-Xms` i `-Xmx` to obie twoje liczby. Java rezerwuje je od razu, zamiast stopniowo je zwiększać.
2. Popularny zestaw flag Aikar zawiera `-XX:+AlwaysPreTouch`, który przeszukuje każdą stronę tego stosu podczas uruchamiania, aby strony zostały faktycznie zaalokowane. Jest to celowe: zamienia wolniejsze uruchamianie i duży wskaźnik bezczynności na mniej pauz później.

Zmierzono na Paper 1.21.1 ze stosem 2 GB w kontenerze 4 GB, próbkowano przez trzy minuty po zakończeniu ładowania świata:

| Konfiguracja                            | Pamięć rezydentna |
| --------------------------------------- | ----------------- |
| Brak flag                               | 2.60 GiB          |
| Flagi Aikar                             | 2.59 GiB          |
| Flagi Aikar bez `AlwaysPreTouch`        | 1.95 GiB          |
| Flagi Aikar z początkowym stosem 512 MB | 1.38 GiB          |
| Brak flag z początkowym stosem 512 MB   | 1.25 GiB          |

Więc serwer "używający" 12 GB w stanie bezczynności to zazwyczaj stos 12 GB, który został wstępnie dotknięty, a nie wyciek pamięci. Twoje monitorowanie odczytuje to poprawnie; liczba po prostu nie oznacza tego, co wygląda.

Jeśli chcesz uczciwego wskaźnika bezczynności, ustaw początkowy stos niższy niż maksymalny. Płacisz za to kilkoma dodatkowymi kolekcjami na początku. Jeśli wolisz stałe czasy klatek, zostaw to i przestań obserwować wykres.

## Gracze mają mniejsze znaczenie, niż myślisz

Podwojenie liczby graczy z 10 do 20 kosztuje znacznie mniej niż dodanie pięćdziesięciu modów. Gracze głównie dodają encje i załadowane fragmenty, które skalują się łagodnie. Mody dodają dane klas, rejestry, funkcje generowania świata i własne pamięci podręczne, które tego nie robią. Najpierw dostosuj rozmiar do paczki, a następnie dodaj około 100 do 200 MB na zwykłego gracza na serwerze z modami.

Zasięg widzenia to kolejna ważna dźwignia. Zmniejszenie z 12 do 8 fragmentów może zaoszczędzić gigabajt na ruchliwym serwerze i jest ledwo zauważalne w grze.

## W Minecraft Server Manager

Każdy serwer ma dwa oddzielne pola: **Stos Javy** i **Limit pamięci kontenera**, właśnie dlatego, że są to różne kwestie. Kreator tworzenia ustawia limit kontenera o 50 procent powyżej stosu, a panel odmawia zapisania serwera, którego limit kontenera nie jest wyższy niż jego stos, ponieważ taka kombinacja kończy się kodem wyjścia 137 zamiast komunikatem o błędzie.

Miernik pamięci na serwerze pokazuje, co kontener faktycznie wykorzystuje, z uwagą, gdy stos został zaalokowany z góry, dzięki czemu wstępnie dotknięty stos nie jest odczytywany jako wymykający się spod kontroli. Serwer, który jądro systemu zabiło z powodu braku pamięci, jest zapisywany dokładnie w ten sposób w historii, a nie jako tajemniczy błąd.

Powiązane: [tworzenie i zarządzanie serwerami](/docs/servers/),
[raporty z błędów](/docs/servers/#crash-reports--mclogs-analysis), [przestrzeń dyskowa i limity](/docs/storage/).
