---
title: 'Integrazioni'
description: 'Ogni server gestisce le proprie integrazioni nel gruppo Impostazioni: Discord, una Pagina di Stato pubblica, Inviti in un clic e la scheda opzionale Chatbot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Indice della documentazione](/docs/)

Ogni server ha le sue integrazioni nel gruppo **Impostazioni**: **Discord**, una **Pagina di stato** pubblica, **Inviti** con un clic e la scheda opzionale **Chatbot**. Questa pagina copre Discord (le altre hanno la loro documentazione e guide di configurazione nel pannello).

## Notifiche Discord

Il pannello inoltra gli eventi del server a un canale Discord tramite un webhook. Nessun bot, nessun OAuth.

### Configurazione

1. In Discord: **Impostazioni del server → Integrazioni → Webhook → Nuovo Webhook**. Scegli il canale e copia l'URL del webhook.
2. Nel pannello, apri la scheda **Impostazioni → Discord** del server, incolla l'URL in **URL Webhook**, attiva la scheda **on** e fai clic su **Salva**. L'URL viene memorizzato crittografato (nello stesso archivio a riposo delle tue chiavi API).
3. Usa **Invia test** per confermare che funzioni.

![Integrazione Discord](/docs/images/integrations-discord.png)

Per sostituire un URL memorizzato, incolla uno nuovo e salva; lascia il campo vuoto per mantenere quello attuale. L'URL memorizzato viene mostrato mascherato (il token è nascosto).

### Cosa viene inviato

Le notifiche sono raggruppate in categorie attivabili/disattivabili. Tutte sono attive per impostazione predefinita.

| Categoria            | Eventi                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| **Avvio / arresto**  | Server avviato, server arrestato                                        |
| **Crash**            | Crash, loop di crash rilevato, nuovo report di crash                    |
| **Backup**           | Backup creato, backup ripristinato                                      |
| **Aggiornamenti**    | Aggiornamento applicato, aggiornamento annullato, aggiornamento fallito |
| **Espulsioni / ban** | Giocatore espulso, giocatore bannato                                    |
| **Avvisi**           | Le cose che lasciano silenziosamente un server inattivo (vedi sotto)    |

### La categoria Avvisi

`Avvisi` è il canale "qualcosa ha bisogno di un umano", per condizioni che prima erano visibili solo nel pannello:

| Evento                  | Significato                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Il container è stato arrestato per esaurimento della memoria.                                                  |
| `unhealthy`             | Il processo è attivo ma la sonda `mc-health` sta fallendo: un server vivo ma morto.                            |
| `startup-stalled`       | Ancora in avvio dopo circa 10 minuti senza "Fatto" nei log (con una diagnosi di cosa correggere, quando nota). |
| `stop-failed`           | Un arresto "graceful" non ha avuto effetto e il container è ancora in esecuzione.                              |
| `schedule-failed`       | Un riavvio / backup / comando pianificato è fallito.                                                           |
| `quota-exceeded`        | La quota disco in modalità "strict" è stata superata e il server è stato arrestato.                            |
| `offline-after-restart` | Il server era attivo prima del riavvio del pannello, ora non lo è e non verrà avviato automaticamente.         |
| `crash-report`          | Un nuovo report di crash è stato catturato e analizzato.                                                       |
| `update-failed`         | Un aggiornamento "guarded" non è risultato integro.                                                            |

### Come funziona la consegna

Un "bridge" in background controlla il [log degli eventi](/docs/activity/) ogni 15 secondi e inoltra le righe mappate. Se un POST del webhook fallisce transitoriamente, quella riga viene ritentata nei controlli successivi anziché essere scartata; un webhook permanentemente irraggiungibile viene silenziato (una riga di log all'ora) dopo alcuni tentativi. Il bridge non riproduce mai eventi precedenti all'avvio del pannello.
