---
title: 'Documentație'
description: 'Un panou de control complet, auto-găzduit, pentru itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Un panou de control complet, auto-găzduit pentru [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Creează, rulează și gestionează servere Minecraft din browserul tău. Fără linie de comandă, fără editarea manuală a fișierelor YAML.

![Dashboard](/docs/images/dashboard.png)

## Începe aici

- **[Primii pași](/docs/getting-started/)** - configurare inițială, autentificare și orientare în interfață.
- **[Panoul de control](/docs/dashboard/)** - o vedere de ansamblu a fiecărui server, jucători și activități.

## Rularea serverelor

- **[Crearea și gestionarea serverelor](/docs/servers/)** - expertul de creare, tipuri de servere, versiuni și setări specifice fiecărui server.
- **[Consolă și comenzi de chat](/docs/console-and-chat/)** - consola live și comenzi personalizate de chat în joc care rulează ca jucător.
- **[Pachete de moduri (Modpacks)](/docs/modpacks/)** - instalează pachete CurseForge, Modrinth, FTB și GT New Horizons, mereu fixate la o versiune exactă.
- **[Lumi și fișiere](/docs/worlds-and-files/)** - schimbă lumi, gestionează moduri și editează fișiere direct în browser.
- **[Reducerea dimensiunii unei lumi](/docs/world-shrink/)** - recuperează spațiu pe disc prin eliminarea bucăților (chunks) nevizitate, individual sau ca parte a unei copii de rezervă.
- **[Hartă live](/docs/live-map/)** - o hartă 3D BlueMap cu un singur clic a lumii, accesibilă după autentificarea în panou.
- **[Invitații și pagina de stare](/docs/invites-and-status-page/)** - adresa, textul invitației și pachetul de moduri pentru prieteni, precum și o pagină publică de stare.

## Date și automatizare

- **[Chatbot per server](/docs/chatbot/)** - conversație locală/compatibilă cu OpenAI, notificări, transcrieri păstrate și puteri de joc limitate.
- **[Copii de rezervă (Backups)](/docs/backups/)** - instantanee cu un singur clic, backup-uri programate, numărul de copii de păstrat (la nivel de panou sau per server) și restaurare.
- **[Șabloane (Blueprints)](/docs/blueprints/)** - capturează întreaga configurație a unui server și creează altele noi pe baza acesteia.
- **[Programări (Schedules)](/docs/schedules/)** - reporniri, backup-uri și comenzi controlate prin cron.
- **[Stocare (Storage)](/docs/storage/)** - utilizarea discului per server și cote impuse de panou.
- **[Actualizări (Updates)](/docs/updates/)** - urmărește versiunile noi ale serverului, pachetelor, imaginilor și modurilor, verifică ce versiuni Minecraft suportă modurile tale și anulează o actualizare de mod.
- **[Jurnal de activități](/docs/activity/)** - o pistă de audit a tot ce s-a întâmplat.
- **[Integrări](/docs/integrations/)** - notificări prin webhook Discord și categoria Alerte.
- **[API public](/docs/public-api/)** - un API HTTP doar pentru citire, autentificat prin token, pentru preluarea stării serverului din afara panoului.

## Conturi și securitate

- **[Utilizatori și roluri](/docs/users-and-roles/)** - administrator, operator și vizualizator, ce poate face fiecare și permisiuni per server care le rafinează.
- **[Autentificare cu doi factori](/docs/two-factor-authentication/)** - protejează-ți autentificarea cu o aplicație de autentificare.

## Ghiduri

Nu sunt specifice acestui panou: întrebările cu care se confruntă fiecare proprietar de server Minecraft.

- **[Cât RAM necesită un server?](/docs/guide-server-memory/)** - cele două numere de setat și de ce un server inactiv consumă 12 GB.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - ce să rulezi și diferența dintre plugin-uri și moduri care stă la baza alegerii.
- **[Serverul tău nu pornește](/docs/guide-server-wont-start/)** - citirea log-ului și puținele cauze din spatele majorității eșecurilor.
- **[Copii de rezervă care se restaurează cu adevărat](/docs/guide-backups/)** - copii consistente, ce altceva să păstrezi și testarea uneia înainte de a avea nevoie de ea.
- **[Mutarea unui server pe alt gazdă](/docs/guide-moving-a-server/)** - ordinea care menține timpul de nefuncționare scurt și inventarele intacte.

## Sub capotă

- **[Arhitectură](/docs/architecture/)** - cum este construit panoul.
- **[Site-ul web](/docs/website/)** - cum este construit, tradus și implementat minecraft-server-manager.com din acest depozit.

---

> Capturile de ecran din aceste documente sunt realizate în tema întunecată a panoului. Panoul pornește implicit pe tema întunecată, cu excepția cazului în care sistemul tău de operare preferă tema deschisă; folosește comutatorul de temă din bara de sus pentru a schimba.
