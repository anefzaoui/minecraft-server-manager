---
title: 'Blueprint'
description: "Un blueprint cattura l'intera configurazione di un server (tipo, versione, risorse, ambiente, pin del pacchetto e, opzionalmente, la sua configurazione e il suo mondo) in un unico file."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Indice della documentazione](/docs/)

Un **blueprint** cattura l'intera configurazione di un server (tipo, versione, risorse, ambiente, pack pin e opzionalmente la sua configurazione e il suo mondo) in un unico file portatile da cui puoi creare nuovi server.

![Blueprints](/docs/images/blueprints.png)

## Esportazione

Da un server, esporta un blueprint e scegli cosa includere: la configurazione sempre, e opzionalmente file incorporati e il mondo. Il risultato viene salvato nella tua libreria di blueprint e può essere scaricato per la condivisione.

## Importazione e creazione da un blueprint

Importa un file blueprint (o scegline uno dalla libreria) per creare un nuovo server preconfigurato esattamente come l'originale. È il modo più veloce per:

- Creare server identici (una rete di server per minigiochi, copie di staging della produzione).
- Spostare un server tra pannelli.
- Mantenere un modello noto e funzionante a cui puoi sempre tornare.

Poiché un blueprint registra l'esatto [pack pin](/docs/modpacks/), un server modpack ricreato da un blueprint installa la stessa versione bloccata, senza aggiornamenti imprevisti.
