---
title: 'Pachete de Moduri'
description: 'Instalează pachete de moduri CurseForge, Modrinth, FTB și GT New Horizons ca servere, mereu fixate la o versiune exactă a pachetului.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Pachete de Moduri** (și fila **Din Pachet de Moduri** din [expertul de creare](/docs/servers/)) instalează un pachet de moduri ca server, **fixat întotdeauna la o versiune exactă a pachetului**, astfel încât o repornire nu poate actualiza niciodată silențios pachetul din spate.

![Pachete de Moduri](/docs/images/modpacks.png)

## Platforme suportate

- **CurseForge**: caută după nume. Necesită o cheie API CurseForge (adăugați-o la **Setări → Chei API**).
- **Modrinth**: caută după nume.
- **FTB**: Pachete Feed The Beast, doar prin API (un ID numeric al pachetului plus un ID explicit al versiunii). Panoul nu verifică încă actualizările pachetelor FTB.
- **GT New Horizons**: pachetul expert 1.7.10, instalat din propriul index de lansare al GTNH. GTNH alege runtime-ul său Java per versiune de pachet (2.8.0+ rulează pe **Java 25** prin patch-uri lwjgl3ify incluse, versiunile mai vechi pe Java 21 sau 17), iar expertul mărește RAM-ul și discul serverului la minime rezonabile pentru acesta.
- **Zip personalizat**: deloc un pachet publicat. Încărcați o **exportare de pachet de moduri CurseForge** (zip-ul cu `manifest.json` pe care aplicația CurseForge îl produce pentru un set de moduri ales manual), un **`.mrpack` Modrinth**, sau **orice zip de fișiere jar de moduri**. Panoul rezolvă manifestul în masă (sau identifică fiecare fișier jar după hash/amprentă/metadate), previzualizează ce se potrivește și instalează totul într-o singură sarcină, inclusiv configurațiile `overrides/` ale pachetului dacă optați pentru aceasta. Modurile ale căror autori interzic descărcările automate sunt listate cu un link către browser și un slot de încărcare manuală în loc să eșueze instalarea.

## Cum funcționează fixarea

Când alegeți un pachet, panoul rezolvă versiunea exactă, o înregistrează și o instalează. Pe pagina **Actualizări** veți fi informat când o versiune mai nouă este disponibilă (cu excepția cazului în care [politica de actualizare](#update-policy) a serverului este **Doar Manual**,), actualizarea este o acțiune deliberată, protejată, cu o copie de rezervă pre-actualizare și rollback. Serverele care urmăresc versiunea stabilă nu primesc niciodată o versiune beta. Propria filă **Versiuni** a unui server răspunde la cealaltă jumătate a întrebării: ce versiuni viitoare de Minecraft pot urma modurile pe care le are efectiv ([actualizări](/docs/updates/#minecraft-version-compatibility)).

Versiunea încărcătorului de moduri vine și ea cu pachetul: serverul instalează versiunea Forge, NeoForge sau Fabric pe care o declară pachetul. Dacă un pachet CurseForge Forge sau Fabric declară una prea veche pentru propriile moduri, fila **Versiuni** o poate suprascrie până când pachetul este remediat; o actualizare a pachetului elimină suprascrierea, deoarece noua versiune își declară propria versiune ([modificarea versiunii încărcătorului de moduri](/docs/updates/#changing-the-mod-loader-version)).

Serverele create pe versiuni foarte vechi ale panoului (înainte de 0.9.7) puteau rămâne _nefixate_, ceea ce înseamnă că imaginea containerului instala silențios cea mai recentă versiune a pachetului la fiecare pornire. Panoul le repară acum la pornire: le fixează pe fiecare la versiunea care este efectiv instalată (citită din propriile înregistrări ale panoului sau din manifestul de instalare al imaginii, niciodată un "latest" proaspăt rezolvat) și înregistrează un eveniment. Dacă nu poate determina ce este instalat, pagina Setări a serverului afișează un avertisment cu un buton **Alege o Versiune…** (pachete CurseForge, Modrinth și GTNH) care deschide [expertul de versiuni](#changing-the-pack-version), iar orice încercare de a salva o configurație de pachet de moduri nefixată este respinsă categoric.

## Politica de actualizare

Fiecare server are un card **Politica de Actualizare** pe fila sa **Setări → Configurație**, iar toate cele trei opțiuni înseamnă ceea ce spun:

- **Doar Manual** (implicit): nimic nu se schimbă de la sine, iar serverul este lăsat complet în afara insignei de actualizare și a paginii Actualizări. Modul "lasă-mă în pace": ideal pentru un pachet personalizat manual sau importat pe care nu doriți niciodată să fie atins. Nu fixează versiunea: [**Schimbă Versiunea…**](#changing-the-pack-version) funcționează sub orice politică. Pentru a fi informat despre versiunile noi și a le aplica cu un singur clic, alegeți **Notifică-mă**.
- **Notifică-mă**: verificarea zilnică afișează actualizările disponibile ca o insignă și pe pagina Actualizări; aplicarea lor este întotdeauna la clic.
- **Actualizare Automată**: după verificarea zilnică programată, actualizările **pachetului** în așteptare sunt aplicate prin același traseu protejat ca o actualizare manuală: copie de rezervă pre-actualizare, monitorizare a stării de sănătate și un rollback automat dacă noua versiune nu reușește să pornească. Actualizările care ar muta serverul la o versiune diferită de Minecraft sunt întotdeauna omise cu un eveniment în schimb: conversia unei lumi permanent este o decizie pe care panoul refuză să o ia pentru dvs. Butoanele manuale **Verifică Acum** doar verifică; ele nu declanșează niciodată actualizări automate.

## Actualizarea unui pachet

De pe un server fixat, puteți actualiza la o versiune mai nouă într-o singură acțiune. Panoul face mai întâi o copie de rezervă, schimbă versiunea fixată, reconstruiește serverul (rezolvă din nou Java dacă noua versiune necesită un runtime diferit) și monitorizează prima pornire, cu o fereastră generoasă pentru pachete mari precum GTNH care descarcă câțiva gigaocteți și construiesc o lume cu câteva sute de moduri la prima pornire.

## Modificarea versiunii pachetului

Pentru a rula o versiune specifică, mai nouă sau mai veche, utilizați **Schimbă Versiunea…** pe cardul pachetului din fila **Prezentare Generală** a serverului. Pe pagina **Pachete de Moduri**, deschiderea cardului unui pachet instalat oferă aceeași alegere: alegeți o versiune din meniul derulant și faceți clic pe **Comută la Această Versiune**. Ambele necesită permisiunea **Conținut** a serverului și ambele sunt disponibile pentru pachetele CurseForge, Modrinth și GTNH (pachetele FTB nu au încă o listă de versiuni). Lista afișează cele mai recente 25 de versiuni pentru CurseForge și Modrinth, și fiecare lansare GTNH.

Comutarea trece prin același traseu protejat ca o actualizare: o copie de rezervă pre-actualizare, noua fixare, o reconstrucție și o primă pornire monitorizată, cu un rollback cu un singur clic dacă serverul nu pornește corect. Modurile dvs. personalizate sunt păstrate, la fel și modurile pachetului pe care le-ați dezactivat, împreună cu celelalte setări de instalare ale pachetului (moduri forțate, fișiere de ignorat, proiecte suplimentare). Instalarea unui pachet diferit pornește acele setări de la zero, deoarece acestea au sens doar pentru pachetul pentru care au fost create.

Fiecare versiune este listată cu versiunea Minecraft pe care o rulează, comparată cu versiunea cu care lumea dvs. a fost salvată ultima dată:

- **Aceeași versiune Minecraft**: comutați după o confirmare normală. Revenirea la o versiune mai veche a pachetului poate elimina blocuri și elemente din modurile pe care acea versiune nu le are, deci copia de rezervă rămâne în fila Copii de Rezervă oricum.
- **Versiune Minecraft mai nouă**: permisă după o confirmare care avertizează că lumea este convertită definitiv. Copia de rezervă luată mai întâi este singura cale de întoarcere la lumea veche.
- **Versiune Minecraft mai veche**: indisponibilă. Minecraft nu poate încărca o lume pe o versiune mai veche decât cea care a salvat-o ultima dată, deci panoul refuză în loc să lase un server care se blochează la pornire.
