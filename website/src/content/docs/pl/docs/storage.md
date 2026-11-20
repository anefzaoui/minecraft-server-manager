---
title: 'Przechowywanie'
description: 'Zobacz, na co schodzi miejsce na dysku, narzuć limit miejsca na każdy folder serwera za pomocą limitu dyskowego i usuń to, czego już nie potrzebujesz.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Pamięć masowa** pokazuje, gdzie wykorzystywane jest Twoje miejsce na dysku: użycie według kategorii, każdy serwer w stosunku do swojego limitu, największe pliki i jak całkowite użycie zmienia się w ostatnich skanach. Jest przeznaczona tylko dla administratorów.

![Pamięć masowa](/docs/images/storage.png)

## Limity dyskowe są egzekwowane przez panel

Docker nie może ograniczyć użycia dysku przez bind mount, więc robi to panel. Domyślny indeksator rozmiaru skanuje folder danych (co 15 minut, po zmianach lub gdy naciśniesz **Skanuj ponownie teraz**), buforuje rozmiar każdego serwera i egzekwuje limit dysku ustawiony dla każdego serwera. Akcja, która spowodowałaby przekroczenie limitu przez folder serwera (świat, mody, konfiguracje, logi i wszystko inne w nim), taka jak instalacja moda, świata lub przesyłanie plików, jest blokowana do momentu zwolnienia miejsca lub podniesienia limitu, zamiast pozwalać jednemu serwerowi na zapełnienie Twojego hosta.

Ustaw limit serwera w jego [ustawieniach](/docs/servers/#server-settings). Włączenie opcji **Zatrzymaj serwer po przekroczeniu limitu** tam również zatrzymuje działający serwer, gdy jego folder przekroczy limit o ponad 10% i odnotowuje to w historii serwera. Serwery z modami mogą być duże, więc daj im trochę miejsca. [Kopie zapasowe](/docs/backups/) są przechowywane oddzielnie i nie wliczają się do limitu.

## Czyszczenie

Karta **Czyszczenie jednym kliknięciem** zwalnia miejsce, które panel może bezpiecznie odzyskać: pliki tymczasowe starsze niż godzina, osierocone pliki bibliotek oraz archiwalne logi i raporty awarii starsze niż 30 dni. Każda z nich pokazuje, ile miejsca zwalnia i otwiera podgląd przed usunięciem czegokolwiek. Listy **Według kategorii** i **Największe pliki** prowadzą bezpośrednio do menedżera plików, dzięki czemu możesz znaleźć, co jeszcze usunąć, zanim zabraknie Ci miejsca.
