---
title: 'Pianificazioni'
description: 'La pagina Pianificazioni automatizza le attività ricorrenti con espressioni cron. Nessun cron esterno, nessun script.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Torna all'indice della documentazione](/docs/)

La pagina **Pianificazioni** automatizza le attività ricorrenti con espressioni cron. Nessun cron esterno, nessun script.

![Pianificazioni](/docs/images/schedules.png)

## Cosa puoi pianificare

- **Riavvii**: un riavvio notturno per mantenere in salute un server in esecuzione da molto tempo.
- **Arresti e avvii**: spegnere un server durante la notte e riavviarlo al mattino.
- **Backup**: snapshot regolari (contrassegnati come `scheduled` nella pagina [Backup](/docs/backups/)). Una pianificazione di backup può anche ridurre le dimensioni del mondo dopo ogni backup ([ridimensionare un mondo](/docs/world-shrink/)). Ogni nuovo server ottiene automaticamente una pianificazione di backup giornaliera.
- **Comandi**: eseguire qualsiasi comando del server secondo una pianificazione.
- **Controlli di aggiornamento**: aggiornare periodicamente ciò che è obsoleto. Il controllo pianificato è anche ciò che applica gli aggiornamenti per i server impostati su [Aggiornamento automatico](/docs/modpacks/#update-policy).

Ogni pianificazione è destinata a un server specifico (o al pannello globalmente), viene eseguita sulla propria espressione cron e può essere abilitata o disabilitata senza eliminarla. L'editor visualizza in anteprima gli orari di esecuzione successivi mentre digiti, gli orari cron seguono il fuso orario del pannello (impostato in **Impostazioni**) e la tabella mostra la prossima esecuzione di ciascuna pianificazione. Ogni esecuzione viene registrata come evento nella cronologia, così come un'esecuzione fallita.

Il pannello imposta anche le proprie pianificazioni di manutenzione al primo avvio, che puoi riprogrammare o disattivare: un controllo di aggiornamento giornaliero, una nuova scansione dello storage ogni sei ore, una pulizia giornaliera dei vecchi file temporanei, una verifica della scadenza dei ban ogni 15 minuti (rimuovendo i ban temporanei scaduti) e un riempimento notturno dei metadati dei contenuti (riempiendo nomi e icone delle mod mancanti).

## Quando il server è occupato

Un backup o un avvio pianificato che trova il proprio server nel bel mezzo di un'altra azione (un ripristino, una pulizia dei backup, una modifica della porta) attende e riprova ogni minuto finché quell'azione non è terminata, per un massimo di 30 minuti. Un avvio in attesa viene annullato se qualcuno avvia o arresta il server nel frattempo. Un riavvio o arresto pianificato non viene ritentato: viene saltato e rieseguito al suo orario successivo.
