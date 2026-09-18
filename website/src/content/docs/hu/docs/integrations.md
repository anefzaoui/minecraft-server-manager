---
title: 'Integrációk'
description: 'Minden szerver a Beállítások csoportban tartja az integrációit: Discord, nyilvános Állapotoldal, egykattintásos Meghívók és az opcionális Chatbot fül.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Minden szerver a **Beállítások** csoportban tárolja az integrációit: **Discord**, egy nyilvános **Állapotoldal**, egy kattintásos **Meghívók** és az opcionális **Chatbot** lap. Ez az oldal a Discordot tárgyalja (a többihez saját dokumentáció és beállítási segédletek tartoznak a panelen).

## Discord értesítések

A panel a szerver eseményeit webhookon keresztül továbbítja egy Discord csatornára. Nincs bot, nincs OAuth.

### Beállítás

1. Discordon: **Szerverbeállítások → Integrációk → Webhookok → Új Webhook**. Válassza ki a csatornát, és másolja ki a webhook URL-t.
2. A panelen nyissa meg a szerver **Beállítások → Discord** lapját, illessze be az URL-t a **Webhook URL** mezőbe, kapcsolja **be** a kártyát, és mentse el. Az URL titkosítva tárolódik (ugyanabban a tárolóban, mint az API kulcsai).
3. Használja a **Teszt küldése** gombot a működés megerősítéséhez.

![Discord integráció](/docs/images/integrations-discord.png)

Egy tárolt URL lecseréléséhez illesszen be egy újat, és mentse el; hagyja üresen a mezőt az aktuális megtartásához. A tárolt URL maszkolva jelenik meg (a token el van rejtve).

### Mi kerül elküldésre

Az értesítések kapcsolható kategóriákba vannak csoportosítva. Mindegyik alapértelmezetten be van kapcsolva.

| Kategória                | Események                                                               |
| ------------------------ | ----------------------------------------------------------------------- |
| **Indítás / leállítás**  | Szerver elindult, szerver leállt                                        |
| **Összeomlások**         | Összeomlás, összeomlási hurok észlelve, új összeomlási jelentés         |
| **Biztonsági mentések**  | Biztonsági mentés létrehozva, biztonsági mentés visszaállítva           |
| **Frissítések**          | Frissítés alkalmazva, frissítés visszavonva, frissítés sikertelen       |
| **Kirúgások / tiltások** | Játékos kirúgva, játékos tiltva                                         |
| **Figyelmeztetések**     | Azok a dolgok, amelyek csendben hagyják a szervert hibásan (lásd alább) |

### A Figyelmeztetések kategória

A `Figyelmeztetések` a "valami emberi beavatkozást igényel" csatorna, olyan feltételekhez, amelyek korábban csak a panelen voltak láthatók:

| Esemény                 | Jelentés                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | A konténer leállt memóriahiány miatt.                                                                                |
| `unhealthy`             | A folyamat fut, de az `mc-health` szonda hibát jelez: egy élő, de halott szerver.                                    |
| `startup-stalled`       | Körülbelül 10 perc után sem indul el, és nincs "Kész" a naplókban (diagnózissal, hogy mit kell javítani, ha ismert). |
| `stop-failed`           | A zökkenőmentes leállítás nem történt meg, és a konténer továbbra is fut.                                            |
| `schedule-failed`       | Egy ütemezett újraindítás / biztonsági mentés / parancs sikertelen volt.                                             |
| `quota-exceeded`        | Szigorú módban a lemezkvóta túllépve, és a szerver leállt.                                                           |
| `offline-after-restart` | A szerver futott a panel újraindítása előtt, most nem fut, és nem lesz automatikusan elindítva.                      |
| `crash-report`          | Új összeomlási jelentés került rögzítésre és feldolgozásra.                                                          |
| `update-failed`         | Egy őrzött frissítés nem jött fel egészségesen.                                                                      |

### Hogyan működik a kézbesítés

Egy háttér híd 15 másodpercenként lekérdezi a [tevékenységi naplót](/docs/activity/) és továbbítja a hozzárendelt sorokat. Ha egy webhook POST átmenetileg sikertelen, az adott sor a későbbi lekérdezések során újra megpróbálásra kerül, ahelyett, hogy elvetésre kerülne; egy tartósan elérhetetlen webhook néhány kísérlet után némítva lesz (óránként egy naplósor). A híd soha nem játszik le eseményeket a panel elindítása előtt.
