---
title: 'Spostare un server Minecraft su un altro host'
description: 'Spostare un mondo è facile. Spostare un server a cui i giocatori possono ancora accedere, con i loro inventari, case e permessi intatti, è la parte che va storta.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Indietro all'indice della documentazione](/docs/)

Spostare un mondo è facile. Spostare un server a cui i giocatori possono ancora accedere, con i loro inventari, case e permessi intatti, è la parte che va storta. L'ordine seguente riduce il tempo di inattività a pochi minuti e mantiene una via di fuga se la nuova macchina delude.

## Fai prima il punto della situazione

Scrivi queste cose prima di toccare qualsiasi cosa. Ognuna di esse ha causato il fallimento di una migrazione quando è stata data per scontata anziché verificata:

- **Versione e loader di Minecraft**, esattamente. 1.20.1 NeoForge non è 1.20.1 Forge.
- **L'elenco di mod o plugin con le versioni.** Il mondo non si caricherà senza le mod che lo hanno creato.
- **Versione di Java**, che segue la versione di Minecraft.
- **`level-name`** da `server.properties`. La cartella del mondo spesso non si chiama `world`.
- **Modalità online.** Se il vecchio server è stato eseguito con `online-mode=false` e il nuovo viene eseguito con esso attivo, o viceversa, ogni giocatore ottiene un UUID diverso e quindi un inventario completamente nuovo e vuoto. Questo è l'errore più doloroso di questa pagina.
- **Qualsiasi cosa che risieda al di fuori della cartella del server**, come un database MySQL di un plugin.

## Copia mentre è in esecuzione, poi copia di nuovo mentre è fermo

Il trucco per un breve tempo di inattività è fare prima la copia lenta.

1. **Con il server in esecuzione**, copia l'intera directory del server sulla nuova macchina. Su un mondo di grandi dimensioni questo potrebbe richiedere un'ora; nessuno se ne accorge, perché nulla si è fermato.
2. **Annuncia un riavvio, quindi arresta correttamente il server.** Un arresto grazioso fa sì che il gioco salvi il mondo; uccidere il processo no.
3. **Copia di nuovo.** Questa volta vengono spostati solo i file modificati, quindi ci vogliono secondi o minuti.
4. **Avvialo sulla nuova macchina**, su una porta non pubblica se possibile, e connettiti tu stesso. Controlla una base che conosci, il tuo inventario e che i plugin o le mod si siano caricati senza errori.
5. **Poi** indirizza i giocatori verso di esso.

`rsync -a --delete` è lo strumento usuale per i passaggi 1 e 3. Mantieni permessi e timestamp: un mondo copiato come utente errato è un server che non si avvierà, e l'errore non lo dirà chiaramente.

## Non eliminare ancora il vecchio

Tieni la vecchia macchina, ferma ma intatta, per almeno qualche giorno. È l'unico vero rollback. Tienila spenta piuttosto che in esecuzione, in modo che nessuno si connetta accidentalmente alla copia abbandonata e costruisca lì per una settimana.

## Fai sopravvivere l'indirizzo allo spostamento

Se i giocatori si connettono a un indirizzo IP nudo, ogni spostamento costringe ogni giocatore a modificare la propria lista server, e alcuni di loro non lo fanno mai.

Usa un nome host che controlli, puntato al server. Lo spostamento diventa quindi una modifica DNS, e l'indirizzo nel client di tutti rimane lo stesso. Abbassa il TTL (time-to-live) del record un giorno prima dello spostamento in modo che la modifica si propaghi rapidamente.

Se vuoi che i giocatori digitino un dominio nudo mentre il server è in esecuzione su una porta non standard, un record SRV fa proprio questo. È lo stesso meccanismo che gli host commerciali usano per distribuire `play.something.net`.

## Controlla la nuova macchina prima di fidarti

Tre cose che differiscono tra gli host e che mordono dopo lo spostamento:

- **Il firewall.** La tua porta di gioco deve essere aperta, e solo la tua porta di gioco. Non esporre un pannello di gestione o una mappa a Internet solo perché funzionava in localhost.
- **Velocità single-core.** Minecraft si preoccupa molto di più della velocità di un singolo core che del numero di core. Otto core lenti sembreranno peggio di due veloci.
- **Disco.** Un mondo su disco rotante o su un volume pesantemente condiviso balbetterà durante il caricamento dei chunk.

## Lasciare un pannello gestito

Se provieni da un host che ti ha fornito un pannello di controllo anziché una macchina, trova il download o il file manager e prendi l'intera directory del server anziché solo il mondo. Ottieni i file jar dei plugin e delle mod stessi, non un elenco: le versioni contano, e "latest" è un file diverso il mese prossimo.

Controlla anche che i tuoi backup siano tuoi. Un backup che esiste solo all'interno del pannello che stai lasciando non è un backup che possiedi.

## In Minecraft Server Manager

L'intero pannello è una directory. Copiarlo su un'altra macchina e avviare il pannello lì porta con sé ogni server, mondo, backup e impostazione, il che rende lo spostamento del pannello stesso una copia anziché una migrazione.

Per un singolo server anziché per tutti, un blueprint ne cattura la configurazione, il set di mod e la versione del pacchetto bloccato (e, se lo spunti, il mondo attivo) come un singolo file `.mcserver.zip` che può essere importato su un altro pannello per ricostruire lo stesso server. I mondi possono essere scaricati e installati separatamente quando solo il mondo deve viaggiare.

Se la porta di gioco utilizzata da un server è già occupata sulla nuova macchina, o vuoi testare prima su una porta non pubblica, cambiala in **Impostazioni → Configurazione**: la scheda **Porta di gioco** ha **Usa la prossima porta libera**, un server in esecuzione chiede prima di riavviarsi sulla nuova porta e, se non riesce ad avviarsi lì, torna alla vecchia. Passa alla porta pubblica quando indirizzi i giocatori verso di essa.

Correlati: [blueprint](/docs/blueprints/), [backup che ripristinano davvero](/docs/guide-backups/), [mondi e file](/docs/worlds-and-files/).
