---
title: 'Inviti e pagina di stato'
description: "Invita amici a un server con l'indirizzo, la versione e un modpack client, e condividi una pagina di stato pubblica che mostra solo ciò che scegli."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Indietro all'indice della documentazione](/docs/)

Due schede nel gruppo **Impostazioni** di un server aiutano i giocatori a trovarlo e a connettersi: **Inviti** scrive tutto ciò che un amico necessita per connettersi, e **Pagina di stato** pubblica una piccola pagina pubblica che mostra se il server è attivo. Entrambe richiedono il permesso **Impostazioni** del server ([utenti e ruoli](/docs/users-and-roles/#per-server-permissions)).

## Inviti

**Impostazioni → Inviti** ha una scheda **Invita amici**:

- **Indirizzo da condividere** elenca gli indirizzi della macchina sulla tua rete locale con la porta di gioco del server, il tuo indirizzo pubblico quando il pannello è riuscito a rilevarlo (i giocatori al di fuori della tua rete lo raggiungono solo tramite port forwarding), e **Indirizzo personalizzato…** per un dominio o un indirizzo che hai impostato tu stesso, come `play.example.com:25565`.
- **Testo dell'invito** è un messaggio pronto per essere incollato con il nome del server, l'indirizzo che hai scelto, e la sua versione e tipo di Minecraft. **Copia testo invito** lo mette negli appunti. Quando la whitelist è attiva, il testo chiede agli amici il loro nome utente di Minecraft, e la scheda ti ricorda di aggiungere ogni amico nella scheda **Giocatori** prima che si connettano.
- **Cosa serve agli amici** dice cosa serve dal lato del giocatore: niente se non la versione corretta di Minecraft per un server vanilla o con plugin (Paper e simili), o le mod del server per uno moddato.

### Il modpack client

Su un server moddato, la scheda offre anche **Scarica modpack client (.mrpack)**. Gli amici lo importano in Prism Launcher o nell'App Modrinth, che installa la versione di Minecraft e il mod loader del server, scarica le mod e aggiunge il server alla loro lista multiplayer con l'indirizzo che hai scelto.

Il file è costruito dalle mod che hai aggiunto tu stesso al server (l'overlay di mod personalizzate) che provengono da Modrinth. Le mod da altre fonti sono elencate invece sulla scheda, così gli amici possono aggiungere quei file alla loro cartella `mods` manualmente. Su un server creato da un modpack, gli amici dovrebbero installare quel pack, nella versione in cui gira il server, nel loro launcher; la scheda **Panoramica** mostra la versione.

### Giocare su Internet

**Giocare su Internet (port forwarding)** in fondo alla scheda spiega il lato router: inoltra la porta di gioco del server (TCP e UDP) alla macchina che esegue il pannello, poi condividi il tuo indirizzo pubblico con la porta. Se il tuo provider Internet usa CGNAT, il port forwarding non può funzionare, e un servizio di tunnel (ad esempio playit.gg) è la soluzione. Il pannello non apre le porte del router da solo. Solo le porte di gioco appartengono a Internet; tieni chiuse la porta del pannello e le porte RCON ([porte a colpo d'occhio](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Pagina di stato

**Impostazioni → Pagina di stato** attiva una pagina pubblica per un server, disattivata per impostazione predefinita:

1. Attiva la scheda.
2. Scegli l'**Indirizzo pagina**: la pagina si trova su `/status/<indirizzo>` sul tuo pannello, e l'indirizzo è composto da 3 a 40 lettere minuscole, numeri o trattini, univoco tra i tuoi server.
3. Premi **Salva**. **Apri pagina** e **Copia link** ti forniscono quindi il link da condividere.

Chiunque abbia il link vede il nome del server, il suo MOTD, la versione, se è in esecuzione, il numero di giocatori e il suo uptime, e nient'altro. La pagina non ha link al pannello e non richiede alcun accesso. Legge lo stato in memoria del pannello, quindi i visitatori non causano mai lavoro sul demone Docker.

Disattivare la pagina ne conserva l'indirizzo, quindi riattivarla ripristina lo stesso link. Per una pagina o un bot di tua proprietà, l'[API pubblica](/docs/public-api/) restituisce lo stesso tipo di stato in formato JSON.

Correlati: [Notifiche Discord](/docs/integrations/), [la mappa live](/docs/live-map/), [creazione e gestione server](/docs/servers/).
