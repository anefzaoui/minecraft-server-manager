---
title: 'Minecraft-Chatbot pro Server'
description: 'Das Panel bietet einen vom Administrator konfigurierten Chatbot für jeden verwalteten Minecraft-Server, der auf dem Tab Einstellungen → Chatbot des Servers eingerichtet wird.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Das Panel bietet einen vom Administrator konfigurierten Chatbot für jeden verwalteten Minecraft-Server, der auf dem Tab **Einstellungen → Chatbot** des Servers eingerichtet wird. Er verbindet sich mit einem OpenAI-kompatiblen Chat-Completions-Endpunkt, einschließlich Ollama auf einem anderen LAN-Host. Jeder Server hat seinen eigenen Endpunkt, sein eigenes Modell, seinen eigenen Aufrufsnamen, seine eigene Persona, seine eigene Transkriptionsrichtlinie, seine eigenen Outreach-Nachrichten und seine eigene Power-Richtlinie. Der Standardaufruf ist `@wizard`, und die Standard-Persona stellt einen alten, verspielten Zauberer im Spiel dar; beides ist editierbar.

![Chatbot-Einstellungen](/docs/images/integrations-chatbot.png)

## Spielerlebnis

- Jeder Spieler kann `@wizard <Nachricht>` (oder den konfigurierten Aufruf) für Gespräche und deterministische, Minecraft-versionsabhängige Vanilla-Rezept-Hilfe verwenden.
- Beitrittsgrüße und ein konfigurierbarer einmaliger Check-in während der Spielsitzung erinnern die Spieler daran, dass der Chatbot verfügbar ist. `@wizard chat` öffnet ein kurzes Opt-in-Gesprächsfenster; `@wizard bye` schließt es.
- **Basisbenutzer** können aktivierte Self/World-Powers aufrufen. **Power-Controller** können separat validierte Aktionen aufrufen, die einen anderen Online-Spieler betreffen. Spieler, die keiner dieser Gruppen angehören, bleiben auf reine Gespräche beschränkt.
- Self-Gifts von Basisbenutzern verwenden eine Item-Allowlist. Controller können einem anderen Spieler jedes gültige, mit Namespace versehene Vanilla- oder Modded-Item geben, vorbehaltlich der Mengenbeschränkung und anderer Power-Schutzmaßnahmen.

![Chatbot-Transkripte](/docs/images/chatbot-transcripts.png)

## Design und Sicherheit

Konfiguration und Transkripte sind nur für Administratoren zugänglich. Das Modell erhält niemals rohes RCON oder beliebige Befehlsausführungen. Eine Nachricht gibt nur das einzelne feste Tool preis, das seiner expliziten Absicht entspricht; der Servercode validiert Autorisierung, Argumente, Flags, Mengen, Cooldowns und exakte Online-Spielernamen, bevor eine bestehende Serviceoperation ausgeführt wird. Minecraft-Selektoren werden abgelehnt, Cross-Player-Aktionen können nicht den Aufrufer anvisieren, Powers beginnen im Dry-Run-Modus und jede versuchte Power wird auditiert. Nicht unterstützte Tool-Calling-Modelle fallen auf reine Konversation zurück.

Antworten sind für den Minecraft-Chat begrenzt. Bekannte Vanilla-Rezepte stammen aus gebündelten, versionierten Rezeptdaten und werden als stabile 2x2/3x3-Reihen gerendert; die LLM wird nicht darauf vertraut, Rezeptlayouts zu erfinden. Unbekannte oder Modded-Rezepte leiten den Spieler zu JEI/REI weiter, anstatt eine Antwort zu fabrizieren.

## Hauptimplementierungsdateien

- `src/services/wizard.js`: Pro-Server-Konfiguration, OpenAI-kompatible Anfragen, Chat-Handling, Outreach, Transkript-Aufbewahrung und Antwortlimits.
- `src/services/wizardPowers.js`: Rollenprüfungen, absichtsspezifische Tool-Schemas, Validierung, Ausführung, Cooldowns und Power-Audits.
- `src/services/wizardRecipes.js`: Deterministische, versionierte Rezeptsuche und Gitterformatierung. Rezept- und Itemdaten stammen aus dem gebündelten [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) Paket. (Ein früher Entwurf dieses Dokuments verwies auf einen Ordner `src/data/recipes/`, der nie committet wurde; es gibt keinen solchen Ordner, und die Daten befinden sich im Paket. Siehe "Dependency footprint".)
- `src/analytics/ingest.js`: Leitet geparste Joins, Leaves und Spielerchats an den Chatbot weiter.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` und `views/partials/server/integrations.hbs` (via `chatbot.hbs`): Admin-API und der Pro-Server-Tab Einstellungen → Chatbot.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js` und `019_wizard_power_controllers.js`: Persistentes Schema.
- `test/wizard.test.js`: Autorisierungs-, Tool-Boundary-, Aufbewahrungs-, Outreach- und Chat-Verhaltenstests.

Die internen Namen der Routen/Module/Tabellen `wizard` werden aus Gründen der Upgrade- und API-Kompatibilität beibehalten; "chatbot" ist der für den Benutzer sichtbare Produktbegriff. Ebenso entspricht das gespeicherte Feld `power_testers_json` der Gruppe **Basisbenutzer** in der Benutzeroberfläche.

## Dependency footprint (`minecraft-data`)

Die Rezept-Hilfe verwendet das Paket `minecraft-data`. Es ist groß auf der Festplatte (ca. 429 MB installiert) und wird im Produktionsimage mitgeliefert, da es eine Laufzeitabhängigkeit und keine Entwicklungsabhängigkeit ist. Wir behalten es absichtlich bei, damit die Rezept-Hilfe offline für jede Minecraft-Version ohne Netzwerkaufruf funktioniert.

Hinweise für den nächsten Betrachter (Mensch oder KI), damit die Größe keine Überraschung ist:

- Nur die Java (`pc`) Daten werden derzeit verwendet. `wizardRecipes.js` liest `minecraftData.versions.pc` und die pro-Version `recipes`, `items` und `blocks` Tabellen. Die Dateien, auf die es tatsächlich zugreift, summieren sich auf etwa 15 MB über alle PC-Versionen hinweg.
- Etwa 330 MB des Pakets sind `data/bedrock`, und nichts hier liest sie bisher. Wir lassen sie absichtlich dort. Wenn das Panel jemals Bedrock Minecraft-Unterstützung hinzufügt, sind die Bedrock-Rezept- und Itemdaten bereits vorhanden, sodass die Rezeptfunktion erweitert werden kann, um Bedrock-Server abzudecken, ohne eine neue Abhängigkeit hinzuzufügen. Beginnen Sie mit `minecraftData.versions.bedrock` und folgen Sie der gleichen Struktur wie der PC-Pfad.
- Wenn die Größe jemals reduziert werden muss, bevor die Bedrock-Unterstützung eintrifft, gibt es in diesem Repository bereits ein Muster dafür. `src/services/itemRegistry.js` ruft `minecraft-data`-Dateien vom jsDelivr CDN ab, wenn es sie benötigt, und speichert sie im Cache in `api_cache`. Entweder dieser Ansatz oder eine kleine, handverlesene Untermenge von `src/data/recipes/`, die einige gängige Versionen abdeckt, würde das Image erheblich verkleinern.

## Lokaler Speicher und manuelle Inspektion

Alle Einstellungen und gespeicherten Transkripte befinden sich in der Panel-SQLite-Datenbank unter `/data/panel.db` im Panel-Container. Mit dem Standard-Compose-Mount ist der Host-Pfad `${DATA_DIR_HOST}/panel.db` (z. B. `/opt/msm/data/panel.db`). Relevante Tabellen sind `wizard_configs`, `wizard_transcripts` und `wizard_outreach`; Power-Audits sind Zeilen in der Tabelle `events` mit dem Typ `wizard-power`. Der optionale LLM API-Schlüssel ist AES-256-GCM-verschlüsselt mit dem At-Rest-Schlüssel des Panels, `.secret-key` im Datenordner (getrennt von `SESSION_SECRET`).

Sichern Sie die Datenbank und stoppen Sie das Panel, bevor Sie direkte SQLite-Bearbeitungen vornehmen, damit die WAL sicher gehandhabt wird. Die Verwendung der Admin-UI/API wird bevorzugt, da sie Validierung und Verschlüsselung anwendet. Bewahren Sie die Dateien `panel.db`, `panel.db-wal` und `panel.db-shm` zusammen auf, wenn Sie eine Live-Datenbank kopieren.
