---
title: 'Mutarea unui server Minecraft pe altă gazdă'
description: 'Mutarea unei lumi este ușoară. Mutarea unui server la care jucătorii se pot conecta în continuare, cu inventarele, casele și permisiunile lor intacte, este partea care merge prost.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Înapoi la indexul documentației](/docs/)

Mutarea unei lumi este ușoară. Mutarea unui server la care jucătorii se pot conecta în continuare, cu inventarele, casele și permisiunile lor intacte, este partea care merge prost. Ordinea de mai jos menține timpul de nefuncționare la câteva minute și păstrează o cale de întoarcere dacă noua mașină dezamăgește.

## Inventariază mai întâi

Notează aceste lucruri înainte de a atinge ceva. Fiecare dintre ele a dus la un eșec al migrării atunci când s-a presupus în loc să se verifice:

- **Versiunea și loader-ul Minecraft**, exact. 1.20.1 NeoForge nu este 1.20.1 Forge.
- **Lista de moduri sau plugin-uri cu versiunile lor.** Lumea nu se va încărca fără modurile care au creat-o.
- **Versiunea Java**, care urmează versiunea Minecraft.
- **`level-name`** din `server.properties`. Directorul lumii nu este adesea numit `world`.
- **Modul online.** Dacă serverul vechi a rulat cu `online-mode=false` și cel nou rulează cu el activat, sau invers, fiecare jucător primește un UUID diferit și, prin urmare, un inventar nou-nouț, gol. Aceasta este cea mai dureroasă greșeală de pe această pagină.
- **Orice rulează în afara directorului serverului**, cum ar fi o bază de date MySQL a unui plugin.

## Copiază cât rulează, apoi copiază din nou cât este oprit

Trucul pentru un timp de nefuncționare scurt este să faci mai întâi copierea lentă.

1. **Cu serverul pornit**, copiază întregul director al serverului pe noua mașină. Pe o lume mare, acest lucru poate dura o oră; nimeni nu observă, deoarece nimic nu s-a oprit.
2. **Anunță o repornire, apoi oprește serverul corespunzător.** O oprire grațioasă face ca jocul să salveze lumea; uciderea procesului nu.
3. **Copiază din nou.** De data aceasta se mută doar fișierele care s-au modificat, deci durează secunde până la minute.
4. **Pornește-l pe noua mașină**, pe un port nepublic dacă poți, și conectează-te tu însuți. Verifică o bază pe care o cunoști, propriul inventar și că plugin-urile sau modurile s-au încărcat fără erori.
5. **Apoi** direcționează jucătorii către el.

`rsync -a --delete` este unealta obișnuită pentru pașii 1 și 3. Păstrează permisiunile și marcajele temporale: o lume copiată de către utilizatorul greșit este un server care nu va porni, iar eroarea nu va spune acest lucru clar.

## Nu șterge încă pe cel vechi

Păstrează mașina veche, oprită, dar intactă, pentru cel puțin câteva zile. Este singura revenire reală. Păstreaz-o oprită mai degrabă decât pornită, astfel încât nimeni să nu se conecteze accidental la copia abandonată și să construiască acolo timp de o săptămână.

## Fă ca adresa să supraviețuiască mutării

Dacă jucătorii se conectează la o adresă IP brută, fiecare mutare forțează fiecare jucător să-și editeze lista de servere, iar unii dintre ei nu o fac niciodată.

Folosește un nume de gazdă pe care îl controlezi, direcționat către server. Mutarea devine apoi o schimbare DNS, iar adresa din clientul tuturor rămâne aceeași. Scade timpul de viață al înregistrării (TTL) cu o zi înainte de mutare, astfel încât schimbarea să se propage rapid.

Dacă dorești ca jucătorii să tasteze un domeniu brut în timp ce serverul rulează pe un port non-standard, o înregistrare SRV face acest lucru. Este același mecanism pe care îl folosesc gazdele comerciale pentru a oferi `play.something.net`.

## Verifică noua mașină înainte de a te încrede în ea

Trei lucruri care diferă între gazde și care te pot afecta după mutare:

- **Firewall-ul.** Portul jocului tău trebuie să fie deschis, și doar portul jocului tău. Nu expune un panou de administrare sau o hartă la internet doar pentru că a funcționat pe localhost.
- **Viteza unui singur nucleu.** Minecraft acordă mult mai multă importanță vitezei unui nucleu decât numărului lor. Opt nuclee lente vor fi mai rele decât două rapide.
- **Disc.** O lume pe stocare rotativă sau pe un volum puternic partajat va avea întârzieri în timpul încărcării fragmentelor.

## Părăsirea unui panou gestionat

Dacă vii de la o gazdă care ți-a oferit un panou de control în loc de o mașină, găsește managerul de descărcare sau de fișiere și ia întregul director al serverului, nu doar lumea. Obține fișierele jar ale plugin-urilor și modurilor în sine, nu o listă: versiunile contează, iar "latest" este un fișier diferit luna viitoare.

Verifică dacă backup-urile tale sunt și ele ale tale. Un backup care există doar în interiorul panoului pe care îl părăsești nu este un backup pe care îl deții.

## În Minecraft Server Manager

Întregul panou este un singur director. Copierea lui pe o altă mașină și pornirea panoului acolo aduce cu sine fiecare server, lume, backup și setare, ceea ce face ca mutarea panoului în sine să fie o copiere, mai degrabă decât o migrare.

Pentru un singur server, mai degrabă decât pentru toate, un blueprint surprinde configurația sa, setul de moduri și versiunea pachetului fixat (și, dacă îl bifezi, lumea activă) ca un singur fișier `.mcserver.zip` care poate fi importat pe un alt panou pentru a reconstrui același server. Lumile pot fi descărcate și instalate separat atunci când doar lumea trebuie să călătorească.

Dacă portul de joc pe care l-a folosit un server este deja ocupat pe noua mașină, sau dorești să testezi mai întâi pe un port nepublic, schimbă-l în **Settings → Configuration**: cardul **Game Port** are **Use Next Free Port**, un server care rulează cere înainte de a reporni pe noul port, iar dacă nu poate porni acolo, revine la cel vechi. Comută-l la portul public atunci când direcționezi jucătorii către el.

Înrudite: [blueprints](/docs/blueprints/), [backups that actually restore](/docs/guide-backups/), [worlds and files](/docs/worlds-and-files/).
