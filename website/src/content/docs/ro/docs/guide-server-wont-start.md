---
title: 'Serverul tău Minecraft nu pornește'
description: 'Un server Minecraft care nu pornește, remediat în ordinea probabilității: log-ul, versiunea Java, memoria, EULA și portul, și mod-urile.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Înapoi la indexul documentației](/docs/)

Lucrează în jos pe această listă. Este ordonată după cât de des fiecare dintre ele este răspunsul, iar primele patru acoperă majoritatea cazurilor.

## 1. Citește ultimele douăzeci de linii, nu primele

Derulează la **sfârșitul** jurnalului. O urmă de stivă Java este tipărită din interior spre exterior, deci partea de sus a zidului de text este cea mai puțin interesantă. Ceea ce dorești este ultima linie `Caused by:` și ceea ce urmează după ea. Acea singură linie numește de obicei problema.

Două forme îți spun unde te afli:

- `Exception in thread "main"` sau o cale către un raport de blocare (crash report) aproape de sfârșit înseamnă că jocul în sine a eșuat.
- Jurnalul pur și simplu se oprește la jumătatea liniei, fără nicio excepție, înseamnă că ceva a oprit procesul din exterior. Sari la punctul 3.

## 2. UnsupportedClassVersionError înseamnă Java greșit

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Clasa fișier 52 este Java 8, 60 este 16, 61 este 17, 65 este 21, 69 este 25. Mesajul înseamnă că serverul are nevoie de un Java mai nou decât cel pe care rulează; inversul, un pachet vechi pe un Java nou, eșuează de obicei cu o eroare de mixin sau reflecție în schimb.

| Versiune Minecraft    | Java |
| --------------------- | ---- |
| 1.16.5 și anterioare  | 8    |
| 1.17                  | 16   |
| 1.18 și 1.19          | 17   |
| 1.20 până la 1.20.4   | 17   |
| 1.20.5 până la 1.21.x | 21   |
| 26.1 și ulterioare    | 25   |

Pachetele vechi au cu adevărat nevoie de Java 8. Mai nou nu este mai bine aici.

## 3. Codul de ieșire 137 este nucleul, nu un mod

Jurnalul se oprește la jumătatea propoziției, nu există un raport de blocare, iar containerul raportează 137. Aceasta este o oprire din lipsă de memorie (out-of-memory kill): procesul a cerut memorie pe care mașina nu o avea, așa că a fost terminat.

Aproape întotdeauna, memoria heap Java a fost setată la același număr ca memoria mașinii. Heap-ul are nevoie de memoria mașinii **minus** suprasolicitarea proprie a JVM, care este de 0,5 până la 1,5 GB pe un server cu moduri. Scade heap-ul sau mărește mașina. [Cât RAM necesită un server](/docs/guide-server-memory/) are cifrele.

## 4. EULA și portul

Două clasice cu soluții de o singură linie:

- `You need to agree to the EULA in order to run the server.` Setează `eula=true`, în `eula.txt` sau cu variabila de mediu pe care o folosește configurația ta.
- `Address already in use` sau `FAILED TO BIND TO PORT`. Altceva deține portul 25565, adesea o copie anterioară a aceluiași server care nu s-a oprit complet. Găsește-o și oprește-o în loc să schimbi portul, altfel vei ajunge cu două.

## 5. Un mod îi lipsește dependența

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Modurile Fabric au în mare parte nevoie de Fabric API ca fișier separat. Modurile Forge și NeoForge își listează dependențele în eroarea în sine. Instalează versiunea numită, nu cea mai nouă: "requires 0.91.x" înseamnă acea linie, iar 0.92 va eșua aceeași verificare.

Uneori, dependența lipsă este chiar încărcătorul (loader):

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Soluția este o versiune mai nouă a încărcătorului, nu un alt mod. "47.4.14 or above" înseamnă orice versiune de la acel punct în sus, iar Forge nu publică fiecare număr, așa că versiunea de instalat poate fi următoarea. Pe un modpack, actualizează mai întâi pachetul: un pachet a cărui versiune de încărcător este prea veche pentru modurile sale este un bug pe care autorul său trebuie să-l remedieze.

## 6. Un mod este pentru alt încărcător sau versiune greșită

Un fișier jar pentru un alt încărcător nu eșuează politicos. Așteaptă-te la o eroare de mixin, un `NoClassDefFoundError` sau o blocare într-o clasă despre care nu ai auzit niciodată. Verifică pagina fișierului jar: atât încărcătorul, cât și versiunea Minecraft trebuie să se potrivească exact. 1.20.1 și 1.20.4 sunt jocuri diferite în ceea ce privește modurile.

## 7. Lumea este dintr-o versiune mai nouă

```
This world was created by a newer version of Minecraft
```

Lumile se actualizează înainte și niciodată înapoi. Restaurează backup-ul de dinainte de actualizare sau rulează versiunea pe care o așteaptă lumea. Nu există o cale de downgrade care să păstreze bucățile (chunks) intacte.

## Când s-a blocat după ce a funcționat bine timp de săptămâni

Întrebare diferită, de obicei răspuns diferit:

- **S-a blocat sub sarcină**, cu timpi care arată pauze lungi: colectarea gunoiului (garbage collection), deci uită-te la dimensiunea heap-ului înainte de moduri.
- **S-a blocat în același punct din lume**: o bucată coruptă sau o entitate stricată. Raportul de blocare numește de obicei coordonatele.
- **S-a blocat imediat după o actualizare**: modul care s-a actualizat este suspectul, chiar dacă urmărirea indică altundeva. Revino la versiunea anterioară și vezi.
- **S-a blocat la repornire, după ce a fost bine înainte**: verifică discul. Un disc plin produce erori spectaculoase și înșelătoare.

## Obținerea de ajutor care ajută cu adevărat

Postează **întregul jurnal**, nu ultima linie, și spune ce ai schimbat înainte să se strice. Postează-l undeva destinat pentru asta, cum ar fi [mclo.gs](https://mclo.gs), în loc să-l pui în chat. Include versiunea Minecraft, încărcătorul, pachetul și versiunea sa, și cât heap are serverul. Un raport cu aceste patru informații primește răspuns într-o singură replică; fără ele, durează cinci.

## În Minecraft Server Manager

Blocările sunt detectate din ieșirea containerului în sine, deci un server care moare la ora trei dimineața este înregistrat cu extrasul său de jurnal, în loc să fie găsit a doua zi. Suspecții obișnuiți de pe această pagină (EULA, Java greșit, o lume dintr-o versiune mai nouă, un port deja utilizat, Java rămâne fără memorie) sunt recunoscuți în acel jurnal și numiți în intrarea de istoric cu ce să faci în legătură cu ei, iar repornirea automată le ignoră, deoarece repornirea nu îi va remedia. Rapoartele de blocare sunt analizate la sosire: excepția este evidențiată, stiva poate fi extinsă, iar modurile care apar în urmărire sunt listate ca suspecți.

Orice raport poate fi partajat pe mclo.gs din cardul său atunci când ai nevoie de ajutor (după o confirmare, deoarece postarea este publică), iar meniul **Download** al consolei are toate fișierele jurnal ca un singur zip, deci "postează întregul jurnal" este o descărcare în loc de un proiect de arheologie. O oprire din lipsă de memorie este înregistrată ca o oprire din lipsă de memorie, ceea ce economisește ora obișnuită de învinovățire a unui mod. Dacă altceva are cu adevărat nevoie de port, cardul **Game Port** din **Settings → Configuration** mută serverul pe unul liber.

Un încărcător prea vechi este schimbat din tab-ul **Versions** al serverului, care verifică dacă versiunea există și face un backup înainte de a reconstrui serverul ([schimbarea versiunii încărcătorului de moduri](/docs/updates/#changing-the-mod-loader-version)).

Legate de: [cât RAM necesită un server](/docs/guide-server-memory/), [alegerea unui încărcător](/docs/guide-choosing-a-loader/), [crearea și gestionarea serverelor](/docs/servers/).
