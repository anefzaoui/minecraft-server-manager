---
title: 'Backup-uri pentru serverul Minecraft care funcționează cu adevărat'
description: 'Cum să creezi backup-uri pentru serverul Minecraft care funcționează cu adevărat: copii consistente, păstrate în altă parte și testate cel puțin o dată.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Înapoi la indexul documentației](/docs/)

Majoritatea serverelor au backup-uri. Mult mai puține au backup-uri funcționale, iar diferența este descoperită doar în cel mai rău moment. Trei lucruri le separă: copia este consistentă, se află în altă parte și cineva a restaurat-o cel puțin o dată.

## Copiați lumea în timp ce nu este scrisă

Un server în funcțiune scrie continuu fișiere de regiune. Copiați-le în timpul scrierii și veți obține un fișier care este pe jumătate vechi și pe jumătate nou, care fie nu se încarcă, fie se încarcă cu o gaură în pământ unde odinioară se afla baza cuiva. Nimic nu vă avertizează, deoarece copia a reușit.

Există două modalități corecte de a face o copie:

1. **Opriți serverul**, copiați, porniți-l din nou. Simplu, onest și nepopular din cauza timpului de inactivitate.
2. **Spuneți jocului să înceteze scrierea mai întâi.** Rulați `save-off`, apoi `save-all flush`, așteptați să se finalizeze, copiați, apoi `save-on`. Lumea este completă și liniștită pe durata copierii.

Nu săriți niciodată direct la copiere. Un instantaneu la nivel de sistem de fișiere sau volum este în regulă numai dacă este cu adevărat atomic, iar un `cp -r` în timp ce jucătorii plasează blocuri nu este.

## Faceți backup la mai mult decât lumea

Restaurarea doar a lumii vă oferă terenul și pierde serverul. De asemenea, aveți nevoie de:

- `server.properties` și orice altceva stabilește regulile.
- Fișierele jar ale modurilor sau pluginurilor, la versiunile exacte care rulau. O lume nu se va încărca fără modurile care i-au creat blocurile.
- Datele jucătorilor, inclusiv `whitelist.json`, `ops.json` și folderele de statistici și realizări.
- Versiunea pachetului, dacă provine dintr-un pachet. Scrierea ei contează.

Cel mai rapid test de verificare a oricărui backup: ați putea reconstrui acest server pe o mașină nouă doar din arhivă? Dacă răspunsul necesită o propoziție care începe cu „și apoi aș reinstala”, nu este un backup complet.

## O singură copie pe același disc nu este un backup

Un backup care se află pe mașina pe care o protejează acoperă exact o singură defecțiune: ați șters ceva.
Nu acoperă defectarea discului, suspendarea contului de către furnizor sau o greșeală care șterge întregul director.

Păstrați-l simplu, mai degrabă decât perfect:

- O copie locală, pentru cazul obișnuit, care este cineva care distruge sau o actualizare proastă.
- O copie în altă parte. O altă mașină, un depozit de obiecte sau un NAS de acasă care descarcă zilnic prin SSH.
- Suficient istoric pentru a supraviețui unei probleme pe care nu ați observat-o imediat. Corupția este adesea găsită zile mai târziu, iar dacă păstrați trei zile de backup-uri, ați suprascris deja cel bun.

Șapte copii zilnice plus patru săptămânale acoperă aproape fiecare incident real și costă foarte puțin spațiu.

## Testați o restaurare înainte de a avea nevoie de una

Alegeți un backup, restaurați-l pe un server de rezervă și conectați-vă. Acesta este întregul test, durează cincisprezece minute și prinde toate defecțiunile clasice: arhiva care lipsește folderul modurilor, o lume care necesită o versiune pe care nu o mai rulați, permisiuni care fac fișierele ilizibile, o încărcare trunchiată.

Faceți acest lucru o dată când configurați backup-urile și încă o dată după orice modificare majoră a serverului.

## Dimensiunea și cum să o mențineți rezonabilă

Lumile cresc deoarece jucătorii explorează. O lume în care cineva a zburat zece mii de blocuri în linie dreaptă transportă toate fragmentele de-a lungul acelei linii pentru totdeauna, iar majoritatea acestor fragmente nu vor mai fi vizitate niciodată.

Trei manete, în ordinea cât de mult oferă înapoi:

1. **Tăiați fragmentele nevizitate.** Instrumentele care elimină în funcție de timpul ultimei atingeri elimină de obicei o mare parte dintr-o lume bine parcursă, fără efect vizibil în joc.
2. **Comprimați corespunzător.** Fișierele de regiune se comprimă bine; arhivele lor nu beneficiază de nimic exotic.
3. **Nu păstrați fiecare copie orară timp de un an.** Retenția bate compresia.

## În Minecraft Server Manager

Backup-urile urmează calea `save-off`, flush, copy, `save-on`, iar o oprire sau repornire solicitată în timpul unui backup este refuzată până la finalizarea copierii, în loc să concureze cu ea. Arhiva acoperă întregul director al serverului, deci modurile, configurația și datele jucătorilor călătoresc împreună cu lumea.

Backup-urile pot rula pe un program, alături de reporniri și comenzi, iar fiecare server nou pornește cu un program de backup zilnic. Numărul de retenție numără fiecare tip separat, astfel încât cele zece copii programate care se acumulează de la sine nu pot elimina pe cea pe care ați făcut-o manual înainte de o modificare riscantă, iar limitele de vechime și dimensiune se aplică suplimentar. Administratorii modifică totul pe pagina Setări, sau per server în fila Backup-uri. Restaurarea necesită mai întâi un backup nou, deci o restaurare la un moment greșit este în sine reversibilă. O lume poate fi micșorată singură sau ca parte a unui backup, ceea ce este maneta care contează cel mai mult pentru dimensiune.

Întregul panou, inclusiv fiecare backup, se află sub un singur director. Copierea acelui director în altă parte este jumătatea off-machine a poveștii, și este în mod deliberat singurul lucru pe care trebuie să-l copiați.

Legate de: [backup-uri în panou](/docs/backups/), [programe](/docs/schedules/),
[micșorarea unei lumi](/docs/world-shrink/), [mutarea unui server pe alt gazdă](/docs/guide-moving-a-server/).
