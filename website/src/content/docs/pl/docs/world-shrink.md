---
title: 'Zmniejszanie świata'
description: 'Zmniejsz świat Minecraft, usuwając rzadko odwiedzane fragmenty, aby odzyskać miejsce na dysku i przyspieszyć tworzenie kopii zapasowych.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Wróć do spisu dokumentacji](/docs/)

Z czasem świat się rozrasta: każde miejsce, w którym gracz kiedykolwiek chodził, latał lub został przeniesiony przez Ender Pearl, pozostawia wygenerowane fragmenty (chunki) na dysku, nawet jeśli nikt nigdy tam nie wrócił. **Zmniejsz świat** usuwa fragmenty, w których prawie nikt nie spędził czasu, dzięki czemu świat zajmuje mniej miejsca. Minecraft odbuduje usunięty obszar z ziarna świata w momencie, gdy ktoś ponownie się tam uda, więc jest to bezpieczne dla ziemi, której nikt nie używa. Jednak wszystko, co gracz _zbudował_ w miejscu, w którym ledwo stał, również by zniknęło, dlatego najpierw należy wykonać kopię zapasową (kopia zapasowa to cofnięcie zmian).

## Co się liczy jako "rzadko odwiedzane"

Każdy fragment (chunk) zapisuje, ile czasu gracze w nim spędzili (Minecraft nazywa to `InhabitedTime`). Zmniejsz świat domyślnie usuwa każdy fragment z łącznym czasem gracza poniżej **30 sekund**; okno dialogowe zmniejszania pozwala zmienić ten próg (od 1 sekundy do 1 godziny) oraz liczbę fragmentów wokół punktu odrodzenia do zachowania (domyślnie 8, `0` wyłącza ochronę punktu odrodzenia).

Co jest zawsze zachowywane:

- Obszar wokół **punktu odrodzenia** świata (odczytany z `level.dat`) w świecie głównym (overworld). Nether, End i niestandardowe wymiary nie mają obszaru odrodzenia.
- Dowolny fragment, którego czas odwiedzin nie mógł zostać odczytany, na przykład świat zapisany z formatem kompresji, którego panel nie dekoduje (LZ4). Podgląd i wynik informują, ile takich fragmentów zostało pominiętych.

Przetwarzane są wszystkie wymiary świata: podfoldery w stylu Bukkit (`world_nether`, `world_the_end`), a także układ vanilla i Forge/Fabric (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Gdy fragment jest usuwany, jego byty (entities) i punkty zainteresowania wieśniaków również znikają, dzięki czemu odtworzony fragment nie dziedziczy przestarzałych mobów, wagoników ani miejsc pracy.

## Robienie tego z poziomu zakładki Światy

1. Wykonaj kopię zapasową z zakładki **Kopie zapasowe**. Zmniejszanie z poziomu zakładki Światy nie wykonuje jej za Ciebie.
2. Otwórz **Świat → Światy**, znajdź świat i kliknij ikonę zmniejszania.
3. Kliknij **Podgląd**, aby zobaczyć, ile fragmentów (i ile megabajtów) zostałoby usuniętych. Nic nie jest jeszcze zmieniane; podgląd działa, gdy serwer jest uruchomiony.
4. Kliknij **Zmniejsz świat**. Zmniejszanie edytuje pliki świata bezpośrednio, więc serwer musi być zatrzymany: zatrzymaj go najpierw lub zaznacz opcję, aby go zatrzymać, zmniejszyć i ponownie uruchomić za jednym razem (serwer jest ponownie uruchamiany nawet w przypadku niepowodzenia zmniejszania). Postęp jest widoczny w zasobniku zadań.

![Zmniejsz świat](/docs/images/world-shrink.png)

## Robienie tego jako część kopii zapasowej

W zakładce **Kopie zapasowe** zaznacz opcję **"Zmniejsz świat po wszystkim"** przed kliknięciem **Kopiuj teraz**. Archiwum kopii zapasowej jest zapisywane najpierw (to archiwum jest Twoim cofnięciem zmian), a następnie świat jest zmniejszany, ale tylko jeśli serwer jest zatrzymany. Jeśli serwer jest uruchomiony, kopia zapasowa nadal działa, a zmniejszanie jest pomijane z odpowiednią informacją.

Kopie zapasowe zaplanowane mają tę samą opcję: w edytorze harmonogramu wybierz zadanie **Kopia zapasowa** i zaznacz **"Zmniejsz świat po każdej kopii zapasowej"**. Połącz je z harmonogramem **Zatrzymaj serwer** na kilka minut wcześniej, jeśli chcesz, aby działało bez nadzoru.
