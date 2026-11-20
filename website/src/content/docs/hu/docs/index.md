---
title: 'Dokumentáció'
description: 'Egy teljes körű, önállóan hosztolt vezérlőpanel az itzg/docker-minecraft-server számára.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Egy teljes, önállóan hosztolt vezérlőpanel a [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) számára. Hozzon létre, futtasson és kezeljen Minecraft szervereket a böngészőjéből. Nincs szükség parancssorra, nincs kézi YAML szerkesztés.

![Dashboard](/docs/images/dashboard.png)

## Kezdje itt

- **[Elkezdeni](/docs/getting-started/)** - első indítási beállítások, bejelentkezés és tájékozódás.
- **[A vezérlőpult](/docs/dashboard/)** - minden szerver, játékos és tevékenység áttekintése.

## Futó szerverek

- **[Szerverek létrehozása és kezelése](/docs/servers/)** - a létrehozási varázsló, szervertípusok, verziók és szerverenkénti beállítások.
- **[Konzol és csevegési parancsok](/docs/console-and-chat/)** - az élő konzol és az egyéni játékon belüli csevegési parancsok, amelyek játékosként futnak.
- **[Modpackok](/docs/modpacks/)** - telepítse a CurseForge, Modrinth, FTB és GT New Horizons csomagokat, mindig egy pontos verzióhoz rögzítve.
- **[Világok és fájlok](/docs/worlds-and-files/)** - világok cseréje, modok kezelése és fájlok szerkesztése közvetlenül a böngészőben.
- **[Világ zsugorítása](/docs/world-shrink/)** - lemezterület felszabadítása azáltal, hogy eltávolítja azokat a chunkokat, amelyeket senki sem látogat, önállóan vagy biztonsági mentés részeként.
- **[Élő térkép](/docs/live-map/)** - egy kattintással elérhető 3D BlueMap térkép a világról, a panel bejelentkezése mögött.
- **[Meghívók és állapotoldal](/docs/invites-and-status-page/)** - a cím, a meghívószöveg és az ügyfél modpack a barátoknak, valamint egy nyilvános állapotoldal.

## Adatok és automatizálás

- **[Szerverenkénti chatbot](/docs/chatbot/)** - helyi/OpenAI-kompatibilis beszélgetés, kimenő kommunikáció, megőrzött átiratok és korlátozott játékképességek.
- **[Biztonsági mentések](/docs/backups/)** - egy kattintásos pillanatképek, ütemezett biztonsági mentések, hányat kell megtartani (panel-szintű vagy szerverenkénti), és visszaállítás.
- **[Blueprintok](/docs/blueprints/)** - rögzítse a szerver teljes konfigurációját, és hozzon létre újakat arról.
- **[Ütemezések](/docs/schedules/)** - cron-vezérelt újraindítások, biztonsági mentések és parancsok.
- **[Tárhely](/docs/storage/)** - szerverenkénti lemezhasználat és panel által érvényesített kvóták.
- **[Frissítések](/docs/updates/)** - új szerver, csomag, kép és mod verziók követése, annak ellenőrzése, hogy mely Minecraft verziókat támogatják a modjai, és egy mod frissítésének visszavonása.
- **[Tevékenységnapló](/docs/activity/)** - minden történés audit naplója.
- **[Integrációk](/docs/integrations/)** - Discord webhook értesítések és az Értesítések kategória.
- **[Nyilvános API](/docs/public-api/)** - egy csak olvasható, token-hitelesítésű HTTP API a szerver állapotának lekérdezéséhez a panelen kívülről.

## Fiókok és biztonság

- **[Felhasználók és szerepkörök](/docs/users-and-roles/)** - rendszergazda, operátor és néző, mit tehetnek, és szerverenkénti engedélyek, amelyek finomítják őket.
- **[Kétfaktoros hitelesítés](/docs/two-factor-authentication/)** - védje bejelentkezését egy hitelesítő alkalmazással.

## Útmutatók

Nem specifikus erre a panelre: a kérdések, amelyekkel minden Minecraft szerver tulajdonos szembesül.

- **[Mennyi RAM-ra van szüksége egy szervernek?](/docs/guide-server-memory/)** - a két beállítandó szám, és miért olvas egy tétlen szerver 12 GB-ot.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - melyiket futtassa, és a választás mögötti plugin/mod különbség.
- **[A szervere nem indul el](/docs/guide-server-wont-start/)** - a napló olvasása, és a legtöbb hiba mögött álló néhány ok.
- **[Biztonsági mentések, amelyek valóban visszaállíthatók](/docs/guide-backups/)** - konzisztens másolatok, mit kell még megőrizni, és egy tesztelése, mielőtt szüksége lenne rá.
- **[Szerver áthelyezése másik hosztra](/docs/guide-moving-a-server/)** - a sorrend, amely röviden tartja az állásidőt és az ép leltárakat.

## A motorháztető alatt

- **[Architektúra](/docs/architecture/)** - hogyan épül fel a panel.
- **[A weboldal](/docs/website/)** - hogyan készül, fordítják és telepítik a minecraft-server-manager.com webhelyet ebből a repóból.

---

> Az útmutatókban található képernyőképek a panel sötét témájában készültek. A panel sötéten indul, hacsak az operációs rendszere nem részesíti előnyben a világosat; használja a témaváltót a felső sávban a váltáshoz.
