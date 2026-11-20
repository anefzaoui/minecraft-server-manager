---
title: 'Hartă live'
description: 'Activează o hartă 3D live BlueMap a lumii unui server printr-un singur clic, servită doar prin autentificarea panoului.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Înapoi la indexul documentației](/docs/)

Tabul **Lume → Hartă** al unui server afișează o hartă 3D live, zoomabilă, a lumii sale, desenată de [BlueMap](https://bluemap.bluecolored.de/) (gratuit și open source), cu pozițiile jucătorilor și fiecare dimensiune. Panoul o instalează, o configurează și o servește; nu deschizi niciodată un port sau nu editezi un fișier de configurare pentru ea.

## Activarea

1. Deschide serverul, apoi **Lume → Hartă**.
2. Apasă **Activează harta live**. Panoul instalează versiunea BlueMap care corespunde loader-ului serverului și versiunii Minecraft de pe Modrinth, acceptă descărcarea resurselor BlueMap în locul tău și alege un port liber pentru ea.
3. Repornește serverul (modificarea se aplică la următoarea pornire, iar serverul este marcat ca așteptând una).

BlueMap se redă în fundal, așa că o hartă nouă necesită câteva minute pentru a-și desena primele dale. Până atunci, tabul indică faptul că harta nu este încă pregătită și verifică din nou singur. Odată ce este pregătită, **Ecran complet** deschide harta într-o filă separată de browser.

Funcționează pe servere cu un loader de moduri (Fabric, Quilt, Forge, NeoForge) și pe servere cu plugin-uri (Paper, Purpur și restul familiei Paper, Spigot), inclusiv servere modpack. Serverele Vanilla nu au o versiune BlueMap, iar tabul indică acest lucru.

## Cine o poate vedea

Harta este servită numai prin intermediul panoului, în spatele autentificării sale: oricine poate vizualiza serverul în panou poate accesa harta sa, și nimeni altcineva. Portul propriu al BlueMap nu este destinat niciodată să fie deschis către internet ([porturi dintr-o privire](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Activarea sau dezactivarea hărții necesită permisiunea **Setări** a serverului ([utilizatori și roluri](/docs/users-and-roles/#per-server-permissions)).

Când panoul în sine rulează în Docker, accesează BlueMap din containerul serverului; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) explică detaliile pentru configurațiile de reverse-proxy.

## Dezactivarea

**Dezactivează harta** elimină fișierul jar BlueMap instalat de panou și eliberează portul său, din nou, de la următoarea repornire. Lumea în sine nu este atinsă; dalele hărții redate rămân în folderul serverului până când le ștergi din tabul **Fișiere**.

Legate de: [lumile și fișierele](/docs/worlds-and-files/), [invitațiile și pagina de stare](/docs/invites-and-status-page/).
