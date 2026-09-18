---
title: 'Veřejné API'
description: 'Malé HTTP API pouze pro čtení pro získávání stavu serveru zvenčí panelu: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Zpět na obsah dokumentace](/docs/)

Malé HTTP API pouze pro čtení pro získávání stavu serveru mimo panel:
dashboard stavu, monitor dostupnosti, Discord bot, pravidlo pro automatizaci domácnosti. Je
poskytováno samotným panelem a vrací stejná živá data, která zobrazují vlastní stránky panelu
(z cache v paměti), takže dotazování na něj se nikdy nedotkne Dockeru.

Je **vypnuté, dokud ho administrátor nepoužije** a je **chráněné administrátorem**. Nic není vystaveno,
dokud neexistuje token.

## Povolení

**Nastavení → Veřejné API → Nový klíč**. Pojmenujte ho, vyberte, co může vidět (všechny servery nebo
specifickou podmnožinu) a volitelně datum vypršení platnosti. Celý klíč (Bearer token) se zobrazí
**jednou**, v dialogovém okně; zkopírujte si ho nyní, protože později se uchová pouze krátký prefix
pro identifikaci v seznamu.

![Nastavení veřejného API](/docs/images/settings-public-api.png)

Vytvoření prvního klíče automaticky zapne API (přepínač **Nechat externí aplikace
číst stav** slouží jako pozastavení: vypněte ho pro zastavení poskytování bez zrušení jakýchkoli klíčů).
Kdykoli můžete zrušit klíč ze stejné tabulky; klienti, kteří ho používají, okamžitě ztratí
přístup.

Tokeny jsou uloženy jako hash SHA-256 (nikdy ne v plaintextu), přežijí restart panelu
a přežijí servery, ke kterým jsou přiřazeny (smazaný server jednoduše
vypadne z výsledků daného tokenu).

## Autentizace

Token odešlete jako pověření Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Nejsou zde žádné cookies a **žádné CORS**: toto je určeno pro volání mezi servery a z příkazové řádky,
nikoli pro prohlížečové aplikace z jiného původu. Pokud je panel za reverzním proxy, ujistěte se, že
proxy předává hlavičku `Authorization`.

Chyby vracejí `401` s `{ "ok": false, "error": "..." }`. Cokoli jiného než `GET`
(nebo `HEAD`) vrací `405`. Neznámé cesty vracejí `404`. Když je API zakázané, všechny cesty
vracejí `404`.

## Omezení rychlosti

Každý token má svůj vlastní rozpočet, `RATE_LIMIT_PUBLIC_API_PER_MIN` (výchozí `120`
požadavků/minutu; `0` omezovač vypne). Překročení limitu vrací `429`. Požadavky, které
nikdy nepředloží platný token (chybějící, neplatný formát, zrušený nebo vypršený), jsou omezeny
samostatně na IP klienta na pětinásobek tohoto čísla, takže zkoumání nemůže obejít rozpočet
rotací tokenů.

## Koncové body

### `GET /api/v1/servers`

Každý server, ke kterému je token přiřazen.

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

Jeden server, stejný objekt pod klíčem `server`. Vrací `404` pro neznámé id
**a** pro server, ke kterému token není přiřazen (žádný zdroj existence), a `400`
pro neplatný formát id.

## Pole odpovědi

| Pole            | Význam                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| `total`         | Kolik serverů je pro tento token viditelných (po filtrování rozsahu).                     |
| `online`        | Kolik z nich je ve stavu: `running`.                                                      |
| `id`            | Stabilní id serveru (`srv_...`).                                                          |
| `name`          | Zobrazované jméno.                                                                        |
| `type`          | Typ serveru itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                             |
| `state`         | `running`, `starting`, `stopped` nebo `crashed` - stabilní souhrn interního stavu panelu. |
| `cpuPct`        | Nedávné % CPU, nebo `null`, když server neběží.                                           |
| `memoryMb`      | Rezidentní paměť v MB, nebo `null`.                                                       |
| `memoryLimitMb` | Konfigurovaný limit paměti kontejneru v MB, nebo `null`.                                  |
| `uptimeSeconds` | Sekundy od spuštění kontejneru, nebo `null`.                                              |
| `players`       | `{ online, max }`, nebo `null`, dokud server nehlásí seznam hráčů.                        |

## Příklad

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
