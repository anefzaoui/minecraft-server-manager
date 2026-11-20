---
title: 'Nyilvános API'
description: 'Egy kis, csak olvasható HTTP API a szerver állapotának lekérdezéséhez a panelen kívülről: állapot-kijelző, üzemidő-monitor, Discord bot, otthonautomatizálási szabály.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Egy kis, csak olvasható HTTP API a szerver állapotának lekérdezéséhez a panelen kívülről: állapot-műszerfal, üzemidő-monitor, Discord bot, otthonautomatizálási szabály. Maga a panel szolgálja ki, és ugyanazokat az élő adatokat adja vissza, amelyeket a panel saját oldalai is mutatnak (a memóriabeli gyorsítótárból), így az adatlekérdezés soha nem érinti a Dockert.

**Alapértelmezetten ki van kapcsolva, amíg egy rendszergazda nem használja, és rendszergazdai engedélyhez kötött.** Semmi sem lesz elérhető, amíg nem létezik token.

## Engedélyezés

**Beállítások → Nyilvános API → Új kulcs**. Adj neki nevet, válaszd meg, mit láthat (minden szerver, vagy egy adott részhalmaz), és opcionálisan egy lejárati dátumot. A teljes kulcs (Bearer token) **egyszer** jelenik meg egy párbeszédablakban; másold ki most, mert utána csak egy rövid előtagot tárolunk a listában való azonosításhoz.

![Nyilvános API beállítások](/docs/images/settings-public-api.png)

Az első kulcs létrehozása automatikusan bekapcsolja az API-t (a **Külső alkalmazások státuszának olvasása engedélyezése** kapcsoló szüneteltető vezérlő: kapcsold ki a kiszolgálás leállításához anélkül, hogy bármely kulcsot törölnél). Bármikor törölhetsz egy kulcsot ugyanazon táblázatból; a vele rendelkező kliensek azonnal elveszítik a hozzáférést.

A tokenek SHA-256 hash-ként vannak tárolva (soha nem olvasható szövegként), túlélik a panel újraindítását, és túlélnek a hozzájuk rendelt szervereknél (egy törölt szerver egyszerűen kiesik az adott token eredményeiből).

## Hitelesítés

Küldd el a tokent Bearer hitelesítőként:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Nincsenek sütik és **nincs CORS**: ez szerverek közötti és CLI hívásokhoz való, nem böngészőalkalmazásokhoz más eredetről. Ha a panel fordított proxy mögött van, győződj meg róla, hogy a proxy továbbítja az `Authorization` fejlécet.

A sikertelen kérések `401`-et adnak vissza a következővel: `{ "ok": false, "error": "..." }`. Bármi, ami nem `GET` (vagy `HEAD`), `405`-öt ad vissza. Az ismeretlen útvonalak `404`-et adnak vissza. Amikor az API le van tiltva, minden útvonal `404`-et ad vissza.

## Sebességkorlátozás

Minden tokennek megvan a saját költségvetése, `RATE_LIMIT_PUBLIC_API_PER_MIN` (alapértelmezetten `120` kérés/perc; `0` letiltja a korlátozót). A limit túllépése `429`-et eredményez. Minden kérés, még mielőtt a tokenjét ellenőriznék, beleszámít egy kliens-IP-nkénti sapkába, ami ennek a számnak az ötszöröse, így hiányzó, hibásan formázott, visszavont vagy lejárt tokenekkel való próbálkozás nem tudja megkerülni a költségvetést azáltal, hogy forgatja őket.

## Végpontok

### `GET /api/v1/servers`

Minden szerver, amelyre a token hatóköre kiterjed.

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

Egyetlen szerver, ugyanaz az objektum egy `server` kulcs alatt. `404`-et ad vissza ismeretlen azonosító esetén, **valamint** egy olyan szerver esetén, amelyre a token hatóköre nem terjed ki (nincs létezési orákulum), és `400`-at egy hibásan formázott azonosító esetén.

## Válasz mezők

| Mező            | Jelentés                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `total`         | Hány szerver látható ehhez a tokenhez (a hatókör szűrése után).                                    |
| `online`        | Ezek közül hány van `running` állapotban.                                                          |
| `id`            | Stabil szerverazonosító (`srv_...`).                                                               |
| `name`          | Megjelenítendő név.                                                                                |
| `type`          | itzg szervertípus (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                     |
| `state`         | `running`, `starting`, `stopped`, vagy `crashed`: a panel belső állapotának stabil összefoglalása. |
| `cpuPct`        | Legutóbbi CPU %, vagy `null`, ha a szerver nem fut.                                                |
| `memoryMb`      | Memória használat MB-ban, vagy `null`.                                                             |
| `memoryLimitMb` | Konfigurált tároló memórialimite MB-ban, vagy `null`.                                              |
| `uptimeSeconds` | Másodpercek a tároló indítása óta, vagy `null`.                                                    |
| `players`       | `{ online, max }`, vagy `null`, amíg a szerver nem jelent le egy játékoslistát.                    |

## Példa

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
