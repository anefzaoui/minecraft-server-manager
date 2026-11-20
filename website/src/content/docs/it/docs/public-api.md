---
title: 'API Pubblica'
description: "Una piccola API HTTP di sola lettura per recuperare lo stato del server dall'esterno del pannello: una dashboard di stato, un monitor di uptime, un bot Discord, una regola di automazione domestica."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Indietro all'indice della documentazione](/docs/)

Una piccola API HTTP di sola lettura per recuperare lo stato del server dall'esterno del pannello: una dashboard di stato, un monitor di uptime, un bot Discord, una regola di automazione domestica. È servita dal pannello stesso e restituisce gli stessi dati live che mostrano le pagine del pannello (dalla cache in memoria), quindi interrogarla non tocca mai Docker.

È **disattivata finché un amministratore non la utilizza** ed è **protetta da amministratore**. Nulla viene esposto finché non esiste un token.

## Abilitazione

**Impostazioni → API pubblica → Nuova chiave**. Assegna un nome, scegli cosa può vedere (tutti i server o un sottoinsieme specifico) e, facoltativamente, una data di scadenza. La chiave completa (un token Bearer) viene mostrata **una sola volta**, in una finestra di dialogo; copiala ora, perché in seguito verrà conservato solo un breve prefisso, per l'identificazione nell'elenco.

![Impostazioni API pubblica](/docs/images/settings-public-api.png)

La creazione della prima chiave attiva automaticamente l'API (l'interruttore **Consenti alle app esterne di leggere lo stato** è un controllo di pausa: disattivalo per interrompere il servizio senza annullare alcuna chiave). Annulla una chiave dalla stessa tabella in qualsiasi momento; i client che la utilizzano perdono immediatamente l'accesso.

I token vengono archiviati come hash SHA-256 (mai in chiaro), sopravvivono a un riavvio del pannello e sopravvivono ai server a cui sono associati (un server eliminato semplicemente non compare nei risultati di quel token).

## Autenticazione

Invia il token come credenziale Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Non ci sono cookie e **nessun CORS**: questo è per chiamate server-to-server e CLI, non per app browser da un'altra origine. Se il pannello è dietro un proxy inverso, assicurati che il proxy inoltri l'intestazione `Authorization`.

I fallimenti restituiscono `401` con `{ "ok": false, "error": "..." }`. Qualsiasi cosa diversa da `GET` (o `HEAD`) restituisce `405`. Percorsi sconosciuti restituiscono `404`. Quando l'API è disabilitata, ogni route restituisce `404`.

## Limite di richieste

Ogni token ottiene il proprio budget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (predefinito `120` richieste/minuto; `0` disabilita il limitatore). Superare il limite restituisce `429`. Ogni richiesta, prima ancora che il suo token venga verificato, conta anche verso un limite per indirizzo IP client pari a cinque volte quel numero, quindi sondare con token mancanti, malformati, revocati o scaduti non può aggirare il budget ruotandoli.

## Endpoint

### `GET /api/v1/servers`

Ogni server a cui è associato il token.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

Un singolo server, stesso oggetto sotto una chiave `server`. Restituisce `404` per un ID sconosciuto **e** per un server a cui il token non è associato (nessun oracolo di esistenza), e `400` per un ID malformato.

## Campi di risposta

| Campo           | Significato                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `total`         | Quanti server sono visibili a questo token (dopo il filtro di ambito).                                |
| `online`        | Quanti di questi sono nello stato: `running`.                                                         |
| `id`            | ID stabile del server (`srv_...`).                                                                    |
| `name`          | Nome visualizzato.                                                                                    |
| `type`          | Tipo di server itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                      |
| `state`         | `running`, `starting`, `stopped`, o `crashed`: un riepilogo stabile dello stato interno del pannello. |
| `cpuPct`        | Percentuale CPU recente, o `null` quando il server non è in esecuzione.                               |
| `memoryMb`      | Memoria residente in MB, o `null`.                                                                    |
| `memoryLimitMb` | Limite di memoria del container configurato in MB, o `null`.                                          |
| `uptimeSeconds` | Secondi dall'avvio del container, o `null`.                                                           |
| `players`       | `{ online, max }`, o `null` finché il server non segnala un elenco di giocatori.                      |

## Esempio

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
