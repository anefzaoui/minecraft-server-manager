---
title: 'Architettura'
description: "Minecraft Server Manager è un'applicazione Node.js renderizzata lato server, a processo singolo."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Indietro all'indice della documentazione](/docs/)

Minecraft Server Manager è un'applicazione Node.js renderizzata lato server, a processo singolo. Gestisce
server Minecraft in esecuzione come container Docker utilizzando l'immagine
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicando con il
demone Docker tramite la sua API (mai tramite shell `docker` CLI).

## Struttura di runtime

- **Express + Handlebars** renderizzano le pagine lato server. Non c'è SPA; il JS del browser in `public/js/`
  è un miglioramento progressivo scritto a mano. Un passaggio esbuild (`pnpm run build:js`) lo impacchetta e
  minimizza in `public/dist/js/`; l'app serve quel bundle quando è presente e la sorgente raw altrimenti,
  quindi un'esecuzione di sviluppo senza build funziona comunque.
- **`node:sqlite`** (integrato in Node; il pannello richiede Node ≥ 24) è il database - sincrono,
  zero moduli nativi, modalità WAL. Un piccolo runner di migrazioni versionate applica `src/db/migrations/*` all'avvio.
  Le istruzioni preparate sono memorizzate nella cache in `src/db/index.js` con chiave basata sul testo SQL.
- **`ws`** gestisce i flussi live di console e statistiche. Entrambi sono **brokerati**: un upstream
  `docker logs --follow` (o `docker stats`) per server, demuxato una volta e distribuito a ogni
  scheda connessa, piuttosto che un upstream per visualizzatore. Il broker della console mantiene un piccolo buffer di replay
  per le schede che si uniscono in ritardo e scarta un sottoscrittore il cui socket va troppo indietro piuttosto che
  bloccare il flusso condiviso.
- **dockerode** è l'unico modo in cui l'app comunica con Docker. L'endpoint viene rilevato automaticamente per piattaforma
  (named pipe Windows vs. socket Unix).
- **Tutto lo stato persistente vive sotto una directory** (`$DATA_DIR`, predefinito `./data`). Copiare quella
  directory migra l'intero pannello.

## Struttura a livelli

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

- **`web/routes/`** - un router per dominio (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` monta quelli di primo livello (`api.js`, l'API JSON di sessione che contiene anche le rotte principali del server e monta i router di dominio per server; `index.js`, le pagine; `auth`, `account`,
  `tasks`, …). I router validano con zod, chiamano un servizio e restituiscono JSON
  o renderizzano una vista. La logica di business non appartiene qui. Due router sono montati nella **zona pubblica**,
  prima di `requireAuth`: `routes/status.js` (pagine di stato per server opzionali) e
  `routes/apiV1.js` (`/api/v1`, un'API JSON di sola lettura autenticata da un token Bearer emesso dall'admin
  da `services/apiTokens.js`, disattivata se non abilitata nelle Impostazioni; vedi `docs/public-api.md`).
- **`services/`** - il cuore dell'app. Ogni servizio possiede un dominio e può dipendere dall'infrastruttura
  e da altri servizi.
- **`docker/`** - wrapper dockerode: `connect` (rilevamento endpoint + stato daemon), `containers`
  (crea/avvia/ferma/ricrea con bind mount, limiti di memoria/CPU ed etichette), `logs`, `stats`,
  `images`, `networks` (scoperta rete host), `hostPath` (ri-radica i percorsi di bind sotto
  `DATA_DIR_HOST`), e un `watcher` che trasforma gli eventi Docker in cronologia + rilevamento crash.
- **`db/`** - il wrapper SQLite e il runner di migrazioni.
- **`storage/`** - il bootstrap di `./data`, il **guardiano dei percorsi** (`safeJoin`, la spina dorsale di sicurezza dei file),
  e l'indicizzatore di dimensioni in background + applicazione delle quote.

Trasversale:

- **`config/`** - configurazione dell'ambiente più il **catalogo dei campi**: l'unica fonte di verità per
  le impostazioni del server. Ogni variabile d'ambiente itzg è catalogata (etichetta, aiuto, tipo, unità, predefinito,
  validazione, sezione, flag di pericolo). La procedura guidata, i moduli delle impostazioni e la validazione zod sono tutti derivati
  da esso, quindi esporre una nuova impostazione è una modifica dei dati, non una nuova infrastruttura UI.
- **`events/`** - `recordEvent()` è l'unico punto di ingresso per il log della cronologia; gli eventi del ciclo di vita catturano anche estratti di log del container in `data/logs/<id>/events/`.
- **`ws/`** - WebSockets autenticati per console + statistiche (cookie di sessione verificato all'upgrade, `Origin` controllato per bloccare dirottamenti cross-site), brokerati per server (vedi "Struttura di runtime").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` restituisce un logger [Pino](https://getpino.io) per modulo; livello da `LOG_LEVEL`, `makeFailureThrottle()` mantiene un loop in background persistentemente fallimentare a una riga di log più una riga "recuperata".
  `src/utils/logSanitize.js` redige chiavi a forma di credenziale e token webhook dai metadati strutturati; `src/config/logLevel.js` è la whitelist di livello condivisa (tenuta separata per evitare un ciclo di require con `config`). `src/instrument.js` è una porta Sentry dormiente, caricata per prima in
  `src/server.js`. `src/web/middleware/requestLog.js` scrive una riga di access-log per richiesta (saltando `/healthz` e asset statici). ESLint impone `no-console` sotto `src/**`, con
  `preflight.js`, `instrument.js`, e `config/index.js` esentati (eseguiti prima che il logger esista).
- **Limitazione della frequenza** - `src/web/middleware/rateLimit.js` inserisce `express-rate-limit` davanti a `/api`
  (`RATE_LIMIT_API_PER_MIN`, predefinito 1200) e i POST di login / 2FA / setup
  (`RATE_LIMIT_AUTH_PER_15MIN`, predefinito 100); `0` disabilita un limiter. Si basa su `req.ip`, quindi
  `TRUST_PROXY` è importante dietro un proxy. `/api/v1` ha i suoi limiter: un limite per IP client
  (cinque volte il budget per token) che viene eseguito prima che il token venga verificato, quindi un budget per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, predefinito 120) basato sull'ID del token verificato. Un
  contatore soft separato per account in
  `src/web/middleware/auth.js` gestisce il blocco del login (per IP e globale per account, in decadimento).
- **Autorizzazione**: due livelli. Il ruolo globale (`requireAuth` → `requireRole` / `requireWrite` in
  `src/web/middleware/auth.js`) blocca le azioni a livello di pannello ed è il predefinito su ogni server. Le autorizzazioni per server
  (`src/services/permissions.js`, nove capacità memorizzate come elenco JSON per
  `(utente, server)` in `user_server_permissions`) affinano il predefinito per un server; ogni
  rotta `/api/servers/:id`, montaggio di sottorouter, pagina, WebSocket e elenco a livello di flotta passa attraverso
  `src/web/middleware/serverAccess.js` (`serverScope`, montato sul prefisso `/servers/:id` sia dell'API che del router di pagine, nasconde un server senza `view` come 404; `requireCap(cap)` nomina la capacità richiesta da una rotta). Le scritture che nominano il loro server nel corpo (pianificazioni, estrazione e installazione del mondo, esportazione blueprint) sono aperte agli spettatori solo da `requireWrite` per quel server, e ogni rotta di questo tipo controlla essa stessa la capacità. `test/permissions-routes.test.js` attraversa gli stack del router live e fallisce se una rotta di scrittura con ambito server, un montaggio o una pagina non ha un gate.

## Comportamenti chiave del dominio

- **I Modpack sono sempre bloccati.** L'immagine aggiorna automaticamente i pack non bloccati ad ogni riavvio, quindi il pannello risolve "latest" in un ID di versione concreto al momento dell'installazione e lo blocca. Gli aggiornamenti sono un flusso esplicito orchestrato (`updates/`): anteprima → backup pre-aggiornamento → arresto grazioso → ri-blocco → ricreazione → monitoraggio integrità → rollback con un clic.
- **L'overlay di mod personalizzato** è gestito dal pannello: le mod aggiunte dall'utente atterrano nella libreria deduplicata e vengono collegate in modo rigido al server in modo che sopravvivano agli aggiornamenti del pack. La disabilitazione è consapevole della classe. Poiché la libreria conserva ogni build scaricata, un aggiornamento registra la build che ha sostituito (`server_content.previous_*`) e può essere ripristinata dai soli file locali. La disabilitazione di una mod del pack scrive invece la variabile d'ambiente di esclusione del pack; `packs.applyPack` trasporta quella e il resto della configurazione del pack (`PACK_TUNING_KEYS`) attraverso una modifica di versione dello stesso pack, e la elimina quando il pack cambia.
- **Un aggiornamento della versione di Minecraft deve essere guadagnato.** `services/compat.js` scansiona le mod di un server - risolte dalle righe installate dal pannello, quindi dal manifest del pack CurseForge, quindi per hash del contenuto rispetto a Modrinth/CurseForge - e costruisce una matrice di supporto (loader, versione Minecraft) per progetto dalle `latestFilesIndexes` di CurseForge (200 progetti per richiesta) e dall'elenco delle versioni per progetto di Modrinth (una richiesta per progetto, che è ciò che mantiene accoppiati loader e versione). Il checker di aggiornamento offre solo la versione più recente supportata da OGNI mod, e non offre nulla quando la risposta non può essere stabilita: nessuna scansione, una scansione per una versione o loader diversa, una che non è mai stata completata, o un jar che nessun registro riconosce. Le scansioni sono solo manuali, e il loro progresso e i risultati parziali vivono in `version_compat` (non in `services/tasks.js` in memoria), quindi un aggiornamento o un riavvio del pannello riprende invece di bloccarsi su un indicatore; `reconcileScans()` contrassegna le scansioni orfane da uno spegnimento al successivo avvio.
- **La versione del mod loader è un pin, come tutto il resto.** `services/loaderPin.js` legge la build installata dal manifest di installazione dell'immagine stessa (`.forge-manifest.json` e simili) e scrive il pin: la variabile itzg del loader su un server normale (`FORGE_VERSION`, …), o
  `CF_MOD_LOADER_VERSION` su un pack CurseForge Forge o Fabric, che sovrascrive la versione dichiarata dal pack. L'installer CurseForge dell'immagine ignora tale sovrascrittura per NeoForge, e i pack Modrinth e FTB non ne hanno, quindi il loro loader segue il pack. `packs.applyPack` rimuove tutte le variabili `CF_` durante un aggiornamento o rollback del pack, che elimina una sovrascrittura con il resto. Una build tipizzata viene controllata prima rispetto all'elenco completo del registro (`services/loaderVersions.js`; quello di Forge proviene dai suoi metadati maven, che saltano i numeri; una mancata corrispondenza viene ricontrollata una volta rispetto al registro stesso), quindi la modifica viene sottoposta a backup → pin (sopra l'env così com'è dopo il backup) → ricostruzione.
- **Le porte** vengono allocate da uno schema di base (gioco da `PORT_GAME_START` in su, RCON = gioco +
  `PORT_RCON_OFFSET`, Bedrock da `PORT_BEDROCK_START`), sondate per disponibilità e riservate nel DB. "Occupato" è l'unione di tutte le rivendicazioni di ogni server (porte live, più una coppia in sospeso sotto),
  ogni porta host che qualsiasi container Docker pubblica (`containers.publishedHostPorts`: binding live dei container in esecuzione più quelli configurati di ogni container fermato, perché una sonda di bind del sistema operativo dall'interno del container del pannello vede solo lo spazio di rete di quel container), e la sonda del sistema operativo. La parte Docker è memorizzata nella cache per 3 secondi e limitata: un elenco che non risponde in 2,5 secondi scarta solo la parte Docker, e un ispezione lenta costa solo le porte di quel container. La creazione del server e `servers.changeGamePort` scelgono le porte attraverso una catena di serializzazione che copre solo la scelta e la sua rivendicazione (la scrittura della riga per una creazione, la prenotazione in memoria per una modifica della porta);
  il selettore di porte di BlueMap e le sovrascritture di porte aggiuntive non sono inclusi e non
  consultano Docker. Una modifica della porta su un server esistente (`servers.changeGamePort`, sotto il blocco op del server) viene applicata immediatamente, perché Docker corregge i binding delle porte alla creazione del container: la nuova coppia (RCON sempre gioco + `PORT_RCON_OFFSET`) viene controllata e riservata in memoria
  (`ports.reserve`, sia la vecchia che la nuova coppia, onorate da ogni altra scelta) sotto il blocco della porta. Viene rifiutata (409 `PENDING_CHANGES`) mentre altre impostazioni attendono una ricostruzione, quindi ricostruisce solo un container che è già stato eseguito, su una nuova porta; e un server in esecuzione viene modificato solo quando la richiesta dice `restart: true` (altrimenti 409 `NEEDS_CONFIRM`). L'immagine viene scaricata e viene controllato un nome di container personalizzato prima che venga toccato qualcosa. Un server in esecuzione viene fermato; quindi la nuova coppia viene scritta con `pending_recreate = 1` (quindi un crash del pannello da lì lascia un onesto "ricostruzione in sospeso"), il container rimosso, ricostruito sulla nuova coppia e avviato. Se un passaggio dopo l'arresto fallisce, `putBackOnOldPort` riscrive la vecchia coppia, ricostruisce (e riavvia, se era in esecuzione) su di essa e registra quale passaggio è fallito; la cronologia e gli avvisi indicano se anche quello è fallito, il che lascia il server fermo finché qualcuno non lo avvia. La capacità `settings` è sufficiente, incluso il server in esecuzione. I non amministratori possono scegliere solo da `PORT_GAME_START` in su.
  (Le colonne `port_*_pending` della migrazione 029 appartengono a un design precedente, non rilasciato, e non vengono utilizzate; 031 le cancella.) Una collisione di blocco risponde con 409 e `code: 'BUSY'`, che i chiamanti che ritentano controllano piuttosto che la dicitura. Un riavvio automatico in caso di crash
  (`watcher.restartAfterCrash`) e un backup o avvio pianificato (`scheduler.runTaskWithRetry`)
  che trovano il server occupato da un'altra azione tentano di nuovo ogni 20 s / 60 s per un massimo di 30 minuti,
  e un aggiornamento o rollback del pack ritenta i suoi passaggi bloccati allo stesso modo (`opLock.retryWhileBusy`);
  un riavvio in caso di crash o un avvio pianificato in attesa si arrendono una volta che qualcuno ha fermato, ucciso o
  avviato il server da allora (`events.lifecycleActionSince`), e il riavvio in caso di crash anche quando
  il riavvio automatico è disattivato o il server è scomparso. Riavvii, arresti e comandi pianificati non vengono ritentati, e una pianificazione la cui ultima esecuzione è ancora in attesa salta il suo prossimo avvio.
- **Le quote disco** sono applicate dal pannello perché Docker non può limitare l'utilizzo dei bind-mount: l'indicizzatore memorizza nella cache le dimensioni per directory e le operazioni di crescita del disco sono bloccate su di esse.
- **I segreti** (password RCON, chiavi API, segreti TOTP, URL webhook Discord) sono crittografati a riposo con AES-256-GCM utilizzando una chiave casuale dedicata in `$DATA_DIR/.secret-key` (modalità `0600`, generata automaticamente). È indipendente da `SESSION_SECRET`; una chiave derivata da `SESSION_SECRET` viene mantenuta come fallback solo per decrittazione per i valori scritti prima che la chiave dedicata esistesse, e
  `src/services/secretsMigration.js` li ricrittografa sotto la chiave dedicata una volta all'avvio.
  Un `.secret-key` esistente ma non analizzabile è un errore di avvio grave (non viene mai rigenerato silenziosamente). I blueprint eliminano tutti i segreti all'esportazione.
- **`server.properties` è di proprietà del pannello ma ombreggiato dall'ambiente.** L'immagine itzg riafferma ogni
  proprietà basata sull'ambiente ad ogni avvio (`OVERRIDE_SERVER_PROPERTIES` predefinito true), quindi un valore che
  il pannello modifica direttamente - PvP/difficoltà dei Controlli Mondo, l'interruttore whitelist, l'editor File -
  verrebbe silenziosamente ripristinato al prossimo avvio a meno che la variabile d'ambiente corrispondente non venga rimossa e il
  container ricreato. Ogni scrittura diretta di proprietà passa attraverso `writeServerProperties()` (intero file)
  o `setServerProperty()` (una chiave) in `src/services/servers.js`, che riscrivono atomicamente il file, deselezionano la variabile d'ambiente dietro ogni chiave modificata (tramite l'attributo `prop:` sui campi del catalogo, controllato nei test rispetto alle definizioni delle proprietà dell'immagine stessa), e contrassegnano
  `pending_recreate`. La difficoltà viene scritta nel file e inviata tramite RCON, perché un server dedicato riapplica la proprietà `difficulty` ad ogni avvio. Minecraft stesso risalva server.properties dai suoi valori all'avvio alla modifica di `whitelist on/off`, il che annullerebbe le modifiche apportate mentre il server è in esecuzione, quindi l'interruttore whitelist in esecuzione esegue uno snapshot del file prima e lo riscrive con modificato solo `white-list`. L'ambiente
  le variabili rimangono completamente configurabili alla creazione (la procedura guidata le renderizza e si applicano una volta); si "sganciano" solo la prima volta che il pannello modifica la proprietà sottostante. MOTD ha lo stesso contratto: una modifica diretta del file `motd` la deseleziona, quindi vince l'ultima scrittura.

## Formati dati e di trasmissione

- **`data/panel.db`** - il database SQLite. Snapshot giornaliero tramite `VACUUM INTO` a
  `data/backups/_panel/` (mantenuti gli ultimi 14); `PRAGMA integrity_check` viene eseguito all'avvio.
- **`data/.session-secret`** - il segreto di firma dei cookie generato automaticamente, creato al primo avvio se
  `SESSION_SECRET` non è impostato. Eliminarlo ruota il segreto (il che invalida le sessioni).
- **`data/.secret-key`** - la chiave di crittografia dedicata a riposo da 32 byte (modalità `0600`), creata automaticamente al primo avvio. Indipendente da `SESSION_SECRET`; eliminarla rende ogni credenziale memorizzata indecifrabile, quindi appartiene ai tuoi backup.
- **Blueprint (`.mcserver.zip`)** - uno zip con un `manifest.json` che descrive la configurazione, le risorse, il riferimento al pack bloccato, il manifest dell'overlay (URL sorgente + sha256), i file di configurazione scelti e opzionalmente un mondo. L'importazione ri-scarica e verifica tramite hash ogni mod e assegna nuove porte.
- **Container Docker** creati dal pannello sono nominati ed etichettati in modo che il watcher possa trovarli;
  il pannello possiede il loro intero ciclo di vita.

## Sequenza di avvio

1. `require('./instrument')` (la porta Sentry) prima di tutto, poi `require('./preflight')`
   per fallire chiaramente su una versione Node non supportata.
2. Carica la configurazione; assicurati/genera `.session-secret` **e** `.secret-key`.
3. `ensureDataRoot()` - crea la struttura `./data`, pulisci `tmp/`.
4. Esegui le migrazioni DB, poi `PRAGMA integrity_check` (registra rumorosamente, punta a `data/backups/_panel`
   in caso di fallimento).
5. Ricrittografa eventuali segreti legacy con chiave `SESSION_SECRET` sotto `.secret-key` (`secretsMigration`).
6. Importa le chiavi API dall'ambiente una volta (`apiKeys.importFromEnvOnce()`), blocca qualsiasi server che porta ancora un selettore di modpack non bloccato (`packPins.pinUnpinnedServers()`), contrassegna le scansioni di compatibilità versione lasciate in esecuzione da un processo precedente come interrotte
   (`compat.reconcileScans()`), quindi popola i blueprint iniziali (protetti).
7. Avvia il server HTTP + WS. Su un bind esposto, stampa il PIN `/setup` della prima esecuzione.
8. Installa la guardia di runtime post-avvio (cattura guasti non gestiti; `MSM_EXIT_ON_FATAL=1` lo fa uscire forzatamente per distribuzioni supervisionate).
9. Avvia i servizi in background: broker WS, indicizzatore di storage, watcher di crash + inventario, scheduler,
   ponte eventi Discord, watcher di outreach chatbot e il **timer di manutenzione giornaliero** (pulisce vecchie righe di analytics, trascrizioni chatbot, cronologia eventi (365 giorni) e righe della cache API, quindi esegue lo snapshot di
   `panel.db`).
10. Inizializza Docker **in background**. L'interfaccia utente è completamente utilizzabile mentre il demone è spento;
    le funzionalità Docker si attivano quando diventa raggiungibile. Una volta connesso, `refreshStatuses({ boot })`
    riconcilia gli stati memorizzati nella cache, emette un evento una tantum `offline-after-restart` per un server che era attivo prima che il pannello si riavviasse e non verrà ripristinato, e il loop di avvio avvia i server `auto_start` più recupera i server `auto_restart` trovati in crash durante l'interruzione
    (rispettando il backoff del loop di crash).

> L'ordine instrument-before-preflight è un compromesso deliberato: consente a un futuro wiring Sentry
> di patchare il runtime per primo, al costo di un messaggio leggermente meno amichevole su un Node veramente antico.

## Pipeline di build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM con code-splitting). `postinstall` esegue **solo CSS**. `public/css/app.css`
e `public/dist/` sono artefatti di build ignorati da git; la fase di build del Dockerfile esegue il completo
`pnpm run build` e copia `public/` nell'immagine di runtime. Gli asset statici vengono serviti
`immutable`/long-cache per i file con fingerprint, short-cache per CSS/JS, e `no-cache` per HTML e
`/api`.
