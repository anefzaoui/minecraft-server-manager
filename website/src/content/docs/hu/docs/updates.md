---
title: 'Frissítések'
description: 'A Frissítések oldal egy helyen követi nyomon, hogy mi avult el a flottájában:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Frissítések** oldal egy helyen követi nyomon, hogy mi az elavult a flottádban:

- **Modpack** verziók ([modpackok](/docs/modpacks/)) a Modrinth / CurseForge / GTNH kiadási indexével szemben.
- Az általad hozzáadott **egyéni tartalom** – modok, datapackok, erőforráscsomagok, pluginok – mindegyike a forrásával szemben: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) vagy GitHub Releases. A GitHub lekérdezések ETag érvényesítést használnak, így a napi ellenőrzések alig érintik a sebességkorlátot.
- **Docker kép** elavultsága: az egyes futó konténer képazonosítója egy frissen lehúzott címkével szemben (a szerverek között címkénként deduplikálva), amely csak újraalkotásos frissítésként érhető el.
- **Önálló verzió rögzítések**: egy felügyelt csomag nélküli szerver esetében egy explicit `mc_version` rögzítés a Mojang manifestumával szemben, és egy explicit betöltő-build környezeti változó (`PAPER_BUILD`, `FORGE_VERSION` és hasonló) a betöltő regisztrálásával szemben. A Paper build-ek a PaperMC jelenlegi **Fill v3 API**-jából származnak (a régi v2 végpont már nem kap új Minecraft verziókat).

![Frissítések](/docs/images/updates.png)

## Hogyan működik

A panel összehasonlítja az egyes szerverek rögzített verzióit a forrásrendszerrel, és kilistázza az újabb kiadással rendelkező elemeket. A számláló a [vezérlőpult](/docs/dashboard/)"Elérhető frissítések" csempéjén is megjelenik.

Az ellenőrzések igény szerint futnak, és ütemezhetők ([Ütemezések](/docs/schedules/)). A frissítési **szabályzat** szerverenként értelmezendő: te döntöd el, hogy a panel csak értesítést küldjön, vagy minden manuális maradjon.

## Frissítés alkalmazása

A frissítések soha nem néma csendben történnek. Amikor úgy döntesz, hogy frissítesz egy csomagot, a panel:

1. Készít egy **frissítés előtti biztonsági mentést** (így visszafordítható; szerverenként az utolsó 10 frissítés előtti biztonsági mentés megmarad).
2. Rögzíti az új verzió pontos azonosítóját.
3. Újraalkotja a konténert, szükség esetén újra feloldva a Java futtatókörnyezetet.
4. Figyeli az első indítást, platformonkénti időkerettel.

Ha nem indul el egészségesen, visszaállítod a frissítés előtti biztonsági mentésre. Egy stabil verziót követő szerver soha nem kap béta verziót, és a változásnapló linkje a valódi, verzióspecifikus különbségre mutat, ahol a forrás biztosítja azt. Egy sikertelen frissítés Discord [riasztást](/docs/integrations/) is küld, ha az integráció konfigurálva van.
