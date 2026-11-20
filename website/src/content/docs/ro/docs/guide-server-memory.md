---
title: 'Cât RAM necesită un server Minecraft?'
description: 'Cât RAM necesită un server Minecraft pentru vanilla, Paper, moduri ușoare și modpack-uri mari, și cât să rămână pentru mașină.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Înapoi la indexul documentației](/docs/)

Răspuns scurt, pentru un server pe care se va juca efectiv:

| Ceea ce rulezi                                        | Heap Java       | Alocă mașinii |
| ----------------------------------------------------- | --------------- | ------------- |
| Vanilla sau Paper, până la 10 jucători                | 2 GB            | 4 GB          |
| Paper cu pluginuri, 10 până la 30 jucători            | 4 GB            | 6 GB          |
| Un pachet de moduri ușor, 40 până la 80 moduri        | 4 GB            | 6 GB          |
| Un pachet mare "kitchen-sink", 150 până la 300 moduri | 6 până la 8 GB  | 10 GB         |
| GregTech New Horizons și monștri similari             | 8 până la 12 GB | 16 GB         |

Două numere, nu unul. Aceasta este partea pe care majoritatea ghidurilor o omit și motivul pentru care oamenii cumpără un server de 4 GB, alocă 4 GB pentru Java și apoi îl privesc cum moare.

## Heap-ul și mașina sunt numere diferite

Heap-ul Java (`-Xmx`) este câtă memorie poate folosi jocul în sine pentru lume, entități și datele modurilor. Mașina, sau containerul, trebuie să găzduiască acest heap **plus** tot ce altceva are nevoie Java: metadate de clasă, stive de thread-uri, contabilitatea garbage collector-ului, buffere de rețea și JVM-ul însuși. Acest overhead este de aproximativ 0,5 până la 1,5 GB pentru un server cu moduri.

Dacă heap-ul este egal cu memoria mașinii, kernel-ul va ucide serverul în momentul în care Java ajunge la acest overhead. În Docker, acest lucru apare ca un cod de ieșire 137, iar în loguri nu apare nimic: procesul dispare pur și simplu la jumătatea propoziției. Oamenii dau vina de obicei pe un mod.

O regulă sigură: **heap plus 25 la sută, și cel puțin un gigabyte liber.** Un heap de 8 GB necesită o mașină de 10 GB.

## Mai mult RAM nu înseamnă performanță mai bună

Minecraft este limitat de un singur fir de execuție în majoritatea operațiunilor sale. Alocarea a 16 GB pentru un pachet cu 40 de moduri nu face ca chunk-urile să se genereze mai repede; face ca fiecare pauză de garbage collection să dureze mai mult, deoarece sunt mai multe de parcurs. Un server care bâlbâie la fiecare treizeci de secunde este adesea un server cu prea mult heap, nu prea puțin.

Mărește heap-ul când vezi acestea, și nu altfel:

- `java.lang.OutOfMemoryError: Java heap space` în log.
- Mesaje repetate "Can't keep up! Is the server overloaded?" cu pauze de garbage collection în timpi.
- Utilizarea memoriei care urcă la maxim și rămâne blocată acolo ore în șir.

## De ce serverul tău arată 12 GB utilizați în timp ce nimeni nu este online

Pentru că așa l-ai configurat. Două setări implicite intră în conflict:

1. Imaginea Docker comună setează heap-ul de pornire egal cu cel maxim, deci `-Xms` și `-Xmx` sunt ambele numărul tău. Java îl revendică imediat, în loc să crească treptat.
2. Setul popular de flag-uri Aikar include `-XX:+AlwaysPreTouch`, care parcurge fiecare pagină a acelui heap la pornire, astfel încât paginile să fie cu adevărat alocate. Este deliberat: schimbă o pornire mai lentă și o cifră mare la inactivitate pentru mai puține pauze mai târziu.

Măsurat pe Paper 1.21.1 cu un heap de 2 GB într-un container de 4 GB, eșantionat timp de trei minute după ce lumea s-a încărcat complet:

| Configurație                                   | Memorie rezidentă |
| ---------------------------------------------- | ----------------- |
| Fără flag-uri                                  | 2.60 GiB          |
| Flag-uri Aikar                                 | 2.59 GiB          |
| Flag-uri Aikar fără `AlwaysPreTouch`           | 1.95 GiB          |
| Flag-uri Aikar cu un heap de pornire de 512 MB | 1.38 GiB          |
| Fără flag-uri cu un heap de pornire de 512 MB  | 1.25 GiB          |

Deci, un server care "folosește" 12 GB la inactivitate este de obicei un heap de 12 GB care a fost pre-atins, nu o scurgere de memorie. Monitorizarea ta îl citește corect; numărul pur și simplu nu înseamnă ceea ce pare.

Dacă dorești o cifră de inactivitate onestă, setează heap-ul de pornire mai jos decât cel maxim. Plătești pentru asta cu câteva colecții mai multe la început. Dacă preferi timpi de cadre plați, lasă-l în pace și nu te mai uita la grafic.

## Jucătorii contează mai puțin decât crezi

Dublarea de la 10 la 20 de jucători costă mult mai puțin decât adăugarea a cincizeci de moduri. Jucătorii adaugă în principal entități și chunk-uri încărcate, care scalează ușor. Modurile adaugă date de clasă, registre, caracteristici de generare a lumii și propriile lor cache-uri, care nu scalează. Dimensionează mai întâi pentru pachet, apoi adaugă aproximativ 100 până la 200 MB per jucător obișnuit pe un server cu moduri.

Distanța de vizualizare este celălalt levier important. Reducerea de la 12 la 8 chunk-uri poate economisi un gigabyte pe un server aglomerat și este abia perceptibilă în joc.

## În Minecraft Server Manager

Fiecare server are două câmpuri separate, **Heap Java** și **Limita memoriei containerului**, exact pentru că sunt întrebări diferite. Expertul de creare setează limita containerului cu 50% peste heap pentru tine, iar panoul refuză să salveze un server a cuyos limită de container nu este peste heap-ul său, deoarece acea combinație se termină cu un cod de ieșire 137, mai degrabă decât cu un mesaj de eroare.

Contorul de memorie de pe un server arată ce folosește cu adevărat containerul, cu o notă atunci când heap-ul a fost revendicat în avans, astfel încât un heap pre-atins să nu fie interpretat ca fiind scăpat de sub control. Un server pe care kernel-ul l-a oprit din cauza memoriei este înregistrat exact așa în istoric, mai degrabă decât ca o defecțiune misterioasă.

Conexe: [crearea și gestionarea serverelor](/docs/servers/),
[rapoarte de eroare](/docs/servers/#crash-reports--mclogs-analysis), [stocare și cote](/docs/storage/).
