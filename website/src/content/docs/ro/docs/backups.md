---
title: 'Copii de rezervă'
description: 'Pagina Copii de rezervă afișează fiecare instantaneu din flota dvs., cu dimensiunea, motivul și vechimea.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Backup-uri** conține toate instantanee din flota dvs., cu dimensiunea, motivul și vechimea.

![Backup-uri](/docs/images/backups.png)

## Crearea unui backup

Dintr-o filă **Backup-uri** a unui server (sau printr-un [program](/docs/schedules/)) puteți crea o instantanee a întregului director al serverului printr-un singur clic. Panoul oprește temporar lumea (`save-off` → `save-all`), arhivează datele, apoi reactivează salvarea (`save-on`), astfel încât backup-urile sunt consistente chiar și pe un server în funcțiune. Compresia rulează într-un fir de execuție separat, astfel încât să nu blocheze panoul. Fiecare backup poate purta o notă.

Fiecare arhivă este **verificată integritatea** în momentul scrierii: panoul redeschide arhiva zip și citește directorul acesteia. O arhivă coruptă sau imposibil de deschis este ștearsă, iar solicitarea de backup eșuează imediat, în loc ca problema să apară luni mai târziu, când o restaurare este singurul lucru între dvs. și pierderea datelor. O arhivă cu zero intrări (un server care nu a fost pornit niciodată) este permisă, dar marcată în eveniment.

Bifați **"Micșorează și lumea după aceea"** (pe fila Backup-uri sau într-un program de backup) pentru a elimina fragmentele vizitate rar odată ce arhiva este scrisă în siguranță (vezi **[Micșorarea unei lumi](/docs/world-shrink/)**). Micșorarea rulează doar cât timp serverul este oprit; pe un server în funcțiune, backup-ul se realizează oricum, iar micșorarea este omisă.

![Backup-uri server](/docs/images/server-backups.png)

## Motive pentru backup

Backup-urile sunt etichetate în funcție de motivul pentru care au fost create:

- **manual** - ați apăsat butonul.
- **programat** - creat de un [program](/docs/schedules/). Fiecare server nou primește automat un backup programat zilnic (între 02:00 și 05:59), astfel încât un server are acoperire automată de la prima zi, nu doar înainte de actualizări.
- **pre-actualizare** - efectuat automat înainte de o actualizare a pachetului, astfel încât o actualizare este întotdeauna reversibilă.
- **pre-restaurare** - efectuat automat chiar înainte de o restaurare sau o resetare a lumii, ca o plasă de siguranță în cazul în care restaurarea nu este ceea ce ați dorit.

## Păstrare

Păstrarea este limitată **per server, per motiv**: cele mai noi din fiecare grup sunt păstrate, cele mai vechi sunt eliminate automat după fiecare backup reușit:

| Motiv           | Păstrate |
| --------------- | -------- |
| programat       | 10       |
| pre-actualizare | 10       |
| manual          | 20       |
| pre-restaurare  | 5        |

`pre-restaurare` are propriul său spațiu mic, tocmai pentru ca un backup automat de siguranță să nu poată elimina niciodată un backup `manual` pe care l-ați păstrat în mod deliberat.

Două limite opționale se aplică peste numărul per motiv, ambele dezactivate implicit: o **vârstă maximă** (backup-urile mai vechi de N zile sunt eliminate, indiferent de motivul lor) și o **dimensiune totală maximă** per server (cele mai vechi backup-uri sunt eliminate până când totalul se încadrează, începând cu cele `pre-restaurare`). Cel mai nou backup al unui server nu este niciodată eliminat de nicio limită. Toate acestea pot fi modificate global pe pagina Setări și suprascrise per server pe fila sa Backup-uri.

Backup-urile pot fi **redenumite** din lista de backup-uri (butonul de redenumire de pe fiecare rând). Arhiva de pe disc și înregistrarea panoului se mută împreună, astfel încât descărcarea, restaurarea și păstrarea continuă să funcționeze cu noul nume.

![Redenumirea unui backup](/docs/images/backup-rename.png)

> Păstrarea este limitată automat, dar arhivele mari cu moduri încă se contorizează în [cota de disc](/docs/storage/) a unui server, așa că fiți atenți la totalul pentru pachetele mari.

## Restaurarea

Restaurarea unui backup oprește serverul (verificând dacă containerul s-a oprit cu adevărat înainte de a atinge fișierele), efectuează un backup de siguranță `pre-restaurare`, înlocuiește **întregul director al serverului** cu instantaneul și îl lasă oprit pentru a-l porni din nou. Deoarece actualizările de pachete efectuează întotdeauna mai întâi un backup `pre-actualizare`, puteți oricând să reveniți la o actualizare problematică.

## Baza de date a panoului

Backup-urile serverului acoperă doar directoarele lumii per server. Baza de date a panoului (`panel.db`, care conține utilizatori, roluri, secrete 2FA, programe, pini de pachete și istoric) este salvată separat prin intermediul cronometrului zilnic de întreținere:

- `VACUUM INTO` scrie o copie consistentă și defragmentată în `data/backups/_panel/`; cele mai noi **14** sunt păstrate.
- La pornire, panoul rulează `PRAGMA integrity_check` și înregistrează zgomotos dacă eșuează, indicându-vă spre `data/backups/_panel` pentru cea mai recentă copie bună.

Faceți backup la întregul arbore `data/` (conține și `.secret-key`, cheia de criptare în repaus) și ați făcut backup la tot.
