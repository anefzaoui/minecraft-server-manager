---
title: 'Micșorarea unei lumi'
description: 'Micșorați o lume Minecraft prin ștergerea fragmentelor rar vizitate, pentru a recupera spațiu pe disc și a accelera backup-urile.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Înapoi la indexul documentelor](/docs/)

În timp, o lume se extinde: fiecare loc pe unde a mers vreodată un jucător, a zburat sau a fost purtat de o perlă Ender lasă fragmente generate pe disc, chiar dacă nimeni nu s-a mai întors vreodată. **Micșorarea lumii** elimină fragmentele în care aproape nimeni nu a petrecut timp, astfel încât lumea să ocupe mai puțin spațiu. Minecraft reconstruiește o zonă eliminată din sămânța lumii în momentul în care cineva călătorește din nou acolo, deci acest lucru este sigur pentru terenul pe care nimeni nu îl folosește, dar orice ar fi construit un jucător într-un loc în care abia a stat ar dispărea și el, motiv pentru care ar trebui să faceți o copie de rezervă mai întâi (copia de rezervă este anularea).

## Ce se consideră „vizitat rar”

Fiecare fragment înregistrează cât timp au petrecut jucătorii stând în el (Minecraft numește acest lucru `InhabitedTime`). Micșorarea lumii elimină orice fragment sub **30 de secunde** de timp total al jucătorului în mod implicit; dialogul de micșorare vă permite să schimbați acel prag (de la 1 secundă la 1 oră) și câte fragmente din jurul punctului de spawn să păstrați (implicit 8, `0` dezactivează protecția punctului de spawn).

Ce se păstrează, întotdeauna:

- Zona din jurul **punctului de spawn** al lumii (citit din `level.dat`) în suprafața principală (overworld). Nether, End și dimensiunile personalizate nu au zonă de spawn.
- Orice fragment al cărui timp de vizitare nu a putut fi citit, de exemplu o lume salvată cu un format de compresie pe care panoul nu îl decodează (LZ4). Previzualizarea și rezultatul vă spun câte astfel de fragmente au fost omise.

Fiecare dimensiune a lumii este acoperită: folderele surori în stil Bukkit (`world_nether`, `world_the_end`), precum și aspectul vanilla și Forge/Fabric (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Când un fragment este eliminat, entitățile și punctele de interes ale sătenilor dispar odată cu el, astfel încât un fragment regenerat nu moștenește mobi vechi, vagoane de mină sau locuri de muncă.

## Realizarea acestuia din fila Lumilor

1. Faceți o copie de rezervă din fila **Copii de rezervă**. Micșorarea din fila Lumilor nu face una pentru dvs.
2. Deschideți **Lume → Lumile**, găsiți lumea și faceți clic pe pictograma de micșorare.
3. Faceți clic pe **Previzualizare** pentru a vedea aproximativ câte fragmente (și câte megabiți) ar fi eliminate. Nimic nu este schimbat încă; o previzualizare funcționează în timp ce serverul rulează.
4. Faceți clic pe **Micșorare Lume**. Micșorarea editează fișierele lumii direct, deci serverul trebuie oprit: fie opriți-l mai întâi, fie bifați opțiunea de a-l opri, micșora și porni din nou dintr-o singură mișcare (serverul este repornit chiar dacă micșorarea eșuează). Progresul este afișat în bara de sarcini.

![Micșorare lume](/docs/images/world-shrink.png)

## Realizarea acestuia ca parte a unei copii de rezervă

În fila **Copii de rezervă**, bifați **„De asemenea, micșorați lumea după aceea”** înainte de **Copiere de rezervă acum**. Arhiva de rezervă este scrisă mai întâi (această arhivă este anularea dvs.), apoi lumea este micșorată, dar numai dacă serverul este oprit. Dacă serverul rulează, copia de rezervă rulează în continuare și micșorarea este omisă cu o notă.

Copii de rezervă programate au aceeași opțiune: în editorul de programare, alegeți sarcina **Copiere de rezervă** și bifați **„Micșorați lumea după fiecare copie de rezervă”**. Asociați-o cu o programare **Oprire server** cu câteva minute mai devreme dacă doriți ca aceasta să ruleze neasistată.
