---
title: 'Utenti e ruoli'
description: 'Il pannello è multi-utente.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Indice della documentazione](/docs/)

Il pannello è multi-utente. Gestisci gli account in **Impostazioni → Utenti**.

![Utenti](/docs/images/settings-users.png)

## I tre ruoli

| Ruolo        | Può fare                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Tutto: gestire utenti, chiavi API, file globali, override Docker avanzati e ogni azione del server.                                                |
| **operator** | Eseguire e configurare server (avvio/arresto, console, backup, mondi, mod, la maggior parte delle impostazioni), ma non aree riservate agli admin. |
| **viewer**   | Sola lettura. Visualizzare i server e il loro stato, ma senza apportare modifiche.                                                                 |

Ogni utente, incluso un viewer, può gestire la propria [autenticazione a due fattori](/docs/two-factor-authentication/), poiché proteggere il proprio accesso non è un'azione di gestione del server.

## Riservato agli admin, e perché

Alcune cose sono intenzionalmente limitate agli admin:

- **Gestione utenti, chiavi API e file globali.**
- **La [API pubblica](/docs/public-api/)** - abilitazione di `/api/v1` e creazione, ambito o revoca dei suoi token Bearer di sola lettura.
- **Override Docker avanzati** - nome del container personalizzato, pubblicazione di porte aggiuntive e bind mount. Un bind mount può mappare qualsiasi percorso host in un container e, combinato con l'accesso Docker del pannello, equivale a root sull'host. Questi campi appaiono solo per gli admin.

Anche i nomi dei container personalizzati non possono risiedere nello spazio dei nomi `msm-` del pannello, quindi un container nominato manualmente non potrà mai sovrapporsi a quello di un altro server e reindirizzare un comando o un arresto all'istanza sbagliata.

## Gestione degli account

![Immagine del profilo](/docs/images/profile-picture.png)

Gli admin possono creare utenti, modificare ruoli, reimpostare password ed eliminare account dalla tabella Utenti. La colonna **2FA** mostra se ogni utente ha l'autenticazione a due fattori abilitata; un admin può **reimpostare** la 2FA di un altro utente (per il caso di telefono perso e codici di backup), ma mai disabilitare la propria senza la password, cosa che il flusso self-service gestisce invece.

I tentativi di accesso falliti sono limitati per account (sia un contatore per IP che un contatore globale per account) per rallentare i tentativi di forza bruta, e lo stesso limite copre anche il passaggio del codice 2FA, quindi una password corretta non può resettare il contatore prima di indovinare il codice. Davanti a ciò si trova un limitatore di richieste più grossolano per IP client sugli endpoint di accesso / 2FA / configurazione, regolabile tramite `RATE_LIMIT_AUTH_PER_15MIN` (predefinito 100; dietro un reverse proxy, imposta `TRUST_PROXY` in modo che si basi sull'IP reale del client).
