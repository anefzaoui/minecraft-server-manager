---
title: 'Öffentliche API'
description: 'Eine kleine, schreibgeschützte HTTP-API zum Abrufen des Serverstatus von außerhalb des Panels: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Eine kleine, schreibgeschützte HTTP-API zum Abrufen des Serverstatus außerhalb des Panels: ein
Status-Dashboard, ein Uptime-Monitor, ein Discord-Bot, eine Hausautomatisierungsregel. Sie wird
vom Panel selbst bereitgestellt und gibt dieselben Live-Daten zurück, die die eigenen Seiten
des Panels anzeigen (aus dem In-Memory-Cache), sodass das Abfragen niemals Docker berührt.

Sie ist **ausgeschaltet, bis ein Administrator sie verwendet**, und **administratorgeschützt**. Nichts wird
offengelegt, bis ein Token existiert.

## Aktivieren

**Einstellungen → Öffentliche API → Neuer Schlüssel**. Geben Sie ihr einen Namen, wählen Sie aus, was sie sehen kann (alle
Server oder eine bestimmte Teilmenge) und optional ein Ablaufdatum. Der vollständige Schlüssel (ein
Bearer-Token) wird **einmal** in einem Dialog angezeigt; kopieren Sie ihn jetzt, da danach nur noch ein kurzer Präfix
zur Identifizierung in der Liste gespeichert wird.

![Einstellungen der öffentlichen API](/docs/images/settings-public-api.png)

Das Erstellen des ersten Schlüssels schaltet die API automatisch ein (der
Schalter **Außenstehenden Apps den Status anzeigen** ist eine Pausensteuerung: Schalten Sie ihn aus, um die Bereitstellung zu stoppen, ohne Schlüssel zu stornieren). Ein Schlüssel kann jederzeit aus derselben Tabelle storniert werden; Clients, die ihn verwenden, verlieren
sofort den Zugriff.

Tokens werden als SHA-256-Hash gespeichert (niemals im Klartext), überstehen einen Panel-Neustart
und überdauern die Server, für die sie bestimmt sind (ein gelöschter Server wird einfach
aus den Ergebnissen dieses Tokens entfernt).

## Authentifizierung

Senden Sie das Token als Bearer-Credential:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Es gibt keine Cookies und **kein CORS**: Dies ist für Server-zu-Server- und CLI-Aufrufer gedacht, nicht für Browser-Apps von anderen Ursprüngen. Wenn das Panel hinter einem Reverse-Proxy liegt, stellen Sie sicher, dass der Proxy den `Authorization`-Header weiterleitet.

Fehler geben `401` mit `{ "ok": false, "error": "..." }` zurück. Alles andere als `GET`
(oder `HEAD`) gibt `405` zurück. Unbekannte Pfade geben `404` zurück. Wenn die API deaktiviert ist, gibt jede Route
`404` zurück.

## Ratenbegrenzung

Jedes Token erhält sein eigenes Budget, `RATE_LIMIT_PUBLIC_API_PER_MIN` (Standard `120`
Anfragen/Minute; `0` deaktiviert den Begrenzer). Überschreitungen geben `429` zurück. Anfragen, die niemals ein gültiges Token präsentieren (fehlend, fehlerhaft, widerrufen oder abgelaufen), werden separat pro Client-IP auf das Fünffache dieser Zahl begrenzt, sodass das Ausprobieren das Budget nicht durch das Rotieren von Tokens umgehen kann.

## Endpunkte

### `GET /api/v1/servers`

Jeder Server, für den das Token bestimmt ist.

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

Ein einzelner Server, dasselbe Objekt unter einem `server`-Schlüssel. Gibt `404` für eine unbekannte ID
**und** für einen Server zurück, für den das Token nicht bestimmt ist (kein Existenz-Orakel), und `400`
für eine fehlerhafte ID.

## Antwortfelder

| Feld            | Bedeutung                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `total`         | Wie viele Server für dieses Token sichtbar sind (nach seinem Geltungsbereichsfilter).                          |
| `online`        | Wie viele davon im Zustand `running` sind.                                                                     |
| `id`            | Stabile Server-ID (`srv_...`).                                                                                 |
| `name`          | Anzeigename.                                                                                                   |
| `type`          | itzg Servertyp (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                                    |
| `state`         | `running`, `starting`, `stopped` oder `crashed` - eine stabile Zusammenfassung des internen Status des Panels. |
| `cpuPct`        | Aktuelle CPU-Auslastung in %, oder `null`, wenn der Server nicht läuft.                                        |
| `memoryMb`      | Belegter Arbeitsspeicher in MB, oder `null`.                                                                   |
| `memoryLimitMb` | Konfigurierte Container-Speicherbegrenzung in MB, oder `null`.                                                 |
| `uptimeSeconds` | Sekunden seit dem Start des Containers, oder `null`.                                                           |
| `players`       | `{ online, max }`, oder `null`, bis der Server eine Spielerliste meldet.                                       |

## Beispiel

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
