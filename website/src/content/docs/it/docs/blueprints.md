---
title: 'Blueprint'
description: "I Blueprint salvano l'intera configurazione di un server Minecraft come una ricetta riutilizzabile per creare nuovi server. I segreti non sono mai inclusi."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Indietro all'indice della documentazione](/docs/)

Un **blueprint** (modello) cattura l'intera configurazione di un server (tipo, versione, risorse, ambiente, pin del modpack, mod personalizzate e opzionalmente la sua configurazione e il suo mondo) in un singolo file portatile `.mcserver.zip` da cui puoi creare nuovi server. I segreti (password, token e chiavi nell'ambiente) non vengono mai scritti in un blueprint.

![Blueprints](/docs/images/blueprints.png)

## Esportazione

Dalla scheda **Impostazioni → Configurazione** di un server, usa **Esporta come Blueprint** e scegli cosa includere: sempre la configurazione del server, le sue directory di configurazione (attive per impostazione predefinita) e opzionalmente i file delle mod personalizzate stessi (un file più grande che si installa senza scaricare nulla) e il mondo attivo. Il risultato viene salvato nella tua libreria di blueprint e può essere scaricato per la condivisione.

**Clona Server**, sulla stessa scheda, esegue un'esportazione e un'importazione in un unico passaggio per creare una copia del server, con o senza il suo mondo.

## Importazione e creazione da un blueprint

Importa un file blueprint (**Importa Blueprint** nella pagina **Blueprint**) o scegline uno dalla libreria (**Crea un Server** sulla sua scheda, o la scheda **Da Blueprint** della procedura guidata) per creare un nuovo server preconfigurato esattamente come l'originale. Il nuovo server ottiene le proprie porte e una nuova password RCON. Le mod personalizzate che non sono state incorporate vengono scaricate nuovamente e verificate rispetto agli hash registrati dal blueprint. La libreria inizia anche con due blueprint di partenza, uno Paper e uno Fabric.

È il modo più veloce per:

- Avviare server identici (una rete di server di minigiochi, copie di staging della produzione).
- Spostare un server tra pannelli.
- Mantenere un modello noto e funzionante a cui puoi sempre tornare indietro.

Poiché un blueprint registra l'esatto [pin del modpack](/docs/modpacks/), un server modpack creato da un blueprint installa la stessa versione bloccata, senza aggiornamenti a sorpresa.
