---
title: 'Panoul de control'
description: 'Panoul de control este baza ta: fiecare server, starea sa live și un flux continuu al evenimentelor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Înapoi la indexul documentației](/docs/)

Panoul de control este baza ta: fiecare server, starea sa live și un flux continuu al evenimentelor recente.

![Dashboard](/docs/images/dashboard.png)

## Plăcuțele de rezumat

În partea de sus:

- **Servere online** - câte dintre serverele tale rulează în prezent.
- **Jucători conectați** - numărul total de jucători pe toate serverele care rulează.
- **Actualizări disponibile** - câte servere, pachete sau moduri au o versiune mai nouă ([vezi Actualizări](/docs/updates/)).
- **Docker** - dacă panoul poate accesa daemonul Docker și versiunea acestuia.

## Cardurile serverelor

Fiecare server apare ca un card cu starea sa (Rulează, Pornire, Oprit, Blocat), tipul și versiunea Minecraft, și portul de joc. Pentru serverele care rulează, primești și informații live despre **jucători**, utilizarea **CPU**, **memorie** și **disc**, actualizate continuu.

Apasă pe un card pentru a deschide acel server. Cardul gol **Creează un server** și butonul **Creează un Server** din bara de sus inițiază ambele [expertul de creare](/docs/servers/).

Poți căuta și sorta serverele, și poți comuta între aspectul de grilă și listă cu comutatorul din dreapta.

## Activitate recentă

Fluxul de la partea de jos este un jurnal de audit live, ușor de citit: autentificări, backup-uri, exporturi de blueprint-uri, verificări de actualizări, modificări ale comenzilor de chat, porniri și opriri ale serverelor și multe altele. Fiecare intrare este etichetată cu serverul căruia îi aparține (sau cu panoul în sine) și cât timp a trecut de la eveniment. Istoricul complet se găsește pe pagina [Activitate](/docs/activity/).
