---
title: 'Een Minecraft-server verplaatsen naar een andere host'
description: 'Een wereld verplaatsen is eenvoudig. Een server verplaatsen waar spelers nog steeds op kunnen inloggen, met hun inventarissen, huizen en permissies intact, is het deel dat misgaat.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Terug naar de documentatie-index](/docs/)

Een wereld verplaatsen is eenvoudig. Een server verplaatsen waar spelers nog steeds op kunnen inloggen, met hun inventarissen, huizen en permissies intact, is het deel dat misgaat. De onderstaande volgorde beperkt de downtime tot een paar minuten en behoudt een terugvaloptie als de nieuwe machine teleurstelt.

## Neem eerst de stand van zaken op

Schrijf deze op voordat u iets aanraakt. Elk van deze punten heeft een migratie slecht beëindigd omdat het werd aangenomen in plaats van gecontroleerd:

- **Minecraft-versie en loader**, exact. 1.20.1 NeoForge is niet 1.20.1 Forge.
- **De lijst met mods of plugins met versies.** De wereld zal niet laden zonder de mods die deze hebben gemaakt.
- **Java-versie**, die de Minecraft-versie volgt.
- **`level-name`** uit `server.properties`. De wereldmap heet vaak niet `world`.
- **Online modus.** Als de oude server draaide met `online-mode=false` en de nieuwe met `online-mode=true`, of omgekeerd, krijgt elke speler een andere UUID en dus een gloednieuwe, lege inventaris. Dit is de meest pijnlijke fout op deze pagina.
- **Alles wat buiten de servermap leeft**, zoals de MySQL-database van een plugin.

## Kopieer terwijl het draait, kopieer dan opnieuw terwijl het gestopt is

De truc voor korte downtime is om eerst de trage kopie te doen.

1. **Terwijl de server draait**, kopieer de hele servermap naar de nieuwe machine. Op een grote wereld kan dit een uur duren; niemand merkt het, omdat niets is gestopt.
2. **Kondig een herstart aan, stop dan de server correct.** Een nette stop zorgt ervoor dat het spel de wereld opslaat; het proces beëindigen doet dat niet.
3. **Kopieer opnieuw.** Alleen de bestanden die zijn gewijzigd, worden deze keer verplaatst, dus het duurt seconden tot minuten.
4. **Start het op de nieuwe machine**, indien mogelijk op een niet-openbare poort, en ga er zelf naartoe. Controleer een basis die u kent, uw eigen inventaris, en of plugins of mods zonder fouten zijn geladen.
5. **Wijs de spelers er vervolgens op.**

`rsync -a --delete` is het gebruikelijke gereedschap voor stappen 1 en 3. Behoud permissies en tijdstempels: een wereld die als de verkeerde gebruiker is gekopieerd, is een server die niet zal starten, en de foutmelding zal dit niet duidelijk zeggen.

## Verwijder de oude nog niet

Houd de oude machine, gestopt maar intact, minstens een paar dagen. Het is de enige echte terugvaloptie. Houd deze uitgeschakeld in plaats van draaiend, zodat niemand per ongeluk de verlaten kopie binnenkomt en daar een week lang bouwt.

## Zorg dat het adres de verhuizing overleeft

Als spelers verbinding maken met een kaal IP-adres, dwingt elke verhuizing elke speler om hun serverlijst te bewerken, en sommigen doen dat nooit.

Gebruik een hostnaam die u beheert, gericht op de server. Verhuizen wordt dan een DNS-wijziging, en het adres in de client van iedereen blijft hetzelfde. Verlaag de time-to-live van het record een dag voor de verhuizing, zodat de wijziging snel wordt doorgevoerd.

Als u wilt dat spelers een kale domeinnaam typen terwijl de server op een niet-standaard poort draait, doet een SRV-record dat. Het is hetzelfde mechanisme dat commerciële hosts gebruiken om `play.something.net` uit te delen.

## Controleer de nieuwe machine voordat u deze vertrouwt

Drie dingen die verschillen tussen hosts en na de verhuizing problemen veroorzaken:

- **De firewall.** Uw gamepoort moet open zijn, en alleen uw gamepoort. Stel een beheerpaneel of een kaart niet bloot aan internet, alleen omdat het op localhost werkte.
- **Single-core snelheid.** Minecraft geeft veel meer om hoe snel één kern is dan om hoeveel er zijn. Acht langzame kernen voelen slechter dan twee snelle.
- **Schijf.** Een wereld op draaiende opslag of een zwaar gedeeld volume zal haperen tijdens het laden van chunks.

## Een beheerd paneel verlaten

Als u van een host komt die u een controlepaneel gaf in plaats van een machine, zoek dan de download- of bestandsbeheerder en neem de hele servermap mee in plaats van alleen de wereld. Haal de plugin- en mod-jars zelf op, niet een lijst: de versies zijn belangrijk, en "nieuwste" is volgende maand een ander bestand.

Controleer ook of uw back-ups van u zijn. Een back-up die alleen bestaat binnen het paneel dat u verlaat, is geen back-up die u bezit.

## In Minecraft Server Manager

Het hele paneel is één map. Door het naar een andere machine te kopiëren en het paneel daar te starten, worden elke server, wereld, back-up en instelling meegebracht, wat het verplaatsen van het paneel zelf een kopie maakt in plaats van een migratie.

Voor één server in plaats van allemaal, legt een blueprint de configuratie, mod-set en vastgezette pack-versie vast (en, als u het aanvinkt, de actieve wereld) als één `.mcserver.zip` die op een ander paneel kan worden geïmporteerd om dezelfde server opnieuw op te bouwen. Werelden kunnen afzonderlijk worden gedownload en geïnstalleerd wanneer alleen de wereld moet reizen.

Als de gamepoort die een server gebruikte al bezet is op de nieuwe machine, of u wilt eerst testen op een niet-openbare poort, wijzig deze dan op **Instellingen → Configuratie**: de kaart **Gamepoort** heeft **Gebruik Volgende Vrije Poort**, een draaiende server vraagt voordat deze opnieuw opstart op de nieuwe poort, en als deze daar niet kan starten, gaat deze terug naar de oude. Schakel deze over naar de openbare poort wanneer u de spelers erop wijst.

Gerelateerd: [blueprints](/docs/blueprints/), [back-ups die daadwerkelijk herstellen](/docs/guide-backups/), [werelden en bestanden](/docs/worlds-and-files/).
