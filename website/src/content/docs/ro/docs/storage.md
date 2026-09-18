---
title: 'Stocare'
description: 'Pagina Stocare arată unde se duce spațiul dvs. pe disc: utilizarea per server și cum evoluează în timp.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Stocare** arată unde se duce spațiul pe disc: utilizarea per server și cum evoluează în timp.

![Stocare](/docs/images/storage.png)

## Cotele de disc sunt impuse de panou

Docker nu poate limita utilizarea discului unui bind mount, așa că panoul o face. Un indexator de dimensiune în fundal parcurge directorul de date, salvează în cache amprenta fiecărui server și impune cota de disc pe care o setați per server. Când datele unui server (lume + backup-uri + tot restul) se apropie de cota sa, panoul oprește creșterea necontrolată în loc să permită unui singur server să vă umple gazda.

Setați cota unui server în [setările](/docs/servers/) acestuia. Serverele modificate și [backup-urile](/docs/backups/) acestora pot fi mari, așa că acordați-le spațiu.

## Curățare

Vizualizarea Stocare vă ajută să găsiți ce să eliminați (backup-uri vechi, lumi neutilizate sau un server care a crescut mult peste așteptări) înainte de a rămâne fără spațiu.
