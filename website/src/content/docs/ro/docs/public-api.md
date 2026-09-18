---
title: 'API Publică'
description: 'Un API HTTP mic, doar pentru citire, pentru preluarea stării serverului din afara panoului: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Înapoi la indexul documentației](/docs/)

Un API HTTP mic, doar pentru citire, pentru preluarea stării serverului din afara panoului: un
tablou de bord de stare, un monitor de disponibilitate, un bot Discord, o regulă de automatizare a casei. Este
servit de panoul însuși și returnează aceleași date live pe care le afișează paginile proprii ale panoului
(din cache-ul din memorie), astfel încât interogarea acestuia nu atinge niciodată Docker.

Este **dezactivat până când un administrator îl folosește** și **este controlat de administrator**. Nimic nu este expus
până când nu există un token.

## Activarea

**Setări → API Public → Cheie Nouă**. Dați-i un nume, alegeți ce poate vedea (toate
serverele sau un subset specific) și, opțional, o dată de expirare. Cheia completă (un token Bearer) este afișată **o singură dată**, într-o fereastră de dialog; copiați-o acum, deoarece ulterior este păstrat doar un prefix scurt, pentru identificare în listă.

![Setări API Public](/docs/images/settings-public-api.png)

Crearea primei chei activează automat API-ul (comutatorul **Permite aplicațiilor externe să citească starea** este un control de pauză: dezactivați-l pentru a opri servirea fără a anula nicio cheie). Anulați o cheie din același tabel oricând; clienții care o folosesc pierd accesul imediat.

Tokenurile sunt stocate ca un hash SHA-256 (niciodată în text clar), supraviețuiesc unei reporniri a panoului și
supraviețuiesc serverelor la care sunt limitate (un server șters pur și simplu dispare din rezultatele acelui token).

## Autentificare

Trimiteți tokenul ca o credențială Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Nu există cookie-uri și **fără CORS**: acesta este pentru apeluri server-la-server și CLI,
nu pentru aplicații de browser dintr-o altă origine. Dacă panoul este în spatele unui proxy invers, asigurați-vă că proxy-ul redirecționează antetul `Authorization`.

Erorile returnează `401` cu `{ "ok": false, "error": "..." }`. Orice altceva decât `GET`
(sau `HEAD`) returnează `405`. Căile necunoscute returnează `404`. Când API-ul este dezactivat, toate rutele
returnează `404`.

## Limită de solicitări

Fiecare token primește propriul buget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (implicit `120`
solicitări/minut; `0` dezactivează limitatorul). Depășirea limitei returnează `429`. Solicitările care
nu prezintă niciodată un token valid (lipsă, incorect formatat, revocat sau expirat) sunt limitate separat pe IP client la de cinci ori acea valoare, astfel încât sondarea să nu poată ocoli bugetul prin rotirea tokenurilor.

## Endpoints

### `GET /api/v1/servers`

Fiecare server la care este limitat tokenul.

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

Un singur server, același obiect sub o cheie `server`. Returnează `404` pentru un id necunoscut
**și** pentru un server la care tokenul nu este limitat (fără oracol de existență), și `400`
pentru un id incorect formatat.

## Câmpuri de răspuns

| Câmp            | Semnificație                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `total`         | Câte servere sunt vizibile pentru acest token (după filtrul său de scop).                        |
| `online`        | Câte dintre acestea sunt în starea: `running`.                                                   |
| `id`            | Id-ul stabil al serverului (`srv_...`).                                                          |
| `name`          | Numele afișat.                                                                                   |
| `type`          | Tipul de server itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                |
| `state`         | `running`, `starting`, `stopped` sau `crashed` - un rezumat stabil al stării interne a panoului. |
| `cpuPct`        | CPU recent în %, sau `null` când serverul nu rulează.                                            |
| `memoryMb`      | Memoria rezidentă în MB, sau `null`.                                                             |
| `memoryLimitMb` | Limita de memorie a containerului configurată în MB, sau `null`.                                 |
| `uptimeSeconds` | Secunde de la pornirea containerului, sau `null`.                                                |
| `players`       | `{ online, max }`, sau `null` până când serverul raportează o listă de jucători.                 |

## Exemplu

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
