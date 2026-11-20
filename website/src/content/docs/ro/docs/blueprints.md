---
title: 'Blueprints'
description: 'Blueprints salvează întreaga configurație a unui server Minecraft ca o rețetă reutilizabilă pentru crearea de noi servere. Secretele nu sunt niciodată incluse.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Înapoi la indexul documentației](/docs/)

Un **blueprint** (șablon) captează întreaga configurație a unui server (tip, versiune, resurse, mediu, pin de pachet, moduri personalizate și, opțional, configurația și lumea sa) într-un singur fișier portabil `.mcserver.zip` din care poți crea noi servere. Secretele (parole, token-uri și chei din mediu) nu sunt niciodată scrise într-un blueprint.

![Blueprints](/docs/images/blueprints.png)

## Exportare

Din fila **Setări → Configurație** a unui server, folosește **Exportare ca Blueprint** și alege ce să incluzi: întotdeauna configurația serverului, directoarele sale de configurare (implicit activate) și, opțional, fișierele de moduri personalizate în sine (un fișier mai mare care se instalează fără a descărca nimic) și lumea activă. Rezultatul este salvat în biblioteca ta de blueprint-uri și poate fi descărcat pentru partajare.

**Clonare Server**, pe același card, realizează o exportare și o importare într-un singur pas pentru a crea o copie a serverului, cu sau fără lumea sa.

## Importare și creare dintr-un blueprint

Importă un fișier blueprint (**Importare Blueprint** pe pagina **Blueprint-uri**) sau alege unul din bibliotecă (**Creare Server** de pe cardul său, sau fila **Din Blueprint** din vrăjitor) pentru a crea un server nou pre-configurat exact ca originalul. Noul server primește propriile porturi și o parolă RCON nouă. Modurile personalizate care nu au fost încorporate sunt descărcate din nou și verificate în raport cu hash-urile pe care le-a înregistrat blueprint-ul. Biblioteca începe, de asemenea, cu două blueprint-uri de pornire, unul Paper și unul Fabric.

Este cea mai rapidă metodă pentru:

- Pornirea unor servere identice (o rețea de servere de minigame, copii de staging ale producției).
- Mutarea unui server între panouri.
- Păstrarea unui șablon cunoscut și funcțional la care te poți întotdeauna întoarce.

Deoarece un blueprint înregistrează [pin-ul exact al pachetului](/docs/modpacks/), un server de modpack creat dintr-un blueprint instalează aceeași versiune fixată, fără actualizări surpriză.
