---
title: 'Chatbot Minecraft per server'
description: "Il pannello offre un chatbot configurabile dall'amministratore per ogni server Minecraft gestito, impostabile nella scheda Impostazioni → Chatbot del server."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Indietro all'indice della documentazione](/docs/)

Il pannello offre una chatbot configurata dall'amministratore per ogni server Minecraft gestito, impostata nella scheda **Impostazioni → Chatbot** del server. Si connette a un endpoint di completamento chat compatibile con OpenAI, incluso Ollama su un altro host LAN. Ogni server ha il proprio endpoint, modello, nome di invocazione, persona, policy di trascrizione, messaggi di outreach e policy di poteri. L'invocazione predefinita è `@wizard` e la persona predefinita dimostra un mago antico e giocoso nel gioco; entrambi sono modificabili.

![Impostazioni Chatbot](/docs/images/integrations-chatbot.png)

## Esperienza del giocatore

- Qualsiasi giocatore può usare `@wizard <messaggio>` (o il nome di invocazione configurato) per conversare e ottenere aiuto deterministico per le ricette vanilla, consapevole della versione di Minecraft.
- I saluti all'ingresso e un promemoria configurabile di check-in una tantum durante la sessione di gioco ricordano ai giocatori che la chatbot è disponibile. `@wizard chat` apre una breve finestra di conversazione opt-in; `@wizard bye` la chiude.
- Gli **utenti base** possono invocare poteri self/world abilitati. I **controllori di poteri** possono invocare azioni convalidate separatamente che influenzano un altro giocatore online. I giocatori che non appartengono a nessuno dei due gruppi rimangono solo in modalità conversazione.
- I self-gift degli utenti base utilizzano un'allowlist di oggetti. I controllori possono dare a un altro giocatore qualsiasi oggetto vanilla o moddato valido con namespace, soggetto al limite di quantità e ad altre misure di sicurezza dei poteri.

![Trascrizioni Chatbot](/docs/images/chatbot-transcripts.png)

## Progettazione e sicurezza

La configurazione e le trascrizioni sono riservate agli amministratori. Il modello non riceve mai RCON grezzo o esecuzione di comandi arbitrari. Un messaggio espone solo l'unico strumento fisso che corrisponde al suo intento esplicito; il codice del server convalida autorizzazione, argomenti, flag, quantità, cooldown e nomi esatti dei giocatori online prima di eseguire un'operazione di servizio esistente. I selettori di Minecraft vengono rifiutati, le azioni cross-player non possono prendere di mira il chiamante, i poteri iniziano in modalità dry-run e ogni potere tentato viene registrato. I modelli di tool-calling non supportati tornano alla sola conversazione.

Le risposte sono limitate per la chat di Minecraft. Le ricette vanilla conosciute provengono da dati di ricette versionati inclusi e vengono visualizzate come righe stabili 2x2/3x3; l'LLM non è considerato affidabile per inventare layout di ricette. Le ricette sconosciute o moddate indirizzano il giocatore a JEI/REI piuttosto che fabbricare una risposta.

## File di implementazione principali

- `src/services/wizard.js`: configurazione per server, richieste compatibili con OpenAI, gestione chat, outreach, conservazione trascrizioni e limiti di risposta.
- `src/services/wizardPowers.js`: controlli ruoli, schemi di tool specifici per intento, validazione, esecuzione, cooldown e auditing dei poteri.
- `src/services/wizardRecipes.js`: ricerca deterministica di ricette versionate e formattazione griglia. Dati di ricette e oggetti provengono dal pacchetto [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) incluso. (Una bozza precedente di questo documento puntava a una cartella `src/data/recipes/` che non è mai stata committata; non esiste tale cartella e i dati risiedono nel pacchetto. Vedi "Impronta delle dipendenze".)
- `src/analytics/ingest.js`: inoltra join, leave e chat dei giocatori analizzati alla chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` e `views/partials/server/integrations.hbs` (tramite `chatbot.hbs`): API admin e la scheda Impostazioni → Chatbot per server.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js` e `019_wizard_power_controllers.js`: schema persistente.
- `test/wizard.test.js`: test di autorizzazione, confini dei tool, conservazione, outreach e comportamento della chat.

I nomi interni delle route/moduli/tabelle `wizard` sono mantenuti per compatibilità di aggiornamento e API; "chatbot" è il termine di prodotto rivolto all'utente. Allo stesso modo, il campo memorizzato `power_testers_json` corrisponde al gruppo **Utenti base** dell'interfaccia utente.

## Impronta delle dipendenze (`minecraft-data`)

L'aiuto per le ricette utilizza il pacchetto `minecraft-data`. È grande su disco (circa 429 MB installato) e viene spedito all'interno dell'immagine di produzione perché è una dipendenza runtime, non di sviluppo. Lo stiamo mantenendo di proposito in modo che l'aiuto per le ricette funzioni offline per ogni versione di Minecraft senza chiamate di rete.

Note per chiunque esamini questo in futuro (umano o AI), in modo che la dimensione non sia una sorpresa:

- Attualmente vengono utilizzati solo i dati Java (`pc`). `wizardRecipes.js` legge `minecraftData.versions.pc` e le tabelle per-versione `recipes`, `items` e `blocks`. I file che tocca effettivamente ammontano a circa 15 MB per ogni versione pc.
- Circa 330 MB del pacchetto sono `data/bedrock` e nulla qui li legge ancora. Li stiamo lasciando in posizione di proposito. Se il pannello dovesse mai aggiungere il supporto per Bedrock Minecraft, i dati delle ricette e degli oggetti Bedrock sono già qui, quindi la funzionalità ricette può crescere per coprire i server Bedrock senza aggiungere una nuova dipendenza. Inizia da `minecraftData.versions.bedrock` e segui la stessa struttura del percorso pc.
- Se la dimensione dovesse mai diminuire prima che arrivi il supporto Bedrock, c'è già uno schema per questo in questo repository. `src/services/itemRegistry.js` recupera i file `minecraft-data` dal CDN jsDelivr quando ne ha bisogno e li memorizza nella cache in `api_cache`. Sia quell'approccio, sia un piccolo sottoinsieme scelto a mano `src/data/recipes/` che copre alcune versioni comuni, ridurrebbe notevolmente l'immagine.

## Archiviazione locale e ispezione manuale

Tutte le impostazioni e le trascrizioni conservate risiedono nel database SQLite del pannello in `/data/panel.db` all'interno del container del pannello. Con il mount Compose standard, il percorso host è `${DATA_DIR_HOST}/panel.db` (ad esempio `/opt/msm/data/panel.db`). Le tabelle pertinenti sono `wizard_configs`, `wizard_transcripts` e `wizard_outreach`; gli audit dei poteri sono righe nella tabella `events` con tipo `wizard-power`. La chiave API LLM opzionale è crittografata AES-256-GCM con la chiave at-rest del pannello, `.secret-key` nella cartella dati (separata da `SESSION_SECRET`).

Esegui il backup del database e arresta il pannello prima di modificare direttamente SQLite in modo che il suo WAL venga gestito in sicurezza. L'uso dell'interfaccia utente/API admin è preferito perché applica la validazione e la crittografia. Mantieni insieme i file `panel.db`, `panel.db-wal` e `panel.db-shm` quando copi un database live.
