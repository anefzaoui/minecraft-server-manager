---
title: 'Crearea și gestionarea serverelor'
description: 'Creează, pornește, oprește, reconstruiește și configurează servere Minecraft în panou: vrăjitorul de creare, setări, memorie și portul jocului.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Înapoi la indexul documentației](/docs/)

## Crearea unui server

Apăsați **Create a Server** (bara de sus) sau cardul **Create a Server** pentru a deschide expertul.

![Creare server](/docs/images/create-wizard.png)

Expertul pre-completează memoria Java și cota de disc din **Defaults for new servers** de pe pagina Settings, pe care un administrator le poate modifica oricând. Un server nou își preia limita CPU de acolo.

![Setări implicite pentru servere noi](/docs/images/settings-defaults.png)

Alegeți:

- Un **nume** (și o descriere opțională, pictogramă și culoare de accent). Etichetele pentru organizarea flotei dvs. se adaugă mai târziu, în setările serverului.
- Un **tip de server**: Vanilla, Paper sau Purpur pe fila **Vanilla**. Pentru un server modat, fila **From Mods** selectează încărcătorul (Fabric, Forge, NeoForge sau Quilt), versiunea Minecraft și o versiune a încărcătorului (cea mai recentă sau una specifică), apoi vă permite să căutați moduri.
- O **versiune Minecraft**: `LATEST`, un snapshot sau o versiune specifică (inclusiv beta și alpha).
- Un **port de joc**: se sugerează unul liber. Consola de la distanță (RCON) folosește portul cu 1000 mai mare (implicit). Îl puteți schimba mai târziu (vezi [Schimbarea portului de joc](#changing-the-game-port)).
- **Resurse**: memoria Java (limita de memorie a containerului este setată cu 50% peste aceasta) și o cotă de disc.

**Advanced Options** deschide toate celelalte setări pe care le suportă imaginea serverului, plus variabile de mediu suplimentare și (pentru administratori) setările Docker avansate.

Preferi un modpack? Fila **From Modpack** instalează în schimb un pachet CurseForge, Modrinth sau GT New Horizons (vezi [Modpacks](/docs/modpacks/)), sau preia un **zip personalizat pe care îl încărcați**: un `.mrpack` Modrinth, un export de modpack CurseForge (`manifest.json`), sau orice zip de fișiere mod. Manifestul (sau un vot majoritar între fișierele identificate) completează încărcătorul și versiunea Minecraft, iar fiecare mod se instalează într-o singură sarcină. Puteți, de asemenea, să începeți dintr-un [Blueprint](/docs/blueprints/) salvat pe fila **From Blueprint**.

Panoul selectează automat un runtime Java adecvat pentru versiunea dvs., descarcă imaginea, creează containerul și îl pornește, totul dintr-un singur formular.

## Lista serverelor

Pagina **Servers** listează întreaga dvs. flotă cu starea și statistici rapide.

![Lista serverelor](/docs/images/servers-list.png)

## Un singur server

![Jucători](/docs/images/players.png)

Deschiderea unui server vă oferă un spațiu de lucru cu file:

- **Overview**: adresa de partajat cu jucătorii, descrierea, utilizarea în timp real și cine este online.
- **Console**: fluxul de log în timp real și intrarea comenzilor, chatul din joc și [comenzi de chat](/docs/console-and-chat/).
- **Players**: lista jucătorilor, plus inventarul și statisticile.
- **Mods**: lista modurilor instalate, [browserul de moduri](/docs/modpacks/) și actualizările de conținut. Pe un server modat, sub-fila sa **Versions** verifică pentru ce versiuni viitoare de Minecraft au versiuni modurile dvs. ([actualizări](/docs/updates/#minecraft-version-compatibility)).
- **World**: [lumi, harta în timp real și managerul de fișiere](/docs/worlds-and-files/).
- **Backups**: [snapshot-uri și restaurare](/docs/backups/) pentru acest server.
- **Monitoring**: istoric per server și metrici în timp real, inclusiv rapoarte de crash (vezi mai jos).
- **Settings**: **Configuration** (totul despre cum rulează serverul), plus [integrările](/docs/integrations/) (Discord, Status Page, Invites și, pentru administratori, Chatbot).

Controalele de pornire, oprire și repornire se află în antetul deasupra fiecărei file. Ceea ce puteți face pe fiecare filă depinde de [permisiunile dvs. pe acel server](/docs/users-and-roles/#per-server-permissions): de exemplu, sub-fila **Files** necesită permisiunea Files, iar trimiterea comenzilor de consolă necesită Console.

![Prezentare generală a serverului](/docs/images/server-overview.png)

Barele **World Controls** se deplasează pe fiecare filă: ceasul din joc, vremea, regulile comune de joc ca butoane de comutare și "Show all world rules" pentru restul.

![Controale lume](/docs/images/world-controls.png)

**Monitoring → Live** afișează TPS și milisecunde per tick, un card de sănătate și stabilitate cu crash-uri (ultimele 24h și 7z), opriri din lipsă de memorie și reporniri automate, și dimensiuni per lume.

![Monitorizare live](/docs/images/monitoring-live.png)

## Setări server

**Settings → Configuration** este suprafața completă de configurare: nume, descriere, MOTD, pictogramă, culoare și etichete, resurse, portul de joc, politica de actualizare, pornire la bootarea panoului și repornire automată la crash, fiecare variabilă de mediu pe care o suportă imaginea serverului, setările Docker avansate și exportul, clonarea, reconstruirea și ștergerea blueprint-ului. Modificările care au efect doar după reconstruirea serverului sunt salvate imediat și așteaptă: un buton **Apply Changes** apare în antetul serverului și sunt aplicate și la următoarea pornire a serverului.

**Auto-restart on crash** repornește un server blocat, așteptând mai mult între fiecare încercare (5, 10, apoi 20 de secunde) și oprindu-se după 3 încercări în 10 minute. Sare peste crash-urile pe care panoul le recunoaște ca probleme de configurare (EULA, Java greșit, o lume dintr-o versiune mai nouă, un port utilizat, lipsă de memorie, o cheie CurseForge lipsă), deoarece acestea necesită mai întâi o remediere. Dacă o altă acțiune este ocupată cu serverul (o copie de rezervă, o restaurare, o schimbare de port), așteaptă până la 30 de minute și renunță imediat ce cineva oprește sau pornește singur serverul.

Modificările directe ale setărilor persistă întotdeauna la reporniri. O modificare PvP sau de dificultate făcută cu bara **World Controls**, o comutare a listei albe pe fila **Players**, sau o editare `server.properties` în editorul **Files** elimină variabila de mediu corespunzătoare (dacă a fost setată) și marchează serverul pentru a fi reconstruit, astfel încât valoarea de pe disc să prevaleze în loc să fie reafirmată de imaginea containerului la următoarea pornire.

![Setări server](/docs/images/server-settings.png)

**Despre contorul de memorie.** "RAM (Java heap)" este transmisă Java ca fiind atât memoria de start, cât și cea maximă, iar Java umple o memorie alocată în primul minut, cu sau fără presetările de flag-uri Aikar / MeowIce. Astfel, contorul de memorie se stabilizează la aproximativ dimensiunea memoriei și rămâne acolo chiar și când nimeni nu joacă; marcajul de pe contor indică unde se află memoria sub limita containerului, iar nota de sub el afirmă acest lucru. Dacă preferați ca memoria să urmărească utilizarea reală, alocați serverului o memorie de start mai mică cu **Initial heap** în cardul Resources de la **Settings → Configuration** (sau sub **Advanced Options** în expert), de exemplu 512 MB: pe o memorie de 2 GB, aceasta a redus utilizarea inactivă de la 2,6 GB la aproximativ 1,3 GB în măsurătorile noastre. Java necesită, de asemenea, memorie în afara heap-ului (aproximativ 0,5 GB pe vanilla, 1,5 până la 2 GB pe un modpack mare), pentru aceasta fiind spațiul de rezervă al limitei containerului. Consultați README-ul "Two memory limits" pentru cifre.

> **Advanced Docker Settings** (numele containerului, rețeaua Docker, mapări suplimentare de porturi și legături suplimentare de volum) sunt **doar pentru administratori**, deoarece o legătură de montare plus accesul Docker al panoului este echivalent cu root pe gazdă. Vezi [Users & roles](/docs/users-and-roles/).

### Schimbarea portului de joc

Cardul **Game Port** de la **Settings → Configuration** mută un server la un alt port oricând, cu propriul buton **Save Port**. **Use Next Free Port** selectează cel mai mic port liber, iar cardul verifică orice port introduceți înainte de a-l salva. RCON urmează întotdeauna la 1000 deasupra portului de joc (decalajul implicit). Administratorii pot alege orice port de la 1024 în sus; toți ceilalți aleg de la primul port de joc (25565 implicit) în sus. Salvarea aplică modificarea imediat: un server oprit doar se mută, iar unul pornit întreabă mai întâi, apoi repornește pe noul port (lumea este salvată mai întâi, iar jucătorii se reconectează pe noul port). Dacă serverul nu poate porni pe noul port, revine la cel vechi. Modificarea este refuzată în timp ce alte modificări așteaptă **Apply Changes**, deci aplicați-le mai întâi pe acelea. Schimbarea portului necesită permisiunea Settings pe acel server.

![Cardul Game Port](/docs/images/server-port.png)

![Promptul înainte ca un server pornit să repornească pe noul său port](/docs/images/port-restart.png)

## Rapoarte de crash & analiză mclo.gs

Rapoartele de crash (`crash-reports/*.txt` și fișierele JVM `hs_err_pid*.log`) sunt preluate automat, analizate într-un rezumat pe o singură linie cu excepția și modurile suspectate, și listate sub **Monitoring → History**:

![Card raport crash](/docs/images/crash-mclogs-card.png)

Fiecare card de raport oferă un vizualizator încorporat (cu secțiuni pliabile și excepții evidențiate), copierea stack-ului și descărcare, plus două acțiuni [mclo.gs](https://mclo.gs):

- **Share to mclo.gs** publică raportul ca un paste public și copiază linkul: exact ceea ce cer autorii de moduri și serverele Discord de suport. Linkul este reținut pe raport, astfel încât nimic nu este încărcat de două ori.
- **Analyze** rulează perspectivele automate ale mclo.gs peste paste: probleme cunoscute cu remedieri sugerate (dependințe lipsă, nepotriviri de versiuni, conflicte comune de moduri), afișate direct în panou.

![Perspective mclo.gs](/docs/images/crash-insights.png)

Ambele acțiuni sunt protejate de o confirmare explicită, deoarece un paste este public: rapoartele de crash pot include nume de jucători și lista dvs. completă de moduri. Panoul nu încarcă niciodată nimic de la sine.
