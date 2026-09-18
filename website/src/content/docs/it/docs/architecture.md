---
title: 'Architettura'
description: "Minecraft Server Manager è un'applicazione Node.js renderizzata lato server, a processo singolo."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Indice della documentazione](/docs/)

Minecraft Server Manager è un'applicazione Node.js renderizzata lato server, a processo singolo. Gestisce
server Minecraft che vengono eseguiti come container Docker utilizzando l'immagine
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicando con il
demone Docker tramite la sua API (mai richiamando la CLI `docker`).

## Struttura di runtime

- **Express + Handlebars** renderizzano le pagine lato server. Non c'è una SPA; il JS del browser in `public/js/`
  è un'enhancement progressiva scritta a mano. Un passaggio esbuild (`pnpm run build:js`) lo impacchetta e
  minimizza in `public/dist/js/`; l'app serve quel bundle quando è presente e la sorgente raw altrimenti,
  quindi un'esecuzione di sviluppo senza build funziona comunque.
- **`node:sqlite`** (integrato in Node; il pannello richiede Node ≥ 24) è il database: sincrono,
  zero moduli nativi, modalità WAL. Un piccolo runner di migrazioni versionate applica `src/db/migrations/*` all'avvio.
  Le istruzioni preparate vengono memorizzate nella cache in `src/db/index.js` con chiave il testo SQL.
- **`ws`** gestisce gli stream live di console e statistiche. Entrambi sono **brokerati**: un upstream
  `docker logs --follow` (o `docker stats`) per server, demuxato una volta e distribuito a ogni
  scheda connessa, piuttosto che un upstream per visualizzatore. Il broker della console mantiene un piccolo buffer di replay
  per le schede che si uniscono in ritardo e scarta un sottoscrittore il cui socket va troppo indietro piuttosto che
  bloccare lo stream condiviso.
- **dockerode** è l'unico modo in cui l'app comunica con Docker. L'endpoint viene rilevato automaticamente per piattaforma
  (named pipe di Windows vs. socket Unix).
- **Tutto lo stato persistente vive sotto un'unica directory** (`$DATA_DIR`, predefinito `./data`). Copiare quella
  directory migra l'intero pannello.

## Livelli

Le dipendenze fluiscono in una sola direzione:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   analizza e valida l'input, modella le risposte
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   logica di dominio (le funzionalità effettive)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruttura
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - un router per dominio (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), montato in `web/app.js`. I router validano con zod, chiamano un servizio e restituiscono JSON
  o renderizzano una vista. La logica di business non appartiene qui. Due router sono montati nella **zona pubblica
  **, prima di `requireAuth`: `routes/status.js` (pagine di stato HTML per server opzionali) e
  `routes/apiV1.js` (`/api/v1`, un'API JSON di sola lettura autenticata da un token Bearer emesso dall'admin
  da `services/apiTokens.js`, disattivata se non abilitata nelle Impostazioni; vedi `docs/public-api.md`).
- **`services/`** - il cuore dell'app. Ogni servizio possiede un dominio e può dipendere dall'infrastruttura
  e da altri servizi.
- **`docker/`** - wrapper dockerode: `connect` (rilevamento endpoint + stato daemon), `containers`
  (crea/avvia/ferma/ricrea con bind mount, limiti di memoria/CPU e label), `logs`, `stats`,
  `images`, e un `watcher` che trasforma gli eventi Docker in cronologia + rilevamento crash.
- **`db/`** - il wrapper SQLite e il runner di migrazioni.
- **`storage/`** - il bootstrap di `./data`, il **guardiano dei percorsi** (`safeJoin`, la spina dorsale di sicurezza dei file), e l'indicizzatore di dimensioni in background + applicazione delle quote.

Trasversale:

- **`config/`** - configurazione dell'ambiente più il **catalogo dei campi**: l'unica fonte di verità per le impostazioni del server. Ogni variabile d'ambiente itzg è catalogata (etichetta, aiuto, tipo, unità, predefinito,
  validazione, sezione, flag di pericolo). La procedura guidata, i moduli di impostazione e la validazione zod sono tutti derivati da esso, quindi esporre una nuova impostazione è una modifica dei dati, non una nuova infrastruttura UI.
- **`events/`** - `recordEvent()` è l'unico punto di ingresso per il log della cronologia; gli eventi del ciclo di vita catturano anche estratti dei log dei container in `data/logs/<id>/events/`.
- **`ws/`** - WebSockets autenticati per console + statistiche (cookie di sessione verificato all'upgrade, `Origin` controllato per bloccare dirottamenti cross-site), brokerati per server (vedi "Struttura di runtime").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` restituisce un logger [Pino](https://getpino.io) per modulo; livello da `LOG_LEVEL`, `makeFailureThrottle()` mantiene un loop di background che fallisce persistentemente a una sola riga di log più una riga "recuperata".
  `src/utils/logSanitize.js` redige chiavi a forma di credenziali e token webhook dai metadati strutturati; `src/config/logLevel.js` è la whitelist di livello condivisa (mantenuta separata per evitare un ciclo di require con `config`). `src/instrument.js` è una cucitura Sentry dormiente, caricata per prima in
  `src/server.js`. `src/web/middleware/requestLog.js` scrive una riga di access-log per richiesta
  (saltando `/healthz` e asset statici). ESLint applica `no-console` sotto `src/**`, con
  `preflight.js`, `instrument.js`, e `config/index.js` esentati (eseguiti prima che il logger esista).
- **Limitazione della frequenza** - `src/web/middleware/rateLimit.js` posiziona `express-rate-limit` davanti a `/api`
  (`RATE_LIMIT_API_PER_MIN`, predefinito 1200) e ai POST di login / 2FA / setup
  (`RATE_LIMIT_AUTH_PER_15MIN`, predefinito 100); `0` disabilita un limiter. Si basa su `req.ip`, quindi
  `TRUST_PROXY` è importante dietro un proxy. `/api/v1` ha il suo limiter per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, predefinito 120), basato su un hash del token Bearer con fallback IP. Un contatore soft separato per account in
  `src/web/middleware/auth.js` gestisce il blocco del login (per IP e globale per account, in decadimento).

## Comportamenti chiave del dominio

- **I Modpack sono sempre bloccati.** L'immagine aggiorna automaticamente i pack non bloccati ad ogni riavvio, quindi il pannello risolve "latest" in un ID di versione concreto al momento dell'installazione e lo blocca. Gli aggiornamenti sono un flusso esplicito orchestrato (`updates/`): anteprima → backup pre-aggiornamento → arresto grazioso → ri-blocco → ricreazione → monitoraggio integrità → rollback con un clic.
- **L'overlay di mod personalizzate** è gestito dal pannello: le mod aggiunte dall'utente finiscono nella libreria deduplicata e vengono collegate simbolicamente al server in modo che sopravvivano agli aggiornamenti dei pack. La disabilitazione è consapevole della classe.
- **Le porte** vengono allocate da uno schema di base (gioco da `PORT_GAME_START` in su, RCON = gioco +
  `PORT_RCON_OFFSET`, Bedrock da `PORT_BEDROCK_START`), sondate per disponibilità e riservate nel DB.
- **Le quote disco** vengono applicate dal pannello perché Docker non può limitare l'utilizzo dei bind-mount: l'indicizzatore memorizza nella cache le dimensioni per directory e le operazioni di crescita del disco sono vincolate da esse.
- **I segreti** (password RCON, chiavi API, segreti TOTP, URL webhook Discord) sono crittografati a riposo con AES-256-GCM utilizzando una chiave dedicata casuale in `$DATA_DIR/.secret-key` (modalità `0600`, generata automaticamente). È indipendente da `SESSION_SECRET`; una chiave derivata da `SESSION_SECRET` viene mantenuta come fallback di sola decrittazione per i valori scritti prima che esistesse la chiave dedicata, e
  `src/services/secretsMigration.js` li ricrittografa sotto la chiave dedicata una volta all'avvio.
  Un `.secret-key` esistente ma non parsabile è un errore di avvio grave (non viene mai rigenerato silenziosamente
  soprascrivendolo). I blueprint eliminano tutti i segreti all'esportazione.

## Formati dati e di trasmissione

- **`data/panel.db`** - il database SQLite. Snapshot giornaliero tramite `VACUUM INTO` a
  `data/backups/_panel/` (mantenuti i 14 più recenti); `PRAGMA integrity_check` viene eseguito all'avvio.
- **`data/.session-secret`** - il segreto di firma dei cookie generato automaticamente, creato al primo avvio se
  `SESSION_SECRET` non è impostato. Eliminarlo ruota il segreto (il che invalida le sessioni).
- **`data/.secret-key`** - la chiave di crittografia dedicata a riposo da 32 byte (modalità `0600`), creata automaticamente
  al primo avvio. Indipendente da `SESSION_SECRET`; eliminarla rende ogni credenziale memorizzata
  indecifrabile, quindi appartiene ai tuoi backup.
- **Blueprint (`.mcserver.zip`)** - uno zip con un `manifest.json` che descrive la configurazione, le risorse, il riferimento al pack bloccato, il manifest dell'overlay (URL sorgente + sha256), i file di configurazione scelti e
  opzionalmente un mondo. L'importazione riscarica e verifica tramite hash ogni mod e assegna nuove porte.
- **Container Docker** creati dal pannello sono nominati ed etichettati in modo che il watcher possa trovarli;
  il pannello possiede il loro intero ciclo di vita.

## Sequenza di avvio

1. `require('./instrument')` (la cucitura Sentry) prima di qualsiasi altra cosa, poi `require('./preflight')`
   per fallire chiaramente su una versione di Node non supportata.
2. Carica la configurazione; assicurati/genera `.session-secret` **e** `.secret-key`.
3. `ensureDataRoot()` - crea la struttura `./data`, pulisci `tmp/`.
4. Esegui le migrazioni del DB, poi `PRAGMA integrity_check` (registra rumorosamente, punta a `data/backups/_panel`
   in caso di fallimento).
5. Ricrittografa eventuali segreti legacy con chiave `SESSION_SECRET` sotto `.secret-key` (`secretsMigration`).
6. Inserisci i blueprint iniziali (protetti).
7. Avvia il server HTTP + WS. Su un bind esposto, stampa il PIN `/setup` del primo avvio.
8. Installa la guardia di runtime post-avvio (cattura guasti non gestiti; `MSM_EXIT_ON_FATAL=1` lo rende un'uscita forzata per distribuzioni supervisionate).
9. Avvia i servizi in background: broker WS, indicizzatore di storage, watcher di crash + inventario, scheduler,
   bridge eventi Discord, e il **timer di manutenzione giornaliero** (pulisce vecchie righe di analytics + snapshot
   `panel.db`).
10. Inizializza Docker **in background**. L'interfaccia utente è completamente utilizzabile mentre il demone è spento;
    le funzionalità Docker si attivano quando diventa raggiungibile. Una volta connesso, `refreshStatuses({ boot })`
    riconcilia gli stati memorizzati nella cache, emette un evento una tantum `offline-after-restart` per un server che era
    attivo prima che il pannello si riavviasse e non verrà ripristinato, e il loop di avvio avvia i server
    `auto_start` più recupera i server `auto_restart` trovati in crash durante l'interruzione
    (rispettando il backoff del loop di crash).

> L'ordine instrument-prima-di-preflight è un compromesso deliberato: consente a un futuro wiring Sentry di
> applicare prima il runtime, al costo di un messaggio leggermente meno amichevole su una versione di Node veramente antica.

## Pipeline di build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM con code-splitting). `postinstall` esegue **solo CSS**. `public/css/app.css`
e `public/dist/` sono artefatti di build ignorati da git; la fase di build del Dockerfile esegue il `pnpm run build` completo
e copia `public/` nell'immagine di runtime. Gli asset statici vengono serviti con cache
`immutable`/lunga per i file con fingerprint, cache breve per CSS/JS, e `no-cache` per HTML e `/api`.
