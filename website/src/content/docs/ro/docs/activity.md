---
title: 'Jurnal de activități'
description: 'Pagina Activități este jurnalul complet de audit: o înregistrare cronologică, ce poate fi căutată, a tot ce s-a întâmplat în panou.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Activitate** este jurnalul complet de audit: o înregistrare cronologică, ce poate fi căutată, a tot ce s-a întâmplat în panou. Filtrează-l după server sau după tipul de eveniment, caută rezumatele și exportă ceea ce ai filtrat ca CSV sau JSON. Intrările care au capturat un jurnal (un crash, de exemplu) îl deschid la fața locului.

![Activitate](/docs/images/activity.png)

## Ce se înregistrează

- **Autentificare**: conectări (inclusiv dacă s-a folosit 2FA sau un cod de rezervă), blocări de cont, modificări de parolă și activarea, dezactivarea sau resetarea 2FA.
- **Ciclul de viață al serverului**: creări, porniri, opriri, reporniri, crash-uri, reporniri automate și evenimente de lipsă de memorie.
- **Alerte**: porniri blocate, eșecuri la oprire, programări eșuate, opriri din cauza cotelor, containere nesănătoase, offline-după-repornire.
- **Date**: backup-uri create și restaurate, planuri exportate, instalări și upgrade-uri de pachete, modificări de moduri și lumi, și editări de fișiere.
- **Jucători**: eliminări (kicks), interdicții (bans), modificări la lista albă (whitelist) și la permisiunile de administrator (op), și note despre jucători.
- **Configurare**: modificări ale comenzilor din chat, modificări de utilizatori și roluri, modificări de permisiuni per server, modificări ale porturilor de joc și editări de setări.

Fiecare intrare înregistrează cine a făcut-o (un nume de utilizator sau panoul/planificatorul pentru acțiuni automate), la ce server se referă și când. [Tabloul de bord](/docs/dashboard/) afișează cele mai recente intrări; această pagină este istoricul complet. Operatorii și vizualizatorii văd doar intrările pentru serverele pe care le pot vizualiza (plus cele generale ale panoului), iar modificările de permisiuni per server sunt afișate doar administratorilor. Evenimentele de ciclu de viață și alertele pot fi, de asemenea, trimise către Discord (vezi [Integrări](/docs/integrations/)).

Deoarece captează evenimente relevante pentru securitate (conectări, modificări 2FA, modificări de roluri și permisiuni), jurnalul de activitate este, de asemenea, primul loc unde te uiți dacă ceva nu este în regulă cu un cont.
