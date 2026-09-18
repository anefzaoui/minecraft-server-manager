---
title: 'Jurnal de activități'
description: 'Pagina Activități este jurnalul complet de audit: o înregistrare cronologică, ce poate fi căutată, a tot ce s-a întâmplat în panou.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Activitate** este jurnalul complet de audit: o înregistrare cronologică, căutabilă, a tot ceea ce s-a întâmplat în panou.

![Activitate](/docs/images/activity.png)

## Ce se înregistrează

- **Autentificare** - conectări (inclusiv dacă s-a folosit 2FA sau un cod de rezervă), și activarea, dezactivarea sau resetarea 2FA.
- **Ciclul de viață al serverului** - creări, porniri, opriri, reporniri, blocări și evenimente de memorie insuficientă.
- **Alerte** - porniri blocate, eșecuri la oprire, programări eșuate, opriri din cauza cotelor, containere nesănătoase, offline-după-repornire.
- **Date** - backup-uri create și restaurate, blueprint-uri exportate, instalări și upgrade-uri de pachete.
- **Configurare** - modificări ale comenzilor de chat, modificări ale rolurilor și editări ale setărilor.

Fiecare intrare înregistrează cine a făcut-o (un nume de utilizator sau panoul/planificatorul pentru acțiuni automate), la ce server se referă și când. [Tabloul de bord](/docs/dashboard/) afișează cele mai recente intrări; această pagină este istoricul complet. Evenimentele de ciclu de viață și alertele pot fi, de asemenea, redirecționate către Discord (vezi [Integrări](/docs/integrations/)).

Deoarece surprinde evenimente relevante pentru securitate (logări, modificări 2FA, modificări de roluri), jurnalul de activitate este, de asemenea, primul loc unde te uiți dacă ceva nu este în regulă cu un cont.
