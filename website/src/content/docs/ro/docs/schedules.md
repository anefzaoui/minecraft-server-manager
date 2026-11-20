---
title: 'Programări'
description: 'Pagina Programări automatizează sarcinile recurente cu expresii cron. Fără cron extern, fără scripturi.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Programări** automatizează sarcinile recurente cu expresii cron. Nu este necesar un cron extern, nici scripturi.

![Programări](/docs/images/schedules.png)

## Ce puteți programa

- **Reporniri**: o repornire nocturnă pentru a menține un server care rulează de mult timp sănătos.
- **Oprire și pornire**: opriți un server peste noapte și reporniți-l dimineața.
- **Backup-uri**: instantanee regulate (etichetate `scheduled` pe pagina [Backup-uri](/docs/backups/)). O programare de backup poate, de asemenea, să micșoreze lumea după fiecare backup ([micșorarea unei lumi](/docs/world-shrink/)). Fiecare server nou primește automat o programare zilnică de backup.
- **Comenzi**: executați orice comandă de server la o anumită programare.
- **Verificări de actualizări**: reîmprospătați periodic ce este învechit. Verificarea programată este, de asemenea, cea care aplică actualizările pentru serverele setate la [Actualizare automată](/docs/modpacks/#update-policy).

Fiecare programare vizează un server specific (sau panoul global), rulează pe propria expresie cron și poate fi activată sau dezactivată fără a fi ștearsă. Editorul previzualizează următoarele momente de rulare pe măsură ce tastați, orele cron urmează fusul orar al panoului (setat în **Setări**), iar tabelul afișează următoarea rulare a fiecărei programări. Fiecare declanșare este înregistrată ca un eveniment de istoric, la fel și o rulare eșuată.

Panoul își setează, de asemenea, propriile programări de întreținere la prima pornire, pe care le puteți reprograma sau dezactiva: o verificare zilnică a actualizărilor, o re-scanare a stocării la fiecare șase ore, o ștergere zilnică a fișierelor temporare vechi, o verificare a expirării interdicțiilor la fiecare 15 minute (ridicând interdicțiile temporare care au expirat) și o umplere nocturnă a metadatelor de conținut (completând numele și pictogramele modurilor lipsă).

## Când serverul este ocupat

Un backup sau o pornire programată care găsește serverul în mijlocul altei acțiuni (o restaurare, o curățare de backup, o modificare de port) așteaptă și încearcă din nou în fiecare minut până când acea acțiune se finalizează, timp de până la 30 de minute. O pornire în așteptare este anulată dacă cineva pornește sau oprește serverul între timp. O repornire sau oprire programată nu este reîncercată: este omisă și rulează din nou la următoarea sa oră programată.
