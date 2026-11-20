---
title: 'Ütemezések'
description: 'Az Ütemezések oldal automatizálja az ismétlődő feladatokat cron kifejezésekkel. Nincs külső cron, nincsenek szkriptek.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Ütemezések** oldal automatizálja az ismétlődő feladatokat cron kifejezésekkel. Nincs külső cron, nincsenek szkriptek.

![Ütemezések](/docs/images/schedules.png)

## Mit ütemezhetsz

- **Újraindítások**: egy éjszakai újraindítás a hosszú ideje futó szerver egészségének megőrzéséhez.
- **Leállítások és indítások**: éjszakára leállítani egy szervert, és reggel visszaállítani.
- **Biztonsági mentések**: rendszeres pillanatfelvételek (a [Biztonsági mentések](/docs/backups/) oldalon `scheduled` címkével). Egy biztonsági mentési ütemezés minden mentés után össze is zsugoríthatja a világot ([világ zsugorítása](/docs/world-shrink/)). Minden új szerver automatikusan kap egy napi biztonsági mentési ütemezést.
- **Parancsok**: bármilyen szerverparancs futtatása ütemezetten.
- **Frissítések ellenőrzése**: időszakosan frissíteni, mi az, ami elavult. Az ütemezett ellenőrzés az, ami alkalmazza a frissítéseket a [Automatikus frissítés](/docs/modpacks/#update-policy) beállítással rendelkező szerverekhez.

Minden ütemezés egy adott szervert céloz meg (vagy magát a panelt globálisan), saját cron kifejezéssel fut, és engedélyezhető vagy letiltható anélkül, hogy törölni kellene. A szerkesztő gépelés közben előnézetet ad a következő futási időkről, a cron idők a panel időzónáját követik (a **Beállítások**ban állítva), és a táblázat megmutatja az egyes ütemezések következő futását. Minden esemény rögzítésre kerül egy történeti eseményként, ahogy a sikertelen futás is.

A panel az első indításkor a saját karbantartási ütemezéseit is elindítja, amelyeket átütemezhetsz vagy kikapcsolhatsz: napi frissítés ellenőrzés, hat óránkénti tároló újraelemzés, napi régi ideiglenes fájlok törlése, 15 percenkénti ban érvényességi ellenőrzés (azoknak a feltételes bírálatoknak az eltávolítása, amelyek lejártak), és egy éjszakai tartalom metaadatok feltöltése (hiányzó mod nevek és ikonok kitöltése).

## Amikor a szerver foglalt

Egy ütemezett biztonsági mentés vagy indítás, amely a szerverét egy másik művelet közepén találja (visszaállítás, biztonsági mentés tisztítása, port változtatás), vár és minden percben újra próbálkozik, amíg a művelet befejeződik, legfeljebb 30 percig. Egy várakozó indítást elvetünk, ha valaki közben elindítja vagy leállítja a szervert. Egy ütemezett újraindítás vagy leállítás nem kerül újra próbálkozásra: kihagyásra kerül, és a következő időpontban fut újra.
