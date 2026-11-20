---
title: 'Integrációk'
description: 'Minden szerver integrációi a Beállítások csoport alatt találhatók: Discord, nyilvános Állapotoldal, egérkattintásos Meghívók és az opcionális Chatbot fül (csak adminoknak).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Minden szerver integrációit a **Beállítások** csoportban találja: **Discord**, nyilvános **Állapotoldal**, egykattintásos **Meghívók** és az opcionális **Chatbot** lap (csak rendszergazdáknak). Ez az oldal a Discordot tárgyalja; a [meghívók és az állapotoldal](/docs/invites-and-status-page/) a másik kettőt fedi le, a [chatbotnak](/docs/chatbot/) pedig saját oldala van.

## Discord értesítések

A panel egy webhookon keresztül továbbítja a szerver eseményeit egy Discord csatornára. Nincs bot, nincs OAuth.

### Beállítás

1. Discordon: **Szerverbeállítások → Integrációk → Webhookok → Új Webhook**. Válassza ki a csatornát, és másolja ki a webhook URL-t.
2. A panelen nyissa meg a szerver **Beállítások → Discord** lapját, illessze be az URL-t a **Webhook URL** mezőbe, kapcsolja **be** a kártyát, és kattintson a **Mentés** gombra. Az URL titkosítva tárolódik (ugyanabban a tárolóban, mint az API kulcsai).
3. Használja a **Teszt küldése** gombot a működés megerősítéséhez.

![Discord integráció](/docs/images/integrations-discord.png)

Egy tárolt URL lecseréléséhez illesszen be egy újat, és mentse el; hagyja üresen a mezőt az aktuális megtartásához. A tárolt URL maszkolva jelenik meg (a token el van rejtve).

### Mi kerül elküldésre

Az értesítések kapcsolható kategóriákba vannak csoportosítva. Mindegyik alapértelmezetten be van kapcsolva.

| Kategória               | Események                                                               |
| ----------------------- | ----------------------------------------------------------------------- |
| **Indítás / leállítás** | Szerver elindult, szerver leállt                                        |
| **Összeomlások**        | Összeomlás, összeomlási hurok észlelve, új összeomlási jelentés         |
| **Biztonsági mentések** | Biztonsági mentés létrehozva, biztonsági mentés visszaállítva           |
| **Frissítések**         | Frissítés alkalmazva, frissítés visszavonva, frissítés sikertelen       |
| **Kirúgások / Bánások** | Játékos kirúgva, játékos kitiltva                                       |
| **Riasztások**          | Azok a dolgok, amelyek csendben tönkretesznek egy szervert (lásd alább) |

### Az Riasztások kategória

Az `Riasztások` a "valami emberi beavatkozást igényel" csatorna, olyan feltételekhez, amelyek korábban csak a panelen voltak láthatóak:

| Esemény                 | Jelentés                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `oom`                   | A konténer leállt, mert elfogyott a memória.                                                                  |
| `unhealthy`             | A folyamat fut, de az `mc-health` ellenőrzés sikertelen: egy élő, de halott szerver.                          |
| `startup-stalled`       | Körülbelül 10 perc után is indul, de nincs "Kész" a naplókban (diagnózissal, hogy mi a probléma, ha ismert).  |
| `stop-failed`           | A zökkenőmentes leállítás nem történt meg, és a konténer még fut.                                             |
| `schedule-failed`       | Egy ütemezett újraindítás / biztonsági mentés / parancs sikertelen volt.                                      |
| `quota-exceeded`        | Szigorú módban a lemezkvóta túllépve, és a szerver leállt.                                                    |
| `offline-after-restart` | A szerver futott a panel újraindítása előtt, most nem fut, és nem lesz automatikusan elindítva.               |
| `port-change-failed`    | Egy portváltoztatás sikertelen volt, és a szervert nem lehetett visszahelyezni a régi portjára, ezért leállt. |
| `auto-restart-gave-up`  | Egy összeomlott szervert nem indított újra a rendszer, mert egy másik művelet túl sokáig tartotta elfoglalva. |

### Hogyan működik a kézbesítés

Egy háttér híd 15 másodpercenként lekérdezi a [tevékenységi naplót](/docs/activity/), és továbbítja a hozzárendelt sorokat. Ha egy webhook POST átmenetileg sikertelen, az a sor a későbbi lekérdezések során újra megpróbálásra kerül, ahelyett, hogy elveszne; néhány sikertelen kísérlet után a sort kihagyja, és a kézbesítési hibákat legfeljebb óránként egyszer naplózza szerverenként. Panel újraindítása után a híd elküldi azokat az eseményeket, amelyeket még nem kézbesített, de soha nem régebbről, mint két óra; az első futásakor a legújabb eseménnyel kezd.
