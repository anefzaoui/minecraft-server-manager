---
title: 'Panoul de control'
description: 'Panoul de control este baza ta: fiecare server, starea sa live și un flux continuu al evenimentelor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Înapoi la indexul documentației](/docs/)

Tabloul de bord este baza ta: fiecare server, starea sa live și un flux continuu cu ce s-a întâmplat.

![Dashboard](/docs/images/dashboard.png)

## Dalele de rezumat

În partea de sus:

- **Servere online**: câte dintre serverele tale rulează în prezent, din total.
- **Jucători conectați**: numărul total de jucători pe toate serverele care rulează.
- **Actualizări disponibile**: câte servere, pachete sau moduri au o versiune mai nouă ([vezi Actualizări](/docs/updates/)).
- **Docker**: dacă panoul poate accesa daemonul Docker și versiunea acestuia.

Un al doilea rând adaugă **Memorie alocată** (și cât este utilizată), **Stocare utilizată** pe toate folderele de date ale serverului, **Stare de funcționare · 24h** (blocări, opriri din lipsă de memorie și reporniri automate în ultima zi) și **Actualizări** împărțite în actualizări de moduri și la nivel de server. Sub acestea, **Servere după stare** numără serverele tale în fiecare stare, iar **Prezentare generală resurse** afișează cota fiecărui server din memorie și CPU.

## Carduri server

Fiecare server apare ca un card cu starea sa (Rulează, Pornire, Oprit, Blocat și stări intermediare precum Nesănătos sau Blocat), tipul și versiunea Minecraft, portul de joc și etichetele sale. Fiecare card afișează **jucătorii** și utilizarea **discului** în raport cu cota; serverele care rulează afișează, de asemenea, **CPU** și **memorie** live, actualizate continuu.

Fă clic pe un card pentru a deschide acel server. Cardul gol **Creează un server** și butonul **Creează un server** din bara de sus pornesc ambele [expertul de creare](/docs/servers/).

Poți căuta serverele tale (după nume, tip, versiune sau etichetă), le poți sorta după stare, nume, dimensiune, ultima pornire sau creare și poți comuta între aspectul grilă și listă cu comutatorul din dreapta.

## Activitate recentă

Fluxul din partea de jos afișează cele mai recente intrări din jurnalul de audit al panoului, ușor de citit: autentificări, backup-uri, exporturi de șabloane, verificări de actualizări, modificări ale comenzilor de chat, porniri și opriri ale serverului și multe altele. Fiecare intrare este etichetată cu serverul căruia îi aparține (sau cu panoul în sine) și cu cât timp în urmă a avut loc. **Vizualizează tot** deschide istoricul complet pe pagina [Activitate](/docs/activity/).
