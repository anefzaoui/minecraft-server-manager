---
title: 'Iniziare'
description: "Installa Minecraft Server Manager e completa la configurazione iniziale: il controllo del sistema, il tuo fuso orario e l'account amministratore."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Indice della documentazione](/docs/)

## Configurazione iniziale

La prima volta che apri il pannello, una breve procedura guidata ti accompagnerà:

1.  **Controllo di sistema**: verifica che Docker sia raggiungibile, che Node.js sia sufficientemente aggiornato e che la cartella dei dati sia scrivibile. Se Docker non è ancora in esecuzione, puoi comunque continuare; la creazione e l'avvio dei server attenderanno che lo sia.
2.  **Crea il tuo account amministratore**: Questo è l'unico account esistente finché non ne aggiungi altri e ha il controllo completo. Scegli un nome utente (da 2 a 32 caratteri) e una password di almeno 8 caratteri. Verrai connesso non appena sarà creato.
3.  **Configurazione del pannello** (facoltativo): un dominio pubblico da mostrare ai giocatori negli indirizzi di connessione, una chiave API di CurseForge e il tuo fuso orario. Tutto ciò può essere modificato in seguito nelle **Impostazioni**.

L'ultimo passaggio offre **Crea un server** o **Vai alla dashboard**.

![Il passaggio di Controllo di sistema della configurazione iniziale](/docs/images/setup-system-check.png)

> **Le installazioni esposte sono protette da PIN.** Se avvii il pannello collegato a un indirizzo non di loopback (`PANEL_HOST` diverso da `127.0.0.1`), la pagina di configurazione richiederà anche un **PIN di 6 cifre**. Il pannello lo visualizza nella sua console all'avvio. Inseriscilo insieme al tuo nome utente e password. Questo impedisce a uno sconosciuto che raggiunge per primo la porta di rivendicare l'account amministratore. Il PIN scompare una volta creato l'account amministratore.

## Accesso

Dopo la configurazione, il pannello è protetto da una schermata di accesso. Inserisci il tuo nome utente e password per continuare.

![Accesso](/docs/images/login.png)

Se l'[autenticazione a due fattori](/docs/two-factor-authentication/) è abilitata sul tuo account, ti verrà richiesto un codice di 6 cifre dalla tua app di autenticazione subito dopo la password.

## Orientarsi

Tutto è accessibile dalla barra laterale sinistra:

- **Dashboard**: tutti i server a colpo d'occhio ([dettagli](/docs/dashboard/)).
- **Server**, **Modpack**, **Mondi**, **Blueprint**: crea e gestisci server e i loro contenuti.
- **Aggiornamenti**, **Backup**, **Pianificazioni**, **Archiviazione**, **Attività**: il lato operativo: cosa è obsoleto, i tuoi snapshot, l'automazione, l'utilizzo del disco e il registro di controllo.
- **Permessi** (in basso, solo amministratori): cosa ogni utente può fare su ciascun server ([dettagli](/docs/users-and-roles/#per-server-permissions)).
- **Impostazioni** (in basso, solo amministratori): chiavi API, configurazione del pannello, impostazioni predefinite per nuovi server, [conservazione dei backup](/docs/backups/#retention), utenti, sicurezza di accesso e API pubblica.

Sotto queste voci, la barra laterale elenca i tuoi server. Aprendone uno vengono visualizzate le sue schede: **Panoramica**, **Console**, **Giocatori**, **Mod**, **Mondo**, **Backup**, **Monitoraggio** e **Impostazioni**, la maggior parte con sotto-schede correlate (ad esempio, **Impostazioni → Configurazione** contiene le impostazioni del server e la sua porta di gioco). Vedi [Un singolo server](/docs/servers/#a-single-server).

La barra superiore contiene il pulsante **Crea un server**, un **commutatore tema** (scuro/chiaro) e il tuo **menu account**, dove puoi cambiare la tua immagine del profilo, gestire l'[autenticazione a due fattori](/docs/two-factor-authentication/) o disconnetterti.

## Su telefono o tablet

Ogni pagina è progettata prima per uno schermo stretto e poi si allarga: la barra laterale si nasconde dietro il pulsante del menu, le tabelle dei dati si impilano in schede, le barre degli strumenti si piegano e la barra dei controlli del mondo si collassa in una scheda che apri quando ne hai bisogno. Pulsanti e chip hanno una dimensione di destinazione tattile reale. Nulla è esclusivo per desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dashboard su un telefono" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Panoramica del server su un telefono" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Console su un telefono" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Scheda Mod su un telefono" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Compatibilità delle versioni su un telefono" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Impostazioni su un telefono" width="180">
</p>

## Cosa ti serve

Il pannello comunica con Docker per eseguire i server, quindi necessita di accesso a un demone Docker (Docker Desktop o un socket Docker Engine). Quando Docker è raggiungibile, il riquadro Docker nella dashboard mostra **Connesso** e la sua versione. Se non lo è, il pannello continua a funzionare. Non potrai avviare i server finché il demone non sarà attivo.

## Prossimi passi

- [Crea il tuo primo server →](/docs/servers/)
- [Proteggi il tuo account con la 2FA →](/docs/two-factor-authentication/)
