---
title: 'Stocare'
description: 'Vedeți unde se duce spațiul pe disc, limitați fiecare folder de server cu o cotă de disc și curățați ceea ce nu mai aveți nevoie.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Stocare** arată unde se duce spațiul dvs. pe disc: utilizare pe categorii, fiecare server în raport cu cota sa, cele mai mari fișiere și cum evoluează utilizarea totală în scanările recente. Este destinată exclusiv administratorilor.

![Stocare](/docs/images/storage.png)

## Cotele de disc sunt impuse de panou

Docker nu poate limita utilizarea discului pentru o montare de tip bind mount, așa că panoul o face. Un indexator de dimensiune rulează în fundal prin folderul de date (la fiecare 15 minute, după modificări sau când apăsați **Re-scanare Acum**), salvează în cache amprenta fiecărui server și impune cota de disc pe care o setați per server. O acțiune care ar duce folderul unui server (lume, moduri, configurații, jurnale și tot ce mai conține) peste cota sa, cum ar fi instalarea unui mod sau a unei lumi sau încărcarea de fișiere, este blocată până când se eliberează spațiu sau se mărește cota, în loc să permită unui singur server să vă umple gazda.

Setați cota unui server în [setările](/docs/servers/#server-settings) acestuia. Activarea opțiunii **Oprește serverul când depășește cota** acolo oprește, de asemenea, un server în curs de rulare odată ce folderul său depășește cu peste 10% cota, și notează acest lucru în istoricul serverului. Serverele cu moduri pot fi mari, așa că acordați-le spațiu. [Backup-urile](/docs/backups/) sunt stocate separat și nu se iau în calcul la cota.

## Curățare

Cardul **Curățare cu un clic** eliberează spațiu pe care panoul îl poate recupera în siguranță: fișiere temporare mai vechi de o oră, fișiere de bibliotecă orfane și jurnale arhivate și rapoarte de crash mai vechi de 30 de zile. Fiecare dintre acestea arată cât spațiu eliberează și deschide o previzualizare înainte ca ceva să fie șters. Listele **Pe categorii** și **Cele mai mari fișiere** vă direcționează direct în managerul de fișiere, astfel încât să puteți găsi ce altceva să eliminați înainte de a rămâne fără spațiu.
