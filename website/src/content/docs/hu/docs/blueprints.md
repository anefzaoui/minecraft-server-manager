---
title: 'Sablonok'
description: 'Egy sablon rögzíti egy szerver teljes konfigurációját (típus, verzió, erőforrások, környezet, csomag rögzítése, és opcionálisan a konfigurációja és a világa) egyetlen po'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **blueprint** egy szerver teljes konfigurációját (típus, verzió, erőforrások, környezet, pack pin, és opcionálisan a konfigurációját és a világát) egyetlen hordozható fájlba rögzíti, amelyből új szervereket hozhat létre.

![Blueprints](/docs/images/blueprints.png)

## Exportálás

Egy szerverről exportáljon egy blueprintet, és válassza ki, mit tartalmazzon: mindig a konfigurációt, és opcionálisan beágyazott fájlokat és a világot. Az eredmény elmentődik a blueprint könyvtárába, és letölthető megosztásra.

## Importálás és létrehozás blueprintből

Importáljon egy blueprint fájlt (vagy válasszon egyet a könyvtárból) egy új szerver létrehozásához, amely pontosan úgy van előre konfigurálva, mint az eredeti. Ez a leggyorsabb módja annak, hogy:

- Identikus szervereket indítson (minijáték szerverek hálózata, éles szerverek színpadi másolatai).
- Szervert mozgasson panelek között.
- Tartson egy ismert, jó sablont, amelyre mindig visszaeshet.

Mivel egy blueprint rögzíti a pontos [pack pint](/docs/modpacks/) , egy blueprintből újra létrehozott modpack szerver ugyanazt a rögzített verziót telepíti, meglepetésszerű frissítések nélkül.
