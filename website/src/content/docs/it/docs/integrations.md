---
title: 'Integrazioni'
description: 'Ogni server ha le sue integrazioni nel gruppo Impostazioni: Discord, una Pagina di Stato pubblica, Inviti in un clic e la scheda opzionale Chatbot (solo amministratori).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Indietro all'indice della documentazione](/docs/)

Ogni server ha le sue integrazioni nel gruppo **Impostazioni**: **Discord**, una **Pagina di stato** pubblica, **Inviti** con un clic e la scheda opzionale **Chatbot** (solo amministratori). Questa pagina copre Discord; [inviti e pagina di stato](/docs/invites-and-status-page/) copre questi due, e [il chatbot](/docs/chatbot/) ha la sua pagina.

## Notifiche Discord

Il pannello inoltra gli eventi del server a un canale Discord tramite un webhook. Nessun bot, nessun OAuth.

### Configurazione

1. In Discord: **Impostazioni del server → Integrazioni → Webhook → Nuovo Webhook**. Scegli il canale e copia l'URL del webhook.
2. Nel pannello, apri la scheda **Impostazioni → Discord** del server, incolla l'URL in **URL Webhook**, attiva la scheda **on** e **Salva**. L'URL viene memorizzato crittografato (nello stesso archivio a riposo delle tue chiavi API).
3. Usa **Invia test** per confermare che funzioni.

![Integrazione Discord](/docs/images/integrations-discord.png)

Per sostituire un URL memorizzato, incolla uno nuovo e salva; lascia il campo vuoto per mantenere quello corrente. L'URL memorizzato viene mostrato mascherato (il token è nascosto).

### Cosa viene inviato

Le notifiche sono raggruppate in categorie attivabili/disattivabili. Tutte sono attive per impostazione predefinita.

| Categoria           | Eventi                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| **Avvio / arresto** | Server avviato, server arrestato                                        |
| **Crash**           | Crash, loop di crash rilevato, nuovo report di crash                    |
| **Backup**          | Backup creato, backup ripristinato                                      |
| **Aggiornamenti**   | Aggiornamento applicato, aggiornamento annullato, aggiornamento fallito |
| **Kick / ban**      | Giocatore espulso, giocatore bannato                                    |
| **Avvisi**          | Le cose che lasciano silenziosamente un server inattivo (vedi sotto)    |

### La categoria Avvisi

`Avvisi` è il canale "qualcosa richiede un intervento umano", per condizioni che prima erano visibili solo nel pannello:

| Evento                  | Significato                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Il container è stato arrestato per esaurimento della memoria.                                                    |
| `unhealthy`             | Il processo è attivo ma la sonda `mc-health` sta fallendo: un server vivo ma morto.                              |
| `startup-stalled`       | Ancora in avvio dopo circa 10 minuti senza "Done" nei log (con una diagnosi di cosa correggere, quando nota).    |
| `stop-failed`           | Un arresto grazioso non ha avuto effetto e il container è ancora in esecuzione.                                  |
| `schedule-failed`       | Un riavvio / backup / comando pianificato è fallito.                                                             |
| `quota-exceeded`        | La quota disco in modalità rigorosa è stata superata e il server è stato arrestato.                              |
| `offline-after-restart` | Il server era attivo prima del riavvio del pannello, ora non lo è e non verrà riavviato automaticamente.         |
| `port-change-failed`    | La modifica della porta è fallita e il server non ha potuto essere rimesso sulla vecchia porta, quindi è spento. |
| `auto-restart-gave-up`  | Un server crashato non è stato riavviato perché un'altra azione lo ha tenuto occupato troppo a lungo.            |

### Come funziona la consegna

Un ponte in background interroga il [log delle attività](/docs/activity/) ogni 15 secondi e inoltra le righe mappate. Se un POST del webhook fallisce transitoriamente, quella riga viene ritentata nei sondaggi successivi anziché essere scartata; dopo alcuni tentativi falliti la riga viene saltata e i fallimenti di consegna vengono registrati al massimo una volta all'ora per server. Dopo un riavvio del pannello, il ponte invia gli eventi che non aveva ancora consegnato, ma mai più indietro di due ore; alla sua primissima esecuzione parte dall'evento più recente.
