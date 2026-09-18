---
title: 'Arhitectură'
description: 'Minecraft Server Manager este o aplicație Node.js redată pe server, cu un singur proces.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Înapoi la indexul documentației](/docs/)

Minecraft Server Manager este o aplicație Node.js redată pe server, cu un singur proces. Aceasta gestionează
serverele Minecraft care rulează ca containere Docker utilizând imaginea
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicând cu
daemonul Docker prin API-ul său (niciodată prin apelarea liniei de comandă `docker`).

## Structura de rulare

- **Express + Handlebars** redau paginile pe server. Nu există SPA; JavaScript-ul din browser din `public/js/`
  este o îmbunătățire progresivă scrisă manual. Un pas esbuild (`pnpm run build:js`) îl împachetează și
  îl minimizează în `public/dist/js/`; aplicația servește acel pachet când este prezent și sursa brută
  altfel, deci o rulare de dezvoltare fără o compilare funcționează în continuare.
- **`node:sqlite`** (integrat în Node; panoul necesită Node ≥ 24) este baza de date - sincronă,
  zero module native, mod WAL. Un mic program de rulare a migrațiilor versiificate aplică `src/db/migrations/*` la
  pornire. Instrucțiunile pregătite sunt stocate în cache în `src/db/index.js` indexate după textul SQL.
- **`ws`** transportă fluxurile live de consolă și statistici. Ambele sunt **brokerate**: un singur flux upstream
  `docker logs --follow` (sau `docker stats`) per server, demuxat o dată și distribuit fiecărei
  tab-uri conectate, mai degrabă decât un flux upstream per vizualizator. Brokerul de consolă păstrează un mic buffer de redare
  pentru tab-urile care se conectează târziu și elimină un abonat al cărui socket rămâne prea în urmă, mai degrabă decât
  să blocheze fluxul partajat.
- **dockerode** este singura modalitate prin care aplicația comunică cu Docker. Punctul de acces este detectat automat pe platformă
  (conductă numită Windows vs. socket Unix).
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

- **`web/routes/`** - un router per domeniu (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), montat în `web/app.js`. Routerele validează cu zod, apelează un serviciu și returnează JSON
  sau redau o vizualizare. Logica de afaceri nu aparține aici. Două routere sunt montate în **zona publică**,
  înainte de `requireAuth`: `routes/status.js` (pagini de stare HTML per server, opționale) și
  `routes/apiV1.js` (`/api/v1`, un API JSON doar pentru citire autentificat printr-un token Bearer emis de administrator din
  `services/apiTokens.js`, dezactivat dacă nu este activat în Setări; vezi `docs/public-api.md`).
- **`services/`** - inima aplicației. Fiecare serviciu deține un domeniu și poate depinde de
  infrastructură și de alte servicii.
- **`docker/`** - wrapper-e dockerode: `connect` (detectare punct de acces + stare daemon), `containers`
  (creare/pornire/oprire/recreare cu mount-uri, limite de memorie/CPU și etichete), `logs`, `stats`,
  `images` și un `watcher` care transformă evenimentele Docker în istoric + detectare blocări.
- **`db/`** - wrapper-ul SQLite și programul de rulare a migrațiilor.
- **`storage/`** - inițializarea `./data`, **gardianul de căi** (`safeJoin`, coloana vertebrală de siguranță a fișierelor) și
  indexatorul de dimensiuni în fundal + aplicarea cotelor.

Transversal:

- **`config/`** - configurația mediului plus **catalogul de câmpuri**: singura sursă de adevăr pentru
  setările serverului. Fiecare variabilă de mediu itzg este catalogată (etichetă, ajutor, tip, unitate, implicit,
  validare, secțiune, flag-uri de pericol). Asistentul, formularele de setări și validarea zod sunt toate derivate
  din acesta, deci expunerea unei noi setări este o modificare de date, nu o nouă conductă UI.
- **`events/`** - `recordEvent()` este singurul punct de intrare pentru jurnalul de istoric; evenimentele de ciclu de viață capturează, de asemenea,
  extrase din jurnalul containerului în `data/logs/<id>/events/`.
- **`ws/`** - WebSockets autentificate pentru consolă + statistici (cookie de sesiune verificat la upgrade, `Origin`
  verificat pentru a bloca atacurile cross-site), brokerate per server (vezi "Structura de rulare").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` returnează un logger [Pino](https://getpino.io) per modul; nivelul din `LOG_LEVEL`,
  `makeFailureThrottle()` menține o buclă de fundal care eșuează persistent la o singură linie de jurnal plus o linie "recuperată".
  `src/utils/logSanitize.js` elimină cheile cu format de credențiale și token-urile webhook din metadatele structurate;
  `src/config/logLevel.js` este lista de permise de nivel partajată (păstrată separat pentru a evita un ciclu de dependențe cu `config`).
  `src/instrument.js` este o interfață Sentry dormantă, încărcată prima în `src/server.js`. `src/web/middleware/requestLog.js` scrie o linie de jurnal de acces per cerere
  (sărind peste `/healthz` și fișierele statice). ESLint impune `no-console` sub `src/**`, cu `preflight.js`, `instrument.js` și `config/index.js` exceptate (acestea rulează înainte ca logger-ul să existe).
- **Limitare de rată** - `src/web/middleware/rateLimit.js` plasează `express-rate-limit` în fața `/api`
  (`RATE_LIMIT_API_PER_MIN`, implicit 1200) și POST-urile de login / 2FA / setup
  (`RATE_LIMIT_AUTH_PER_15MIN`, implicit 100); `0` dezactivează un limitator. Se indexează pe `req.ip`, deci
  `TRUST_PROXY` contează în spatele unui proxy. `/api/v1` are propriul limitator per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, implicit 120), indexat pe un hash al token-ului Bearer cu o alternativă IP. Un contor soft separat per cont în
  `src/web/middleware/auth.js` gestionează blocarea la login (per IP și global per cont, în scădere).

## Comportamente cheie ale domeniului

- **Modpack-urile sunt întotdeauna fixate.** Imaginea actualizează automat pachetele nefixate la fiecare repornire, deci
  panoul rezolvă "latest" la un ID de versiune concret la momentul instalării și îl fixează. Actualizările sunt un
  flux explicit orchestrat (`updates/`): previzualizare → backup pre-actualizare → oprire grațioasă → re-fixare →
  recreare → monitorizare stare → rollback printr-un singur clic.
- **Suprapunerea de moduri personalizate** este gestionată de panou: modurile adăugate de utilizator ajung în biblioteca deduplicată și
  sunt legate fizic în server, astfel încât să supraviețuiască actualizărilor de pachete. Dezactivarea este conștientă de clasă.
- **Porturile** sunt alocate dintr-un schemă de bază (joc de la `PORT_GAME_START` în sus, RCON = joc +
  `PORT_RCON_OFFSET`, Bedrock de la `PORT_BEDROCK_START`), verificate pentru disponibilitate și rezervate în
  baza de date.
- **Cotele de disc** sunt impuse de panou, deoarece Docker nu poate limita utilizarea bind-mount: indexatorul
  stochează în cache dimensiunile per director, iar operațiunile de creștere a discului sunt condiționate de acestea.
- **Secretele** (parole RCON, chei API, secrete TOTP, URL-ul webhook Discord) sunt criptate în repaus
  cu AES-256-GCM utilizând o cheie dedicată aleatorie la `$DATA_DIR/.secret-key` (mod `0600`,
  generată automat). Este independentă de `SESSION_SECRET`; o cheie derivată din `SESSION_SECRET` este păstrată ca
  o alternativă doar pentru decriptare pentru valorile scrise înainte ca cheia dedicată să existe, iar
  `src/services/secretsMigration.js` le re-criptează sub cheia dedicată o dată la pornire.
  Un `.secret-key` existent, dar care nu poate fi parsat, este o eroare gravă la pornire (nu este niciodată regenerat silențios
  peste cel existent). Blueprint-urile elimină toate secretele la export.

## Formate de date și de transmisie

- **`data/panel.db`** - baza de date SQLite. Copiată zilnic prin `VACUUM INTO` în
  `data/backups/_panel/` (ultimele 14 păstrate); `PRAGMA integrity_check` rulează la pornire.
- **`data/.session-secret`** - secretul auto-generat pentru semnarea cookie-urilor, creat la prima rulare dacă
  `SESSION_SECRET` nu este setat. Ștergerea acestuia rotește secretul (ceea ce invalidează sesiunile).
- **`data/.secret-key`** - cheia dedicată de 32 de octeți pentru criptarea în repaus (mod `0600`), creată automat
  la prima rulare. Independentă de `SESSION_SECRET`; ștergerea acesteia face ca fiecare credențial stocat
  să fie indecriptabil, deci aparține backup-urilor dvs.
- **Blueprint-uri (`.mcserver.zip`)** - un fișier zip cu un `manifest.json` care descrie configurația, resursele, referința la pachetul fixat, manifestul de suprapunere (URL-uri sursă + sha256), fișiere de configurare alese și, opțional, o lume. Importul re-descarcă și verifică hash-ul fiecărui mod și atribuie porturi noi.
- **Containere Docker** create de panou sunt numite și etichetate astfel încât watcher-ul să le poată găsi;
  panoul deține ciclul lor complet de viață.

## Secvența de pornire

1. `require('./instrument')` (interfața Sentry) înainte de orice altceva, apoi `require('./preflight')`
   pentru a eșua clar la o versiune Node nesuportată.
2. Se încarcă configurația; se asigură/generează `.session-secret` **și** `.secret-key`.
3. `ensureDataRoot()` - creează structura `./data`, șterge `tmp/`.
4. Se rulează migrațiile bazei de date, apoi `PRAGMA integrity_check` (loghează puternic, indică `data/backups/_panel`
   în caz de eșec).
5. Se re-criptează secretele moștenite bazate pe `SESSION_SECRET` sub `.secret-key` (`secretsMigration`).
6. Se populează blueprint-urile de pornire (protejat).
7. Se pornește serverul HTTP + WS. Pe o legătură expusă, afișează PIN-ul de primă rulare `/setup`.
8. Se instalează gardianul de rulare post-pornire (prinde erorile neprinse; `MSM_EXIT_ON_FATAL=1` îl face să iasă brusc pentru implementări supravegheate).
9. Se pornesc serviciile de fundal: broker WS, indexator de stocare, watcher-e de blocări + inventar, planificator,
   punte de evenimente Discord și **timer-ul de întreținere zilnică** (curăță rândurile vechi de analize + face snapshot la
   `panel.db`).
10. Se inițializează Docker **în fundal**. Interfața de utilizare este complet utilizabilă în timp ce daemonul este oprit;
    funcționalitățile Docker se activează când devine accesibil. Odată conectat, `refreshStatuses({ boot })`
    reconciliază stările din cache, emite un eveniment unic `offline-after-restart` pentru un server care era pornit înainte ca panoul să repornească și nu va fi repornit, iar bucla de pornire pornește
    serverele `auto_start` plus recuperează serverele `auto_restart` găsite blocate în timpul întreruperii
    (respectând backoff-ul buclei de blocare).

> Ordinea instrument-preflight este un compromis deliberat: permite ca o viitoare conexiune Sentry să
> aplice patch-ul la runtime mai întâi, cu prețul unui mesaj puțin mai puțin prietenos pe un Node cu adevărat vechi.

## Conducta de compilare

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM cu împărțirea codului). `postinstall` rulează **doar CSS**. `public/css/app.css`
și `public/dist/` sunt artefacte de compilare ignorate de git; etapa de compilare Dockerfile rulează complet
`pnpm run build` și copiază `public/` în imaginea de rulare. Fișierele statice sunt servite
`immutable`/cache lung pentru fișierele cu amprentă, cache scurt pentru CSS/JS și `no-cache` pentru HTML și
`/api`.
