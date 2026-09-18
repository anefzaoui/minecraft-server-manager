---
title: 'Minecraft-Chatbot pro Server'
description: 'Diese Abspaltung fügt jedem verwalteten Minecraft-Server einen vom Administrator konfigurierten Chatbot hinzu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Zurück zum Doku-Index](/docs/)

Dieser Fork fügt jedem verwalteten Minecraft-Server einen vom Administrator konfigurierten Chatbot hinzu. Er verbindet sich mit einem OpenAI-kompatiblen Chat-Completions-Endpunkt, einschließlich Ollama auf einem anderen LAN-Host. Jeder Server hat seinen eigenen Endpunkt, sein eigenes Modell, seinen eigenen Aufrufsnamen, seine eigene Persona, seine eigene Transkriptionsrichtlinie, seine eigenen Outreach-Nachrichten und seine eigene Machtrichtlinie. Der Standardaufruf ist `@wizard`, und die Standard-Persona demonstriert einen alten, verspielten In-World-Zauberer; beide sind editierbar.

![Chatbot-Einstellungen](/docs/images/integrations-chatbot.png)

## Spielerlebnis

- Jeder Spieler kann `@wizard <Nachricht>` (oder den konfigurierten Aufruf) für Gespräche und deterministische, Minecraft-versionsabhängige Vanilla-Rezept-Hilfe verwenden.
- Beitrittsgrüße und eine konfigurierbare einmalige Überprüfung der Spielsitzung erinnern die Spieler daran, dass der Chatbot verfügbar ist. `@wizard chat` öffnet ein kurzes Opt-in-Gesprächsfenster; `@wizard bye` schließt es.
- **Basisbenutzer** können aktivierte Selbst-/Welt-Mächte aufrufen. **Machtkontrolleure** können separat validierte Aktionen aufrufen, die einen anderen Online-Spieler betreffen. Spieler in keiner der beiden Gruppen bleiben nur für Gespräche.
- Selbstgeschenke von Basisbenutzern verwenden eine Item-Allowlist. Kontrolleure können einem anderen Spieler jedes gültige, mit Namespace versehene Vanilla- oder Modded-Item geben, vorbehaltlich der Mengenbeschränkung und anderer Machtschutzmaßnahmen.

![Chatbot-Transkripte](/docs/images/chatbot-transcripts.png)

## Design und Sicherheit

Konfiguration und Transkripte sind nur für Administratoren bestimmt. Das Modell erhält niemals rohes RCON oder beliebige Befehlsausführungen. Eine Nachricht gibt nur das einzelne feste Werkzeug preis, das seiner expliziten Absicht entspricht; der Servercode validiert Autorisierung, Argumente, Flags, Mengen, Cooldowns und exakte Online-Spielernamen, bevor eine bestehende Serviceoperation ausgeführt wird. Minecraft-Selektoren werden abgelehnt, Cross-Player-Aktionen können nicht den Aufrufer anvisieren, Mächte beginnen im Dry-Run-Modus und jede versuchte Macht wird auditiert. Nicht unterstützte Tool-Calling-Modelle fallen auf reine Konversation zurück.

Antworten sind für den Minecraft-Chat begrenzt. Bekannte Vanilla-Rezepte stammen aus gebündelten, versionierten Rezeptdaten und werden als stabile 2x2/3x3-Reihen gerendert; die LLM wird nicht darauf vertraut, Rezeptlayouts zu erfinden. Unbekannte oder modded Rezepte leiten den Spieler zu JEI/REI weiter, anstatt eine Antwort zu erfinden.

## Hauptimplementierungsdateien

- `src/services/wizard.js`: Pro-Server-Konfiguration, OpenAI-kompatible Anfragen, Chat-Handling, Outreach, Transkriptionsaufbewahrung und Antwortlimits.
- `src/services/wizardPowers.js`: Rollenprüfungen, absichtsspezifische Tool-Schemas, Validierung, Ausführung, Cooldowns und Macht-Audits.
- `src/services/wizardRecipes.js`: Deterministische, versionierte Rezeptsuche und Gitterformatierung. Rezept- und Itemdaten stammen aus dem gebündelten [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) Paket. (Ein früher Entwurf dieses Dokuments verwies auf einen Ordner `src/data/recipes/`, der nie committet wurde; es gibt keinen solchen Ordner, und die Daten befinden sich im Paket. Siehe "Abhängigkeits-Fußabdruck".)
- `src/analytics/ingest.js`: Leitet geparste Joins, Leaves und Spielerchats an den Chatbot weiter.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` und `views/partials/server/integrations.hbs`: Admin-API und Pro-Server-Integrations-UI.
- `src/db/migrations/011_wizard_chat.js` bis `019_wizard_power_controllers.js`: Persistentes Schema.
- `test/wizard.test.js`: Tests für Autorisierung, Tool-Grenzen, Aufbewahrung, Outreach und Chat-Verhalten.

Die internen Namen der Routen/Module/Tabellen `wizard` werden aus Gründen der Upgrade- und API-Kompatibilität beibehalten; "chatbot" ist der benutzerorientierte Produktbegriff. Ebenso entspricht das gespeicherte Feld `power_testers_json` der Gruppe **Basisbenutzer** in der UI.

## Abhängigkeits-Fußabdruck (`minecraft-data`)

Die Rezept-Hilfe verwendet das Paket `minecraft-data`. Es ist groß auf der Festplatte (ca. 429 MB installiert) und wird im Produktionsimage mitgeliefert, da es sich um eine Laufzeitabhängigkeit und nicht um eine Entwicklungsabhängigkeit handelt. Wir behalten es absichtlich bei, damit die Rezept-Hilfe offline für jede Minecraft-Version ohne Netzwerkaufruf funktioniert.

Hinweise für den nächsten Betrachter (Mensch oder KI), damit die Größe keine Überraschung ist:

- Derzeit werden nur die Java (`pc`) Daten verwendet. `wizardRecipes.js` liest `minecraftData.versions.pc` und die pro-Version `recipes`, `items` und `blocks` Tabellen. Die Dateien, die es tatsächlich berührt, summieren sich auf etwa 15 MB über alle PC-Versionen hinweg.
- Etwa 330 MB des Pakets sind `data/bedrock`, und nichts hier liest sie bisher. Wir lassen sie absichtlich an Ort und Stelle. Wenn das Panel jemals Bedrock Minecraft-Unterstützung hinzufügt, sind die Bedrock-Rezept- und Itemdaten bereits vorhanden, sodass die Rezeptfunktion wachsen kann, um Bedrock-Server abzudecken, ohne eine neue Abhängigkeit hinzuzufügen. Beginnen Sie mit `minecraftData.versions.bedrock` und folgen Sie der gleichen Struktur wie der PC-Pfad.
- Wenn die Größe jemals reduziert werden muss, bevor die Bedrock-Unterstützung eintrifft, gibt es in diesem Repository bereits ein Muster dafür. `src/services/itemRegistry.js` ruft `minecraft-data`-Dateien vom jsDelivr CDN ab, wenn es sie benötigt, und speichert sie im Cache in `api_cache`. Entweder dieser Ansatz oder eine kleine, handverlesene `src/data/recipes/`-Teilmenge, die einige gängige Versionen abdeckt, würde das Image erheblich verkleinern.

## Lokaler Speicher und manuelle Inspektion

Alle Einstellungen und gespeicherten Transkripte befinden sich in der Panel-SQLite-Datenbank unter `/data/panel.db` im Panel-Container. Mit dem Standard-Compose-Mount ist der Host-Pfad `${DATA_DIR_HOST}/panel.db` (z. B. `/opt/msm/data/panel.db`). Relevante Tabellen sind `wizard_configs`, `wizard_transcripts` und `wizard_outreach`; Macht-Audits sind Zeilen in der Tabelle `events` mit dem Typ `wizard-power`. Der optionale LLM-API-Schlüssel ist AES-256-GCM-verschlüsselt, wobei der `SESSION_SECRET` des Panels verwendet wird, der normalerweise als `${DATA_DIR_HOST}/.session-secret` gespeichert wird.

Sichern Sie die Datenbank und stoppen Sie das Panel, bevor Sie direkte SQLite-Bearbeitungen vornehmen, damit die WAL sicher behandelt wird. Die Verwendung der Admin-UI/API wird bevorzugt, da sie Validierung und Verschlüsselung anwendet. Bewahren Sie die Dateien `panel.db`, `panel.db-wal` und `panel.db-shm` zusammen auf, wenn Sie eine Live-Datenbank kopieren.
