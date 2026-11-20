---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: care să alegi?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge sau Quilt: ce tip de server Minecraft să rulezi, ales în funcție de ce instalează jucătorii tăi.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Înapoi la indexul documentației](/docs/)

Alege în funcție de ce vrei ca jucătorii să instaleze, nu în funcție de ce sună mai rapid.

| Vrei                                                       | Rulează asta        | Jucătorii instalează |
| ---------------------------------------------------------- | ------------------- | -------------------- |
| Supraviețuire cu prietenii, nimic neobișnuit               | Vanilla             | Nimic                |
| Un server public cu ranguri, revendicări și moderare       | Paper               | Nimic                |
| Un pachet de moduri specific de pe CurseForge sau Modrinth | Orice spune         | Pachetul             |
| Un pachet de moduri modern pe care îl construiești singur  | Fabric sau NeoForge | Aceleași moduri      |
| Un pachet vechi din era 1.7 până la 1.12                   | Forge               | Aceleași moduri      |

Aceasta este decizia pentru majoritatea oamenilor. Restul acestei pagini explică de ce.

## Pluginurile și modurile nu sunt același lucru

Aceasta este distincția de care depinde tot restul.

**Pluginurile** rulează doar pe server. Paper, Spigot și Bukkit le încarcă. Jucătorii se conectează cu un client obișnuit, nemodificat și nu află niciodată. Orice este fundamental legat de reguli, permisiuni, economii, revendicări, minijocuri sau moderare este un plugin, și de aceea aproape fiecare server public rulează Paper.

**Modurile** schimbă jocul în sine: blocuri noi, dimensiuni noi, mașini noi. Clientul trebuie să încarce aceleași moduri ca și serverul, altfel nu poate înțelege ce îi spune serverul. Oricine se conectează la un server cu moduri instalează mai întâi pachetul.

Un server nu poate fi în mod semnificativ ambele. Există proiecte hibride care adaugă o API de pluginuri peste un încărcător de moduri, și acestea funcționează până când nu mai funcționează, de obicei în cel mai prost moment. Dacă ai nevoie de ambele, rulează un proxy cu un server cu moduri și un server de pluginuri în spate, mai degrabă decât un singur hibrid.

## Partea de pluginuri

**Paper** este răspunsul implicit. Este o ramură a Spigot cu ani de muncă la performanță și un fișier de configurare pentru aproape fiecare comportament care a deranjat vreodată un administrator. Pluginurile Vanilla din era Bukkit încă rulează în mare parte.

**Purpur** este o ramură a Paper cu și mai multe opțiuni, inclusiv cele legate de gameplay. Alege-l dacă vrei acele comutatoare specifice; altfel, Paper.

**Vanilla** merită rulat atunci când scopul este jocul neschimbat. Este mai lent cu mulți jucători și nu are sistem de permisiuni, deci moderarea este manuală.

Paper schimbă implicit unele comportamente vanilla în numele performanței. Dacă o capcană de redstone dintr-un videoclip nu funcționează pe serverul tău, acesta este de obicei motivul, și de obicei este o setare.

## Partea de moduri

**Fabric** este mic, se actualizează la o nouă versiune Minecraft în câteva zile și include majoritatea modurilor moderne de performanță. Aproape fiecare mod Fabric necesită și Fabric API, care este o descărcare separată. Dacă scopul tău este un server rapid cu câteva moduri de calitate a vieții, acesta este cel potrivit.

**NeoForge** este locul unde vechiul ecosistem Forge își desfășoară acum activitatea pentru versiunile curente. S-a separat de Forge în timpul versiunii 1.20.1, iar majoritatea pachetelor mari construite pentru 1.20.2 și versiunile ulterioare vizează acest lucru. Dacă începi un pachet greu nou astăzi, acesta este cel potrivit.

**Forge** încă deține trecutul. Orice din erele 1.7.10, 1.12.2 și 1.16.5, care reprezintă o mare parte din pachetele iubite, este Forge și va fi mereu. Păstrează-l pentru acestea.

**Quilt** este o ramură a Fabric care rulează majoritatea modurilor Fabric. Există din motive întemeiate, dar dacă nu ai un motiv specific să-l alegi, alege Fabric.

Modurile pentru un încărcător nu rulează pe altul. O pagină de moduri care spune Fabric înseamnă Fabric.

## Dacă instalezi un pachet, pachetul decide

Nu alege tu. Pachetul listează încărcătorul și versiunea exactă de Minecraft, iar ambele trebuie să se potrivească. "Destul de aproape" nu este un lucru aici: un pachet pentru 1.20.1 nu rulează pe 1.20.4, iar un pachet NeoForge 1.20.1 nu rulează pe Forge 1.20.1.

Instalează pachetul după ID-ul sau linkul său, mai degrabă decât selectând manual modurile, și fixează versiunea. Pachetele se actualizează, iar o actualizare care apare pe neașteptate în mijlocul sezonului este modul în care lumile se corup.

## Ce versiune de Java

Cerința Minecraft se mută odată cu jocul, iar rularea celei greșite produce un `UnsupportedClassVersionError` neajutorător, mai degrabă decât un mesaj clar.

| Versiune Minecraft    | Java |
| --------------------- | ---- |
| 1.16.5 și anterioare  | 8    |
| 1.17                  | 16   |
| 1.18 și 1.19          | 17   |
| 1.20 până la 1.20.4   | 17   |
| 1.20.5 până la 1.21.x | 21   |
| 26.1 și ulterioare    | 25   |

Pachetele vechi au cu adevărat nevoie de Java 8; acesta este unul dintre puținele locuri din software unde cea mai nouă versiune este greșită.

## În Minecraft Server Manager

Vrăjitorul de creare întreabă ce vrei să rulezi și alege versiunea de Java din tabelul de mai sus, astfel încât nepotrivirea să nu se întâmple niciodată accidental. Vanilla, Paper și Purpur se află pe fila **Vanilla**; fila **De la moduri** acceptă Fabric, Forge, NeoForge sau Quilt, cu versiunea Minecraft și o compilare a încărcătorului (cea mai recentă sau una pe care o fixezi). Instalarea unui pachet de pe CurseForge, Modrinth sau GT New Horizons îl fixează la o versiune exactă. Actualizarea are loc doar atunci când o aplici (sau după verificarea zilnică, dacă politica de actualizare a serverului este **Actualizare automată**), face întotdeauna o copie de rezervă mai întâi și poate fi anulată.

Browserul de moduri știe ce încărcător rulează un server și filtrează ceea ce oferă în consecință, astfel încât un fișier jar Fabric să nu ajungă greșit pe un server NeoForge.

Legate de: [crearea și gestionarea serverelor](/docs/servers/), [pachete de moduri](/docs/modpacks/),
[cât RAM necesită un server](/docs/guide-server-memory/).
