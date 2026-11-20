---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: quale scegliere?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge o Quilt: quale tipo di server Minecraft eseguire, in base a ciò che i tuoi giocatori installano.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Indietro all'indice della documentazione](/docs/)

Scegli in base a ciò che vuoi che i giocatori installino, non in base a ciò che sembra più veloce.

| Desideri                                           | Esegui questo       | I giocatori installano |
| -------------------------------------------------- | ------------------- | ---------------------- |
| Sopravvivenza con amici, niente di insolito        | Vanilla             | Nulla                  |
| Un server pubblico con ranghi, claim e moderazione | Paper               | Nulla                  |
| Un modpack specifico da CurseForge o Modrinth      | Qualsiasi cosa dica | Il pack                |
| Un modpack moderno che stai creando tu stesso      | Fabric o NeoForge   | Le stesse mod          |
| Un vecchio pack dell'era 1.7-1.12                  | Forge               | Le stesse mod          |

Questa è la decisione per la maggior parte delle persone. Il resto di questa pagina spiega il perché.

## Plugin e mod non sono la stessa cosa

Questa è la distinzione su cui si basa tutto il resto.

**Plugin** vengono eseguiti solo sul server. Paper, Spigot e Bukkit li caricano. I giocatori si connettono con un client normale
non modificato e non se ne accorgono mai. Qualsiasi cosa che riguardi fondamentalmente regole, permessi, economie,
claim, minigiochi o moderazione è un plugin, ed è per questo che quasi ogni server pubblico esegue Paper.

**Mod** cambiano il gioco stesso: nuovi blocchi, nuove dimensioni, nuove macchine. Il client deve caricare le
stesse mod del server, altrimenti non può capire cosa gli sta dicendo il server. Chiunque si connetta a un
server moddato installa prima il pack.

Un server non può essere significativamente entrambe le cose. Esistono progetti ibridi che aggiungono un'API per plugin a un mod loader,
e funzionano finché non smettono di funzionare, di solito nel momento peggiore. Se hai bisogno di entrambi, esegui un proxy con un
server moddato e un server di plugin dietro di esso piuttosto che un unico ibrido.

## Il lato plugin

**Paper** è la risposta predefinita. È un fork di Spigot con anni di lavoro sulle prestazioni e un
file di configurazione per quasi ogni comportamento che abbia mai infastidito un amministratore. I plugin Vanilla
dell'era Bukkit funzionano ancora per lo più.

**Purpur** è un fork di Paper con ancora più opzioni, incluse quelle di gameplay. Usalo se desideri
quelle specifiche impostazioni; altrimenti Paper.

**Vanilla** vale la pena eseguirlo quando l'obiettivo è il gioco non modificato. È più lento con molti giocatori
e non ha un sistema di permessi, quindi la moderazione è manuale.

Paper modifica alcuni comportamenti vanilla per impostazione predefinita per migliorare le prestazioni. Se un marchingegno di redstone
di un video non funziona sul tuo server, di solito è questo il motivo, ed è solitamente un'impostazione.

## Il lato mod

**Fabric** è leggero, si aggiorna a una nuova versione di Minecraft entro pochi giorni e include la maggior parte delle mod di prestazioni moderne. Quasi ogni mod Fabric richiede anche Fabric API, che è un download separato.
Se il tuo obiettivo è un server veloce con una manciata di mod per la qualità della vita, questo è quello giusto.

**NeoForge** è dove l'ecosistema Forge ora svolge il suo lavoro per le versioni attuali. Si è separato da
Forge durante la 1.20.1 e la maggior parte dei grandi pack costruiti per la 1.20.2 e versioni successive lo utilizzano. Se stai iniziando un
nuovo pack pesante oggi, questo è quello giusto.

**Forge** possiede ancora il passato. Qualsiasi cosa delle ere 1.7.10, 1.12.2 e 1.16.5, che è una grande quantità
dei pack amati, è Forge e lo sarà sempre. Tienilo per quelli.

**Quilt** è un fork di Fabric che esegue la maggior parte delle mod Fabric. Esiste per buone ragioni, ma se non hai
nessun motivo specifico per sceglierlo, scegli Fabric.

Le mod per un loader non funzionano su un altro. Una pagina di mod che dice Fabric significa Fabric.

## Se stai installando un pack, il pack decide

Non scegliere tu. Il pack elenca il suo loader e la sua esatta versione di Minecraft, ed entrambi devono corrispondere.
"Abbastanza vicino" non è una cosa qui: un pack per 1.20.1 non funziona su 1.20.4 e un pack NeoForge 1.20.1
non funziona su Forge 1.20.1.

Installa il pack tramite il suo ID o link piuttosto che selezionando manualmente le mod e blocca la versione. I pack
si aggiornano, e un aggiornamento che ti coglie di sorpresa a metà stagione è il modo in cui i mondi vengono corrotti.

## Quale versione di Java

Il requisito di Minecraft si muove con il gioco e l'esecuzione di quella sbagliata produce un `UnsupportedClassVersionError` poco utile
invece di un messaggio chiaro.

| Versione di Minecraft | Java |
| --------------------- | ---- |
| 1.16.5 e precedenti   | 8    |
| 1.17                  | 16   |
| 1.18 e 1.19           | 17   |
| 1.20 - 1.20.4         | 17   |
| 1.20.5 - 1.21.x       | 21   |
| 26.1 e successive     | 25   |

I vecchi pack necessitano davvero di Java 8; questo è uno dei pochi casi in cui la versione più recente è sbagliata.

## In Minecraft Server Manager

La procedura guidata di creazione chiede cosa vuoi eseguire e sceglie la versione di Java dalla tabella sopra, quindi la
discrepanza non si verifica mai per errore. Vanilla, Paper e Purpur si trovano nella scheda **Vanilla**; la scheda
**Da Mod** accetta Fabric, Forge, NeoForge o Quilt, con la versione di Minecraft e una build del loader (l'ultima, o una che blocchi). Installare un pack da CurseForge, Modrinth o GT New Horizons
lo blocca a una versione esatta. L'aggiornamento avviene solo quando lo applichi (o dopo il controllo giornaliero, se la policy di aggiornamento del server è **Aggiornamento Automatico**), esegue sempre un backup prima e può essere annullato.

Il browser delle mod sa quale loader esegue un server e filtra ciò che offre di conseguenza, quindi un file JAR di Fabric non può finire per errore in un server NeoForge.

Correlati: [creazione e gestione di server](/docs/servers/), [modpack](/docs/modpacks/),
[quanta RAM serve a un server](/docs/guide-server-memory/).
