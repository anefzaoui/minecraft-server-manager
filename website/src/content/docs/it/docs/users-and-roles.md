---
title: 'Utenti e ruoli'
description: 'Account, i ruoli di amministratore, operatore e visualizzatore, e permessi per server in Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Indietro all'indice della documentazione](/docs/)

Il pannello è multi-utente. Gestisci gli account in **Impostazioni → Utenti**.

![Utenti](/docs/images/settings-users.png)

## I tre ruoli

| Ruolo        | Predefinito su ogni server                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Tutto: gestisci utenti, chiavi API, file globali, override Docker avanzati e ogni azione del server.                                            |
| **operator** | Esegui e configura server (avvia/ferma, console, backup, mondi, mod, la maggior parte delle impostazioni), ma non le aree riservate agli admin. |
| **viewer**   | Sola lettura. Visualizza i server e il loro stato, ma non effettua modifiche.                                                                   |

Ogni utente, incluso un viewer, può gestire la propria [autenticazione a due fattori](/docs/two-factor-authentication/), poiché proteggere il proprio accesso non è un'azione di gestione del server.

Un ruolo è il **predefinito** per ogni server. Per concedere a qualcuno diritti diversi su un server, utilizza le autorizzazioni per server di seguito.

## Autorizzazioni per server

La pagina **Autorizzazioni** (nella barra laterale, o **Autorizzazioni server** in **Impostazioni → Utenti**) mostra una griglia: ogni operatore e viewer sul lato sinistro, ogni server in alto. Fai clic su una cella per decidere cosa quell'utente può fare su quel singolo server. Gli admin non sono elencati perché hanno sempre tutto.

![Autorizzazioni](/docs/images/settings-permissions.png)

Ogni cella è un insieme di autorizzazioni:

| Autorizzazione   | Cosa consente su quel server                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Visualizza**   | Vedi il server, il suo stato, l'output della console, i giocatori, la cronologia e le statistiche.          |
| **Potenza**      | Avvia, ferma, riavvia, termina e ricrea il server.                                                          |
| **Console**      | Esegui comandi della console e azioni rapide del mondo, invia chat e gestisci comandi della chat.           |
| **Giocatori**    | Espelli, bandisci, aggiungi alla whitelist, promuovi a op e modifica le note dei giocatori.                 |
| **Contenuto**    | Installa e rimuovi mod, plugin, pacchetti, mondi, datapack e modifica inventari.                            |
| **Backup**       | Crea, ripristina, scarica ed elimina backup.                                                                |
| **File**         | Sfoglia, modifica, carica e scarica file del server, log archiviati e bundle di log; esporta blueprint.     |
| **Impostazioni** | Modifica le impostazioni del server, le proprietà, le integrazioni, l'icona e le versioni di aggiornamento. |
| **Elimina**      | Elimina il server.                                                                                          |

![Editor autorizzazioni](/docs/images/permissions-editor.png)

Sotto la griglia, **Cosa Copre Ogni Autorizzazione** espande ogni autorizzazione in ciò che una persona può fare, cosa non è incluso e i percorsi esatti del pannello che sblocca. Quest'ultimo elenco viene verificato rispetto al codice in esecuzione dalla suite di test.

![Riferimento autorizzazioni](/docs/images/permissions-reference.png)

Su un telefono, la griglia si impila in una scheda per utente, con una riga per server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Autorizzazioni su un telefono" width="180">
</p>

Come i pezzi si incastrano:

- **Il ruolo è il predefinito.** Un operatore inizia con ogni autorizzazione su ogni server; un viewer inizia solo con Visualizza. Una cella in testo sbiadito (il suo tooltip dice "Predefinito del ruolo") non è mai stata modificata.
- **Una cella sovrascrive il ruolo solo per quel server.** Concedi a un viewer Potenza e Console su un server e potrà eseguirlo, mentre tutti gli altri server rimangono in sola lettura per lui. Togli Elimina a un operatore sul tuo server principale e manterrà tutto il resto lì.
- **Ogni autorizzazione include Visualizza.** Non puoi agire su un server che non puoi vedere.
- **Disattiva tutto per nascondere un server.** Scompare dalla barra laterale dell'utente, dalla dashboard, dai backup, dalle pianificazioni, dall'attività, dagli aggiornamenti, dai modpack, dallo stato live, dalle attività in esecuzione e dai blueprint, e la libreria dei mondi smette di nominarlo. Un link diretto, una chiamata API o un socket della console rispondono "non trovato", come un server che non esiste.
- **Le azioni a livello di pannello seguono ancora il ruolo.** La creazione di server (incluso il clonare uno), lo storage, gli utenti, le chiavi API, le impostazioni globali e le pianificazioni a livello di pannello non sono per server, quindi un viewer con autorizzazioni su alcuni server non può comunque fare nessuna di queste cose. Gli operatori mantengono la creazione di server e le pianificazioni a livello di pannello; lo storage, gli utenti, le chiavi API e le impostazioni globali sono riservati agli admin.
- **Le pianificazioni seguono il server.** Un riavvio, un backup o un comando pianificato su un server richiede l'autorizzazione corrispondente lì (Potenza, Backup o Console), qualunque sia il ruolo.
- **Anche i blueprint seguono il server.** Esportare un server come blueprint richiede l'autorizzazione File lì, poiché l'archivio contiene i suoi file. Un blueprint esportato da un server che qualcuno non può vedere è nascosto anche a quella persona.
- **Le aree riservate agli admin rimangono riservate agli admin** su ogni server: il chatbot, la conservazione dei backup e gli override Docker avanzati.

Ogni modifica viene scritta nel registro delle attività con chi ha modificato cosa; queste voci vengono mostrate solo agli admin. L'eliminazione di un utente rimuove le sue righe. La rimozione di un server le mantiene, quindi un server nascosto a qualcuno rimane nascosto nella sua cronologia e nei backup conservati.

Le installazioni esistenti continuano a funzionare invariate: finché un admin non modifica una cella, ogni utente ha esattamente ciò che il suo ruolo gli ha concesso in precedenza.

## Riservato agli admin, e perché

Alcune cose sono intenzionalmente limitate agli admin:

- **Gestione utenti, storage, impostazioni globali, chiavi API e file globali.**
- **L'[API pubblica](/docs/public-api/)**: abilitazione di `/api/v1` e creazione, ambito o revoca dei suoi token Bearer di sola lettura.
- **Override Docker avanzati**: nome container personalizzato, pubblicazioni di porte aggiuntive e bind mount. Un bind mount può mappare qualsiasi percorso host in un container e, combinato con l'accesso Docker del pannello, ciò equivale a root sull'host. Questi campi appaiono solo per gli admin.

I nomi dei container personalizzati non possono nemmeno risiedere nello spazio dei nomi `msm-` del pannello, quindi un container nominato manualmente non può mai sovrapporsi a un'altra istanza e reindirizzare un comando di arresto o un comando all'istanza sbagliata.

## Gestione degli account

![Immagine del profilo](/docs/images/profile-picture.png)

Gli admin possono creare utenti, modificare ruoli, reimpostare password ed eliminare account dalla tabella Utenti. La colonna **2FA** mostra se ogni utente ha abilitato l'autenticazione a due fattori; un admin può reimpostare il 2FA di un altro utente con **Reimposta 2FA** nel menu azioni di quell'utente (per il caso di telefono perso e codici di backup), ma mai disabilitare il proprio senza la password, cosa che il flusso self-service gestisce invece.

I tentativi di accesso falliti sono limitati per account (sia un contatore per IP che un contatore globale per account) per rallentare i tentativi di forza bruta, e lo stesso limite copre anche il passaggio del codice 2FA in modo che una password corretta non possa resettare il contatore prima di indovinare il codice. Davanti a ciò si trova un limitatore di richieste più grossolano per IP client sugli endpoint di accesso / 2FA / configurazione, configurabile tramite `RATE_LIMIT_AUTH_PER_15MIN` (predefinito 100; dietro un reverse proxy, imposta `TRUST_PROXY` in modo che si basi sull'IP reale del client).
