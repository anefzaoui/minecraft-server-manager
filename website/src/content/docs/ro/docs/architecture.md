---
title: 'Arhitectură'
description: 'Minecraft Server Manager este o aplicație Node.js redată pe server, cu un singur proces.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Înapoi la indexul documentației](/docs/)

Minecraft Server Manager este o aplicație Node.js redată pe server, cu un singur proces. Gestionează
servere Minecraft care rulează ca containere Docker folosind imaginea
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicând cu
daemonul Docker prin API-ul său (niciodată prin apelarea liniei de comandă `docker`).

## Structura de execuție

- **Express + Handlebars** redau paginile pe partea serverului. Nu există SPA; JavaScript-ul browserului din `public/js/`
  este o îmbunătățire progresivă scrisă manual. Un pas esbuild (`pnpm run build:js`) îl împachetează și
  îl minifyază în `public/dist/js/`; aplicația servește acel pachet atunci când este prezent și sursa brută
  în caz contrar, astfel încât o rulare de dezvoltare fără o compilare funcționează totuși.
- **`node:sqlite`** (integrat în Node; panoul necesită Node ≥ 24) este baza de date - sincronă,
  zero module native, mod WAL. Un mic program de rulare a migrațiilor versiificate aplică `src/db/migrations/*` la
  pornire. Instrucțiunile pregătite sunt stocate în cache în `src/db/index.js` indexate după textul SQL.
- **`ws`** transportă fluxurile live de consolă și statistici. Ambele sunt **brokerate**: un singur flux ascendent
  `docker logs --follow` (sau `docker stats`) per server, demuxat o dată și distribuit fiecărei
  tab-uri conectate, mai degrabă decât un flux ascendent per vizualizator. Brokerul de consolă păstrează un mic buffer de redare
  pentru tab-urile care se conectează târziu și elimină un abonat al cărui socket rămâne prea în urmă, mai degrabă decât
  să blocheze fluxul partajat.
- **dockerode** este singura modalitate prin care aplicația comunică cu Docker. Endpoint-ul este detectat automat per platformă
  (pipe numit Windows vs. socket Unix).
- **Toată starea persistentă se află sub un singur director** (`$DATA_DIR`, implicit `./data`). Copierea acelui
  director migrează întregul panou.

## Stratificare

Dependențele curg într-o singură direcție:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parsează și validează intrarea, modelează răspunsurile
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   logica domeniului (funcționalitățile reale)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastructură
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - un router per domeniu (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` montează cele de nivel superior (`api.js`, API-ul JSON de sesiune care deține și rutele serverului de bază și montează routerele de domeniu per server; `index.js`, paginile; `auth`, `account`,
  `tasks`, …). Routerele validează cu zod, apelează un serviciu și returnează JSON
  sau redau o vizualizare. Logica de afaceri nu aparține aici. Două routere sunt montate în **zona publică**,
  înainte de `requireAuth`: `routes/status.js` (pagini de stare HTML per server, opționale) și
  `routes/apiV1.js` (`/api/v1`, un API JSON numai pentru citire autentificat printr-un token Bearer emis de administrator din
  `services/apiTokens.js`, dezactivat dacă nu este activat în Setări; vezi `docs/public-api.md`).
- **`services/`** - inima aplicației. Fiecare serviciu deține un domeniu și poate depinde de
  infrastructură și de alte servicii.
- **`docker/`** - wrapper-e dockerode: `connect` (detectare endpoint + stare daemon), `containers`
  (creare/pornire/oprire/recreare cu mount-uri de legătură, limite de memorie/CPU și etichete), `logs`, `stats`,
  `images`, `networks` (descoperire rețea gazdă), `hostPath` (re-radacinează căile de legătură sub
  `DATA_DIR_HOST`), și un `watcher` care transformă evenimentele Docker în istoric + detectare blocări.
- **`db/`** - wrapper-ul SQLite și programul de rulare a migrațiilor.
- **`storage/`** - inițializarea `./data`, **gardianul de căi** (`safeJoin`, coloana vertebrală de siguranță a fișierelor) și
  indexatorul de dimensiuni în fundal + aplicarea cotelor.

Transversal:

- **`config/`** - configurația de mediu plus **catalogul de câmpuri**: singura sursă de adevăr pentru
  setările serverului. Fiecare variabilă de mediu itzg este catalogată (etichetă, ajutor, tip, unitate, implicit,
  validare, secțiune, flag-uri de pericol). Expertul, formularele de setări și validarea zod sunt toate derivate
  din acesta, astfel încât expunerea unei noi setări este o modificare de date, nu o nouă conductă UI.
- **`events/`** - `recordEvent()` este singurul punct de intrare pentru jurnalul de istoric; evenimentele ciclului de viață capturează, de asemenea, fragmente de jurnal de container în `data/logs/<id>/events/`.
- **`ws/`** - WebSockets autentificate pentru consolă + statistici (cookie de sesiune verificat la upgrade, `Origin`
  verificat pentru a bloca deturnarea cross-site), brokerate per server (vezi "Structura de execuție").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnează un logger [Pino](https://getpino.io) per modul; nivelul din `LOG_LEVEL`, `makeFailureThrottle()` menține o buclă de fundal care eșuează persistent la o singură linie de jurnal plus o linie "recuperată".
  `src/utils/logSanitize.js` cenzurează cheile cu format de credențiale și token-urile webhook din metadatele structurate; `src/config/logLevel.js` este lista de permise de nivel partajată (păstrată separat pentru a evita un ciclu de require cu `config`). `src/instrument.js` este o cusătură Sentry dormantă, încărcată prima în
  `src/server.js`. `src/web/middleware/requestLog.js` scrie o linie de jurnal de acces per cerere (sărind peste `/healthz` și fișierele statice). ESLint impune `no-console` sub `src/**`, cu
  `preflight.js`, `instrument.js`, și `config/index.js` exceptate (rulează înainte ca logger-ul să existe).
- **Limitarea ratei** - `src/web/middleware/rateLimit.js` plasează `express-rate-limit` în fața `/api`
  (`RATE_LIMIT_API_PER_MIN`, implicit 1200) și POST-urile de login / 2FA / setup
  (`RATE_LIMIT_AUTH_PER_15MIN`, implicit 100); `0` dezactivează un limitator. Indexează după `req.ip`, deci
  `TRUST_PROXY` contează în spatele unui proxy. `/api/v1` are proprii limitatori: o limită per client-IP
  (de cinci ori bugetul per token) care rulează înainte ca token-ul să fie verificat, apoi un buget per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, implicit 120) indexat după ID-ul token-ului verificat. Un cont soft separat per cont în
  `src/web/middleware/auth.js` gestionează blocarea la login (per IP și global per cont, cu decădere).
- **Autorizare**: două niveluri. Rolul global (`requireAuth` → `requireRole` / `requireWrite` în
  `src/web/middleware/auth.js`) controlează acțiunile la nivel de panou și este implicit pe fiecare server. Permisiunile per server
  (`src/services/permissions.js`, nouă capabilități stocate ca listă JSON per
  `(utilizator, server)` în `user_server_permissions`) rafinează implicitul pentru un server; fiecare
  rută `/api/servers/:id`, montare sub-router, pagină, WebSocket și listare la nivel de flotă trece prin
  `src/web/middleware/serverAccess.js` (`serverScope`, montat pe prefixul `/servers/:id` atât al
  API-ului, cât și al routerului de pagini, ascunde un server fără `view` ca 404; `requireCap(cap)` numește
  capabilitatea necesară unei rute). Scrierile care își numesc serverul în corpul cererii (programări, extragere și
  instalare lume, export blueprint) sunt deschise pentru vizualizatori numai de către `requireWrite` pentru acel server, și fiecare
  astfel de rută verifică capabilitatea în sine. `test/permissions-routes.test.js` parcurge stivele routerului live și eșuează dacă o rută de scriere, montare sau pagină cu scop de server nu are un gardian.

## Comportamente cheie ale domeniului

- **Modpack-urile sunt întotdeauna fixate.** Imaginea actualizează automat pack-urile nefixate la fiecare repornire, deci panoul rezolvă "latest" la un ID concret de versiune la momentul instalării și îl fixează. Actualizările sunt un flux explicit orchestrat (`updates/`): previzualizare → backup pre-actualizare → oprire grațioasă → re-fixare →
  recreare → monitorizare stare → rollback printr-un clic.
- **Suprapunerea de moduri personalizate** este gestionată de panou: modurile adăugate de utilizator ajung în biblioteca deduplicată și sunt legate fizic în server, astfel încât să supraviețuiască actualizărilor de pack. Dezactivarea este conștientă de clasă. Deoarece
  biblioteca păstrează fiecare build pe care l-a descărcat, o actualizare înregistrează build-ul pe care l-a înlocuit
  (`server_content.previous_*`) și poate fi restaurată numai din fișiere locale. Dezactivarea unui mod de pack
  scrie variabila de mediu de excludere a pack-ului în schimb; `packs.applyPack` transportă aceasta și restul
  ajustărilor pack-ului (`PACK_TUNING_KEYS`) peste o schimbare de versiune a aceluiași pack și o elimină când
  pack-ul se schimbă.
- **O actualizare a versiunii Minecraft trebuie câștigată.** `services/compat.js` scanează modurile unui server -
  rezolvate din rândurile instalate de panou, apoi din manifestul pack-ului CurseForge, apoi prin hash-ul de conținut
  împotriva Modrinth/CurseForge - și construiește o matrice de suport (loader, versiune Minecraft) per proiect din
  `latestFilesIndexes` ale CurseForge (200 de proiecte per cerere) și lista de versiuni per proiect a Modrinth
  (o cerere per proiect, ceea ce menține loader-ul și versiunea asociate). Verificatorul de actualizări oferă numai cea mai nouă versiune pe care o suportă FIECARE mod și nu oferă nimic deloc atunci când răspunsul nu poate fi stabilit: nicio scanare, o scanare pentru o versiune sau un loader diferit, una care nu s-a terminat niciodată, sau un jar pe care niciun registru nu îl recunoaște. Scanările sunt numai manuale, iar progresul și rezultatele parțiale ale acestora se află în `version_compat` (nu în `services/tasks.js` din memorie), astfel încât o reîmprospătare
  sau o repornire a panoului continuă în loc să se blocheze pe un spinner; `reconcileScans()` marchează scanările
  abandonate de o oprire la următoarea pornire.
- **Versiunea loader-ului de moduri este o fixare, ca totul.** `services/loaderPin.js` citește build-ul instalat din manifestul de instalare al imaginii (`.forge-manifest.json` și similare) și scrie fixarea: variabila itzg a loader-ului pe un server simplu (`FORGE_VERSION`, …), sau
  `CF_MOD_LOADER_VERSION` pe un pack CurseForge Forge sau Fabric, care suprascrie versiunea declarată de pack.
  Instalatorul CurseForge al imaginii ignoră acea suprascriere pentru NeoForge, iar pack-urile Modrinth și FTB nu au niciuna, deci loader-ul lor urmează pack-ul. `packs.applyPack` elimină toate variabilele `CF_` la o actualizare sau rollback de pack, care elimină o suprascriere odată cu restul. Un build tipizat este verificat mai întâi împotriva listei complete a registrului (`services/loaderVersions.js`; cel al Forge provine din metadatele sale maven, care omite numerele; o ratare este re-verificată o dată împotriva registrului în sine), apoi modificarea este backup → fixare (peste mediul așa cum este după backup) → reconstruire.
- **Porturile** sunt alocate dintr-un schemă de bază (joc de la `PORT_GAME_START` în sus, RCON = joc +
  `PORT_RCON_OFFSET`, Bedrock de la `PORT_BEDROCK_START`), sondate pentru disponibilitate și rezervate în
  baza de date. "Ocupat" este uniunea tuturor revendicărilor fiecărui server (porturi live, plus o pereche în așteptare mai jos),
  fiecare port gazdă pe care îl publică orice container Docker (`containers.publishedHostPorts`: legături live ale containerelor în rulare plus cele configurate ale fiecărui container oprit, deoarece o sondă de legare a sistemului de operare din interiorul propriului container al panoului vede numai spațiul de rețea al acelui container), și sonda sistemului de operare. Partea Docker este stocată în cache timp de 3 secunde și limitată: o listă care nu răspunde în 2,5 secunde elimină numai partea Docker, iar o inspecție lentă costă numai porturile acelui container. Crearea serverelor și
  `servers.changeGamePort` aleg porturi printr-un singur lanț de serializare care acoperă numai alegerea
  și revendicarea sa (scrierea rândului pentru o creare, rezervarea în memorie pentru o modificare de port);
  selectorul de port al BlueMap și suprascrierile de port suplimentar nu sunt incluse și nu
  consultă Docker. O modificare de port pe un server existent (`servers.changeGamePort`, sub blocarea de operare a serverului)
  este aplicată imediat, deoarece Docker repară legăturile de port la crearea containerului: noua pereche (RCON întotdeauna joc + `PORT_RCON_OFFSET`) este verificată și rezervată în memorie
  (`ports.reserve`, atât perechea veche, cât și cea nouă, onorată de fiecare altă alegere) sub blocarea de port. Este refuzată (409 `PENDING_CHANGES`) cât timp alte setări așteaptă o reconstruire, deci reconstruiește numai un container care a rulat deja, pe un port nou; și un server în rulare este modificat numai când cererea spune `restart: true` (altfel 409 `NEEDS_CONFIRM`). Imaginea este trasă și numele containerului personalizat este verificat înainte ca orice să fie atins. Un server în rulare este oprit; apoi noua pereche este scrisă cu `pending_recreate = 1` (astfel încât o blocare a panoului de acolo lasă un "rebuild pending" onest), containerul este eliminat, reconstruit pe noua pereche și pornit. Dacă orice pas după oprire eșuează, `putBackOnOldPort` scrie perechea veche înapoi, reconstruiește (și repornește, dacă era în rulare) pe ea și înregistrează ce pas a eșuat; istoricul și alertele spun dacă chiar și asta a eșuat, ceea ce lasă serverul oprit până când cineva îl pornește. Capabilitatea `settings` este suficientă, inclusiv serverul în rulare. Non-administratorii pot alege numai de la `PORT_GAME_START` în sus.
  (Coloanele `port_*_pending` din migrarea 029 aparțin unui design anterior, nelansat și sunt neutilizate; 031 le șterge.) O coliziune de blocare răspunde cu 409 și `code: 'BUSY'`, pe care apelatorii care reîncearcă
  o verifică mai degrabă decât formularea. O repornire automată la blocare
  (`watcher.restartAfterCrash`) și o backup programată sau pornire (`scheduler.runTaskWithRetry`)
  care găsesc serverul ocupat cu o altă acțiune încearcă din nou la fiecare 20 s / 60 s timp de până la 30 de minute,
  iar o actualizare sau rollback de pack reîncearcă pașii săi blocați în același mod (`opLock.retryWhileBusy`);
  o repornire la blocare sau o pornire programată în așteptare renunță odată ce cineva a oprit, a oprit sau a pornit serverul de atunci (`events.lifecycleActionSince`), iar repornirea la blocare, de asemenea, când repornirea automată este dezactivată sau serverul a dispărut. Repornirile programate, opririle și comenzile nu sunt reîncercate, iar o programare a cărei ultimă rulare încă așteaptă omite următoarea sa declanșare.
- **Cotele de disc** sunt aplicate de panou deoarece Docker nu poate limita utilizarea mount-urilor de legătură: indexatorul stochează în cache dimensiunile per director, iar operațiunile de creștere a discului sunt controlate de acestea.
- **Secretele** (parole RCON, chei API, secrete TOTP, URL-ul webhook Discord) sunt criptate în repaus cu AES-256-GCM folosind o cheie dedicată aleatorie la `$DATA_DIR/.secret-key` (mod `0600`,
  generată automat). Este independentă de `SESSION_SECRET`; o cheie derivată din `SESSION_SECRET` este păstrată ca o rezervă numai pentru decriptare pentru valorile scrise înainte ca cheia dedicată să existe, iar
  `src/services/secretsMigration.js` re-criptează acelea sub cheia dedicată o dată la pornire.
  Un `.secret-key` care există dar nu poate fi parsat este o eroare gravă la pornire (nu este niciodată regenerat silențios peste cel existent). Blueprint-urile elimină toate secretele la export.
- **`server.properties` este deținut de panou, dar umbrit de mediu.** Imaginea itzg reafirmă fiecare
  proprietate bazată pe mediu la fiecare pornire (`OVERRIDE_SERVER_PROPERTIES` implicit true), deci o valoare pe care panoul o editează direct - Controale Lume PvP/dificultate, comutatorul whitelist, editorul de fișiere -
  ar fi anulată silențios la următoarea pornire, cu excepția cazului în care variabila de mediu corespunzătoare este eliminată și containerul recreat. Fiecare scriere directă de proprietate trece prin `writeServerProperties()` (fișier complet) sau `setServerProperty()` (o singură cheie) în `src/services/servers.js`, care rescriu atomic fișierul, elimină variabila de mediu din spatele fiecărei chei modificate (prin atributul `prop:` pe câmpurile catalogului, verificat în teste împotriva definițiilor proprii ale imaginii pentru proprietăți) și marchează
  `pending_recreate`. Dificultatea este scrisă atât în fișier, cât și trimisă prin RCON, deoarece un server dedicat reaplică proprietatea `difficulty` la fiecare pornire. Minecraft în sine salvează `server.properties` din valorile sale la pornire la `whitelist on/off`, ceea ce ar anula modificările făcute în timp ce serverul rulează, deci comutatorul whitelist în rulare salvează mai întâi fișierul și îl rescrie cu numai `white-list` modificat. Variabilele de mediu
  rămân complet configurabile la creare (expertul le redă și se aplică o dată); ele doar desprind fixarea la prima editare a panoului a proprietății subiacente. MOTD are același contract: o editare directă a fișierului `motd` o dezactivează, deci ultima scriere câștigă.

## Formate de date și de transmisie

- **`data/panel.db`** - baza de date SQLite. Salvare zilnică prin `VACUUM INTO` către
  `data/backups/_panel/` (ultimele 14 păstrate); `PRAGMA integrity_check` rulează la pornire.
- **`data/.session-secret`** - secretul automat generat pentru semnarea cookie-urilor, creat la prima rulare dacă
  `SESSION_SECRET` este n setat. Ștergerea acestuia rotește secretul (ceea ce invalidează sesiunile).
- **`data/.secret-key`** - cheia dedicată de 32 de octeți pentru criptarea în repaus (mod `0600`), creată automat la prima rulare. Independent de `SESSION_SECRET`; ștergerea acestuia face ca orice credențial stocat să fie indecriptabil, deci aparține backup-urilor dvs.
- **Blueprint-uri (`.mcserver.zip`)** - un fișier zip cu un `manifest.json` care descrie configurația, resursele, referința pack-ului fixat, manifestul de suprapunere (URL-uri sursă + sha256), fișiere de configurare alese și, opțional, o lume. Importul re-descarcă și verifică hash-ul fiecărui mod și atribuie porturi noi.
- **Containere Docker** create de panou sunt numite și etichetate astfel încât watcher-ul să le poată găsi;
  panoul deține ciclul lor de viață complet.

## Secvența de pornire

1. `require('./instrument')` (cusătura Sentry) înainte de orice altceva, apoi `require('./preflight')`
   pentru a eșua clar la o versiune Node neacceptată.
2. Încărcare configurație; asigurare/generare `.session-secret` **și** `.secret-key`.
3. `ensureDataRoot()` - creează structura `./data`, șterge `tmp/`.
4. Rulează migrațiile DB, apoi `PRAGMA integrity_check` (loghează zgomotos, indică `data/backups/_panel`
   la eșec).
5. Re-criptează orice secrete moștenite cu cheia `SESSION_SECRET` sub `.secret-key` (`secretsMigration`).
6. Importă cheile API din mediu o dată (`apiKeys.importFromEnvOnce()`), fixează orice server care încă poartă un selector de modpack nefixat (`packPins.pinUnpinnedServers()`), marchează scanările de compatibilitate a versiunilor lăsate în rulare de un proces anterior ca fiind întrerupte
   (`compat.reconcileScans()`), apoi populează blueprint-uri de pornire (protejat).
7. Pornește serverul HTTP + WS. Pe o legătură expusă, afișează PIN-ul `/setup` de la prima rulare.
8. Instalează gardianul de execuție post-pornire (prinde erorile neprinse; `MSM_EXIT_ON_FATAL=1` îl face să iasă brusc pentru implementări supravegheate).
9. Pornește serviciile de fundal: broker WS, indexator stocare, watcher-e blocări + inventar, planificator,
   punte evenimente Discord, watcher-ul de contact chatbot și **timer-ul zilnic de întreținere** (curăță rânduri vechi de analize, transcrieri chatbot, istoric evenimente (365 zile) și rânduri cache API, apoi salvează
   `panel.db`).
10. Inițializează Docker **în fundal**. Interfața utilizator este complet utilizabilă în timp ce daemonul este oprit;
    funcționalitățile Docker se activează când devine accesibil. Odată conectat, `refreshStatuses({ boot })`
    reconciliază stările din cache, emite un eveniment unic `offline-after-restart` pentru un server care era pornit înainte ca panoul să repornească și nu va fi repornit, iar bucla de pornire pornește
    serverele `auto_start` plus recuperează serverele `auto_restart` găsite blocate în timpul întreruperii
    (respectând backoff-ul de buclă de blocare).

> Ordinea instrumentare-înainte-de-preflight este un compromis deliberat: permite ca o viitoare cablare Sentry
> să patch-uiască runtime-ul mai întâi, cu prețul unui mesaj puțin mai puțin prietenos pe un Node cu adevărat vechi.

## Conducta de compilare

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM cu împărțirea codului). `postinstall` rulează **numai CSS**. `public/css/app.css`
și `public/dist/` sunt artefacte de compilare ignorate de git; etapa de compilare Dockerfile rulează complet
`pnpm run build` și copiază `public/` în imaginea de execuție. Fișierele statice sunt servite
`immutable`/cache lung pentru fișierele cu amprentă, cache scurt pentru CSS/JS și `no-cache` pentru HTML și
`/api`.
