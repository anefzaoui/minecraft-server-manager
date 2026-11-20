---
title: 'Sablonok'
description: 'A sablonok megmentik egy Minecraft szerver teljes konfigurációját, mint új szerverek létrehozására alkalmas, újrafelhasználható receptet. Titkos kulcsok soha nem szerepelnek benne.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **blueprint** egy szerver teljes konfigurációját (típus, verzió, erőforrások, környezet, pack pin, egyéni modok, és opcionálisan a konfigurációja és a világa) egyetlen hordozható `.mcserver.zip` fájlba rögzíti, amelyből új szervereket hozhat létre. A titkos kulcsok (jelszavak, tokenek és kulcsok a környezetben) soha nem kerülnek bele a blueprintba.

![Blueprints](/docs/images/blueprints.png)

## Exportálás

Egy szerver **Beállítások → Konfiguráció** lapjáról használja az **Exportálás blueprintként** lehetőséget, és válassza ki, mit szeretne tartalmazni: mindig a szerver konfigurációját, a konfigurációs könyvtárait (alapértelmezetten bekapcsolva), és opcionálisan magukat az egyéni mod fájlokat (egy nagyobb fájl, amely letöltés nélkül telepít) és az aktív világot. Az eredmény mentésre kerül a blueprint könyvtárába, és letölthető megosztásra.

A **Szerver klónozása** ugyanazon a kártyán egy lépésben elvégez egy exportálást és egy importálást, hogy másolatot készítsen a szerverről, a világával vagy anélkül.

## Importálás és létrehozás blueprintból

Importáljon egy blueprint fájlt (az **Importálás blueprintként** a **Blueprintok** oldalon), vagy válasszon egyet a könyvtárból (a **Szerver létrehozása** a kártyáján, vagy az varázsló **Blueprintból** lapja), hogy egy új, az eredetihez pontosan előre konfigurált szervert hozzon létre. Az új szerver saját portokat és egy új RCON jelszót kap. Az egyéni modok, amelyek nem voltak beágyazva, újra letöltődnek, és összehasonlításra kerülnek a blueprint által rögzített kivonatokkal. A könyvtár két indító blueprinttal is rendelkezik, egy Paper és egy Fabric.

Ez a leggyorsabb módja annak, hogy:

- Azonos szervereket indítson (minijáték szerverek hálózata, éles környezet másolatai).
- Szervert mozgasson egyik panelről a másikra.
- Megtartson egy ismert, jó sablont, amelyre mindig visszaeshet.

Mivel a blueprint rögzíti a pontos [pack pint](/docs/modpacks/), egy blueprintból létrehozott modpack szerver ugyanazt a rögzített verziót telepíti, meglepetésszerű frissítések nélkül.
