---
title: 'Živá mapa'
description: 'Zapněte živou 3D mapu světa serveru pomocí BlueMap jedním kliknutím, která je dostupná pouze přes přihlášení do panelu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Zpět na index dokumentace](/docs/)

Karta serveru **Svět → Mapa** zobrazuje živou, zvětšitelnou 3D mapu jeho světa, vykreslenou pomocí [BlueMap](https://bluemap.bluecolored.de/) (zdarma a s otevřeným zdrojovým kódem), s pozicemi hráčů a všech dimenzí. Panel ji nainstaluje, nakonfiguruje a obsluhuje; nikdy pro ni nemusíte otevírat port ani upravovat konfigurační soubor.

## Zapnutí

1. Otevřete server a poté **Svět → Mapa**.
2. Stiskněte **Povolit živou mapu**. Panel nainstaluje sestavení BlueMap, které odpovídá loaderu serveru a verzi Minecraftu z Modrinth, přijme za vás stahování zdrojů BlueMap a vybere pro něj volný port.
3. Restartujte server (změna se projeví při příštím spuštění a server je označen jako čekající na restart).

BlueMap se vykresluje na pozadí, takže nová mapa potřebuje několik minut na vykreslení prvních dlaždic. Do té doby karta zobrazuje, že mapa ještě není dostupná, a sama se znovu zkontroluje. Jakmile je mapa dostupná, **Celá obrazovka** otevře mapu ve vlastní záložce prohlížeče.

Funguje na serverech s mod loaderem (Fabric, Quilt, Forge, NeoForge) a na pluginových serverech (Paper, Purpur a zbytek rodiny Paper, Spigot), včetně serverů s modpacky. Vanilla servery nemají sestavení BlueMap a karta to hlásí.

## Kdo ji může vidět

Mapa je obsluhována pouze prostřednictvím panelu, za jeho přihlášením: kdokoli, kdo může v panelu zobrazit server, může otevřít jeho mapu, a nikdo jiný. Vlastní port BlueMap není nikdy určen k otevření do internetu ([porty v přehledu](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Zapnutí nebo vypnutí mapy vyžaduje oprávnění serveru **Nastavení** ([uživatelé a role](/docs/users-and-roles/#per-server-permissions)).

Když panel samotný běží v Dockeru, přistupuje k BlueMap uvnitř kontejneru serveru; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) vysvětluje podrobnosti pro nastavení reverzního proxy.

## Vypnutí

**Zakázat mapu** odstraní jar soubor BlueMap, který panel nainstaloval, a uvolní jeho port, opět od příštího restartu. Samotný svět zůstává nedotčen; vykreslené dlaždice mapy zůstávají ve složce serveru, dokud je nesmažete na kartě **Soubory**.

Související: [světy a soubory](/docs/worlds-and-files/), [pozvánky a stránka stavu](/docs/invites-and-status-page/).
