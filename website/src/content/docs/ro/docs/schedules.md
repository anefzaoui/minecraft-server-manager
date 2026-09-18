---
title: 'Programări'
description: 'Pagina Programări automatizează sarcinile recurente cu expresii cron.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Programări** automatizează sarcinile recurente cu expresii cron. Fără cron extern, fără scripturi.

![Programări](/docs/images/schedules.png)

## Ce puteți programa

- **Reporniri** - o repornire nocturnă pentru a menține un server care rulează de mult timp sănătos.
- **Copii de rezervă** - instantanee regulate (etichetate `scheduled` pe pagina [Copii de rezervă](/docs/backups/)).
- **Comenzi** - executați orice comandă de server la o anumită oră.
- **Verificări de actualizare** - reîmprospătați periodic ce este învechit.

Fiecare programare vizează un server specific (sau panoul global), rulează pe propria expresie cron și poate fi activată sau dezactivată fără a fi ștearsă. Se afișează ora ultimei execuții, astfel încât să puteți confirma că funcționează.
