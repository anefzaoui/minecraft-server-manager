---
title: 'Nyilvános API'
description: 'Egy kis, csak olvasható HTTP API a szerver állapotának lekérdezéséhez a panelen kívülről: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Vissza a dokumentációhoz](/docs/)

Egy kis, csak olvasható HTTP API a szerver állapotának lekérdezéséhez a panelen kívülről: állapot-kijelző, üzemidő-monitor, Discord bot, otthonautomatizálási szabály. Maga a panel szolgálja ki, és ugyanazokat az élő adatokat adja vissza, amelyeket a panel saját oldalai is mutatnak (a memóriában tárolt gyorsítótárból), így annak lekérdezése soha nem érinti a Dockert.

Ez **ki van kapcsolva, amíg egy rendszergazda nem használja**, és **rendszergazdai engedélyhez kötött**. Semmi sem lesz elérhető, amíg nincs token.

## Engedélyezés

**Beállítások → Nyilvános API → Új kulcs**. Adj neki egy nevet, válaszd meg, mit láthat (minden szerver, vagy egy adott részhalmaz), és opcionálisan egy lejárati dátumot. A teljes kulcs (Bearer token) **egyszer** jelenik meg egy párbeszédablakban; másold ki most, mert utána csak egy rövid előtagot tárolunk meg azonosítás céljából a listában.

![Nyilvános API beállítások](/docs/images/settings-public-api.png)

Az első kulcs létrehozása automatikusan bekapcsolja az API-t (a **Külső alkalmazások állapotának olvasása** kapcsoló szüneteltető vezérlő: kapcsold ki a kiszolgálás leállításához anélkül, hogy bármely kulcsot törölnél). Bármikor törölhetsz egy kulcsot ugyanazon táblázatból; a használatban lévő ügyfelek azonnal elveszítik a hozzáférést.

A tokenek SHA-256 hash-ként vannak tárolva (soha nem olvasható szövegként), túlélik a panel újraindítását, és túlélnek a hozzájuk rendelt szervereknél (egy törölt szerver egyszerűen kiesik az adott token eredményeiből).

## Hitelesítés

Küldd el a tokent Bearer hitelesítőként:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Nincsenek sütik és **nincs CORS**: ez szerverek közötti és CLI hívásokhoz való, nem böngészőből érkező alkalmazásokhoz. Ha a panel egy fordított proxy mögött van, győződj meg róla, hogy a proxy továbbítja az `Authorization` fejlécet.

Hibák esetén `401` válasz érkezik `{ "ok": false, "error": "..." }` szöveggel. Bármi, ami nem `GET` (vagy `HEAD`), `405`-öt ad vissza. Az ismeretlen útvonalak `404`-et adnak vissza. Amikor az API le van tiltva, minden útvonal `404`-et ad vissza.

## Hívási sebességkorlát

Minden tokennek saját költségvetése van, `RATE_LIMIT_PUBLIC_API_PER_MIN` (alapértelmezetten `120` kérés/perc; `0` letiltja a korlátozót). A limit túllépése `429`-et eredményez. Azok a kérések, amelyek soha nem mutatnak érvényes tokent (hiányzó, formátumhibás, visszavont vagy lejárt), külön IP címenként vannak korlátozva ennek az ötszörösére, így a próbálkozások nem tudják megkerülni a költségvetést tokenek forgatásával.

## Végpontok

### `GET /api/v1/servers`

Minden szerver, amelyre a token hatókörrel rendelkezik.

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

Egyetlen szerver, ugyanaz az objektum egy `server` kulcs alatt. `404`-et ad vissza ismeretlen azonosító **és** olyan szerver esetén, amelyre a token hatókörrel nem rendelkezik (nincs létezési forrás), valamint `400`-at formátumhibás azonosító esetén.

## Válasz mezők

| Mező            | Jelentés                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `total`         | Hány szerver látható ehhez a tokenhez (a hatókör szűrés után).                                      |
| `online`        | Ezek közül hány van `running` állapotban.                                                           |
| `id`            | Stabil szerverazonosító (`srv_...`).                                                                |
| `name`          | Megjelenítendő név.                                                                                 |
| `type`          | itzg szervertípus (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                      |
| `state`         | `running`, `starting`, `stopped`, vagy `crashed` - a panel belső állapotának stabil összefoglalása. |
| `cpuPct`        | Legutóbbi CPU % vagy `null`, ha a szerver nem fut.                                                  |
| `memoryMb`      | Rezidens memória MB-ban vagy `null`.                                                                |
| `memoryLimitMb` | Konfigurált konténer memória limit MB-ban vagy `null`.                                              |
| `uptimeSeconds` | Másodpercek a konténer indítása óta vagy `null`.                                                    |
| `players`       | `{ online, max }` vagy `null`, amíg a szerver nem jelent le egy játékoslistát.                      |

## Példa

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
