---
title: 'Je Minecraft-server start niet'
description: 'Een Minecraft-server die niet start, opgelost in volgorde van waarschijnlijkheid: het logboek, de Java-versie, geheugen, de EULA en poort, en mods.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Terug naar de documentatie-index](/docs/)

Werk deze lijst af. De volgorde is gebaseerd op hoe vaak elk punt het antwoord is, en de eerste vier dekken de meeste gevallen.

## 1. Lees de laatste twintig regels, niet de eerste

Scroll naar het **einde** van het logboek. Een Java stack trace wordt van binnen naar buiten afgedrukt, dus het begin van de
tekstmuur is het minst interessante deel. Wat je wilt is de laatste `Caused by:` regel en wat daarop volgt. Die ene regel
noemt meestal het probleem.

Twee vormen vertellen je waar je bent:

- `Exception in thread "main"` of een pad naar een crashrapport aan het einde betekent dat het spel zelf is vastgelopen.
- Het logboek dat midden in een regel stopt, zonder enige uitzondering, betekent dat iets het proces van buitenaf heeft beëindigd. Ga naar punt 3.

## 2. UnsupportedClassVersionError betekent de verkeerde Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main is gecompileerd
door een recentere versie van de Java Runtime (class file version 65.0)
```

Class file 52 is Java 8, 60 is 16, 61 is 17, 65 is 21, 69 is 25. Het bericht betekent dat de server een nieuwere
Java nodig heeft dan waarop hij draait; het omgekeerde, een oud pakket op nieuwe Java, resulteert meestal in een mixin- of
reflectiefout.

| Minecraft-versie  | Java |
| ----------------- | ---- |
| 1.16.5 en eerder  | 8    |
| 1.17              | 16   |
| 1.18 en 1.19      | 17   |
| 1.20 tot 1.20.4   | 17   |
| 1.20.5 tot 1.21.x | 21   |
| 26.1 en later     | 25   |

Oude pakketten hebben echt Java 8 nodig. Nieuwer is hier niet beter.

## 3. Exit code 137 is de kernel, niet een mod

Het logboek stopt midden in een zin, er is geen crashrapport, en de container meldt 137. Dat is een
out-of-memory kill: het proces vroeg om geheugen dat de machine niet had, dus het werd beëindigd.

Bijna altijd was de Java heap ingesteld op hetzelfde aantal als het geheugen van de machine. De heap heeft het
geheugen van de machine nodig **min** de eigen overhead van de JVM, wat 0,5 tot 1,5 GB is op een modded server. Verlaag
de heap, of verhoog de machine. [Hoeveel RAM een server nodig heeft](/docs/guide-server-memory/) bevat de
cijfers.

## 4. De EULA en de poort

Twee klassiekers met oplossingen van één regel:

- `You need to agree to the EULA in order to run the server.` Stel `eula=true` in, in `eula.txt` of met de
  omgevingsvariabele die je setup gebruikt.
- `Address already in use` of `FAILED TO BIND TO PORT`. Iets anders bezet poort 25565, vaak een vorige
  kopie van dezelfde server die nooit volledig is gestopt. Zoek die en stop hem in plaats van de
  poort te wijzigen, anders eindig je met twee.

## 5. Een mod mist zijn afhankelijkheid

```
Mod X vereist mod Y, die ontbreekt
Fabric API is niet geïnstalleerd
```

Fabric mods hebben overweldigend de Fabric API nodig als een apart bestand. Forge en NeoForge mods vermelden hun
afhankelijkheden in de foutmelding zelf. Installeer de genoemde versie, niet de nieuwste: "vereist 0.91.x"
betekent die regel, en 0.92 zal dezelfde controle falen.

Soms is de ontbrekende afhankelijkheid de loader zelf:

```
Mod X vereist forge 47.4.14 of hoger
Mod ID: 'forge', Aangevraagd door: 'x', Verwachte bereik: '[47.4.14,)', Werkelijke versie: '47.4.10'
```

De oplossing is een nieuwere loader build, niet een andere mod. "47.4.14 of hoger" betekent elke build vanaf daar
omhoog, en Forge publiceert niet elk nummer, dus de te installeren build kan de volgende zijn. Op een modpack, update eerst het pakket: een pakket waarvan de eigen loader-versie te oud is voor zijn mods is een bug voor de auteur om op te lossen.

## 6. Een mod is voor de verkeerde loader of versie

Een jar voor een andere loader faalt niet beleefd. Verwacht een mixin-fout, een `NoClassDefFoundError`,
of een crash binnen een klasse waarvan je nog nooit hebt gehoord. Controleer de pagina van de jar: de loader en de Minecraft
versie moeten exact overeenkomen. 1.20.1 en 1.20.4 zijn verschillende games voor mods.

## 7. De wereld is van een nieuwere versie

```
Deze wereld is gemaakt door een nieuwere versie van Minecraft
```

Werelden upgraden vooruit en nooit achteruit. Herstel de back-up van vóór de upgrade, of draai de
versie die de wereld verwacht. Er is geen downgrade-pad dat de chunks intact houdt.

## Toen het crashte na wekenlang prima te hebben gedraaid

Andere vraag, meestal een ander antwoord:

- **Het crashte onder belasting**, met timings die lange pauzes laten zien: garbage collection, dus kijk naar de heap-grootte vóór de mods.
- **Het crashte op hetzelfde punt in de wereld**: een corrupte chunk of een defecte entiteit. Het crashrapport
  noemt meestal coördinaten.
- **Het crashte vlak na een update**: de mod die is bijgewerkt is de verdachte, zelfs als de trace ergens anders naartoe wijst. Rol deze terug en kijk.
- **Het crashte bij het opnieuw opstarten, na eerder prima te hebben gewerkt**: controleer de schijf. Een volle schijf veroorzaakt spectaculaire en misleidende fouten.

## Hulp krijgen die echt helpt

Post het **hele logboek**, niet de laatste regel, en vertel wat je hebt gewijzigd voordat het brak. Plak het
ergens waar het voor bedoeld is, zoals [mclo.gs](https://mclo.gs), in plaats van in de chat. Vermeld de
Minecraft-versie, de loader, het pakket en de versie ervan, en hoeveel heap de server heeft. Een rapport
met die vier feiten krijgt antwoord in één reactie; zonder die feiten duurt het vijf reacties.

## In Minecraft Server Manager

Crashes worden gedetecteerd aan de hand van de eigen exit van de container, dus een server die 's nachts om drie uur crasht, wordt
opgeslagen met het logboekfragment in plaats van de volgende dag te worden gevonden. De gebruikelijke verdachten op deze pagina (de
EULA, de verkeerde Java, een wereld van een nieuwere versie, een poort die al in gebruik is, Java dat geen geheugen meer heeft)
worden herkend in dat logboek en genoemd in de geschiedenisvermelding met wat eraan te doen, en automatisch opnieuw opstarten laat die
met rust, aangezien opnieuw opstarten ze niet zal oplossen. Crashrapporten worden bij binnenkomst geparseerd: de uitzondering wordt gemarkeerd, de stack is inklapbaar, en mods die in de trace voorkomen
worden als verdachten vermeld.

Elk rapport kan vanaf de kaart worden gedeeld met mclo.gs als je hulp nodig hebt (na een bevestiging, aangezien de paste openbaar is), en het **Download** menu van de console bevat elk logboekbestand als één zip, dus "post het hele logboek" is een download in plaats van een archeologisch project. Een out-of-memory kill wordt geregistreerd als een out-of-memory kill, wat de gebruikelijke uur durende blame van een mod bespaart. Als iets anders echt de poort nodig heeft, verplaatst de kaart **Game Port** op **Instellingen → Configuratie** de server naar een vrije poort.

Een te oude loader wordt gewijzigd via het tabblad **Versies** van de server, dat controleert of de build bestaat en een back-up maakt voordat de server opnieuw wordt opgebouwd ([de mod loader-versie wijzigen](/docs/updates/#changing-the-mod-loader-version)).

Gerelateerd: [hoeveel RAM een server nodig heeft](/docs/guide-server-memory/), [kiezen van een loader](/docs/guide-choosing-a-loader/),
[servers maken en beheren](/docs/servers/).
