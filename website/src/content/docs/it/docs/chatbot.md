---
title: 'Chatbot per server Minecraft'
description: "Questo fork aggiunge una chatbot configurabile dall'amministratore a ciascun server Minecraft gestito."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Indietro all'indice della documentazione](/docs/)

Questo fork aggiunge una chatbot configurabile dall'amministratore a ogni server Minecraft gestito. Si connette a un endpoint compatibile con OpenAI per le completazioni di chat, incluso Ollama su un altro host LAN. Ogni server ha il proprio endpoint, modello, nome di invocazione, persona, policy di trascrizione, messaggi di outreach e policy di poteri. L'invocazione predefinita è `@wizard`, e la persona predefinita dimostra un antico e giocoso mago in-game; entrambi sono modificabili.

![Impostazioni della chatbot](/docs/images/integrations-chatbot.png)

## Esperienza del giocatore

- Qualsiasi giocatore può usare `@wizard <messaggio>` (o l'invocazione configurata) per conversare e ottenere aiuto con le ricette vanilla deterministiche e consapevoli della versione di Minecraft.
- I messaggi di benvenuto all'accesso e un promemoria configurabile una tantum per il check-in della sessione di gioco ricordano ai giocatori che la chatbot è disponibile. `@wizard chat` apre una breve finestra di conversazione opt-in; `@wizard bye` la chiude.
- Gli **utenti base** possono invocare poteri self/world abilitati. I **controllori di poteri** possono invocare azioni convalidate separatamente che influenzano un altro giocatore online. I giocatori che non appartengono a nessuno di questi gruppi rimangono limitati alla sola conversazione.
- I regali self-gift degli utenti base utilizzano una lista di ammessi per gli oggetti. I controllori possono dare a un altro giocatore qualsiasi oggetto vanilla o moddato valido con namespace, soggetti al limite di quantità e ad altre salvaguardie dei poteri.

![Trascrizioni della chatbot](/docs/images/chatbot-transcripts.png)

## Progettazione e sicurezza

La configurazione e le trascrizioni sono riservate agli amministratori. Il modello non riceve mai RCON grezzo o esecuzione di comandi arbitrari. Un messaggio espone solo lo strumento fisso singolo che corrisponde al suo intento esplicito; il codice del server convalida autorizzazione, argomenti, flag, quantità, cooldown e nomi esatti dei giocatori online prima di eseguire un'operazione di servizio esistente. I selettori di Minecraft vengono rifiutati, le azioni cross-player non possono bersagliare il chiamante, i poteri iniziano in modalità dry-run e ogni potere tentato viene registrato. I modelli di chiamata a strumenti non supportati tornano alla sola conversazione.

Le risposte sono limitate per la chat di Minecraft. Le ricette vanilla conosciute provengono da dati di ricette versionati inclusi e vengono visualizzate come righe stabili 2x2/3x3; l'LLM non è considerato affidabile per inventare layout di ricette. Ricette sconosciute o moddate indirizzano il giocatore a JEI/REI piuttosto che fabbricare una risposta.

## File di implementazione principali

- `src/services/wizard.js`: configurazione per server, richieste compatibili con OpenAI, gestione chat, outreach, conservazione trascrizioni e limiti di risposta.
- `src/services/wizardPowers.js`: controlli ruoli, schemi strumenti specifici per intento, validazione, esecuzione, cooldown e auditing dei poteri.
- `src/services/wizardRecipes.js`: lookup deterministico di ricette versionate e formattazione griglia. Dati di ricette e oggetti provengono dal pacchetto [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) incluso. (Una bozza precedente di questo documento puntava a una cartella `src/data/recipes/` che non è mai stata committata; non esiste tale cartella e i dati risiedono nel pacchetto. Vedi "Impronta delle dipendenze".)
- `src/analytics/ingest.js`: inoltra join, leave e chat dei giocatori analizzati alla chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` e `views/partials/server/integrations.hbs`: API admin e UI Integrazioni per server.
- `src/db/migrations/011_wizard_chat.js` fino a `019_wizard_power_controllers.js`: schema persistente.
- `test/wizard.test.js`: test di autorizzazione, limiti strumenti, conservazione, outreach e comportamento chat.

I nomi interni delle route/moduli/tabelle `wizard` sono mantenuti per compatibilità di aggiornamento e API; "chatbot" è il termine di prodotto rivolto all'utente. Allo stesso modo, il campo memorizzato `power_testers_json` corrisponde al gruppo **Utenti base** dell'UI.

## Impronta delle dipendenze (`minecraft-data`)

L'aiuto con le ricette utilizza il pacchetto `minecraft-data`. È grande su disco (circa 429 MB installato) e viene spedito all'interno dell'immagine di produzione perché è una dipendenza runtime, non di sviluppo. Lo manteniamo di proposito in modo che l'aiuto con le ricette funzioni offline per ogni versione di Minecraft senza chiamate di rete.

Note per chiunque guardi questo in futuro (umano o AI), in modo che la dimensione non sia una sorpresa:

- Al momento viene utilizzato solo il dato Java (`pc`). `wizardRecipes.js` legge `minecraftData.versions.pc` e le tabelle per-versione `recipes`, `items` e `blocks`. I file che tocca effettivamente sommano a circa 15 MB per ogni versione pc.
- Circa 330 MB del pacchetto sono `data/bedrock`, e nulla qui lo legge ancora. Lo lasciamo in posizione di proposito. Se il pannello aggiungesse mai il supporto per Minecraft Bedrock, i dati delle ricette e degli oggetti Bedrock sono già qui, quindi la funzionalità ricette può crescere per coprire i server Bedrock senza aggiungere una nuova dipendenza. Inizia da `minecraftData.versions.bedrock` e segui la stessa forma del percorso pc.
- Se la dimensione dovesse mai ridursi prima che arrivi il supporto Bedrock, c'è già uno schema per farlo in questo repository. `src/services/itemRegistry.js` recupera i file `minecraft-data` dal CDN jsDelivr quando ne ha bisogno e li memorizza nella cache in `api_cache`. O quell'approccio, o un piccolo sottoinsieme scelto a mano `src/data/recipes/` che copre alcune versioni comuni, ridurrebbe notevolmente l'immagine.

## Archiviazione locale e ispezione manuale

Tutte le impostazioni e le trascrizioni conservate risiedono nel database SQLite del pannello in `/data/panel.db` all'interno del container del pannello. Con il mount Compose standard, il percorso host è `${DATA_DIR_HOST}/panel.db` (ad esempio `/opt/msm/data/panel.db`). Le tabelle pertinenti sono `wizard_configs`, `wizard_transcripts` e `wizard_outreach`; gli audit dei poteri sono righe nella tabella `events` con tipo `wizard-power`. La chiave API LLM opzionale è crittografata AES-256-GCM utilizzando il `SESSION_SECRET` del pannello, normalmente persistito come `${DATA_DIR_HOST}/.session-secret`.

Esegui il backup del database e arresta il pannello prima di modifiche dirette a SQLite in modo che il suo WAL venga gestito in sicurezza. L'uso dell'interfaccia utente/API admin è preferito perché applica la validazione e la crittografia. Mantieni insieme i file `panel.db`, `panel.db-wal` e `panel.db-shm` quando copi un database live.
