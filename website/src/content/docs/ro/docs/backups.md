---
title: 'Backupuri'
description: 'Pagina Backupuri afișează fiecare instantaneu din flota dvs., cu dimensiunea, motivul și vechimea, filtrabile după server și după motiv.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Înapoi la indexul documentației](/docs/)

Pagina **Backup-uri** conține toate instantaneele din flota dvs., cu dimensiunea, motivul și vechimea, filtrabile pe server și pe motiv.

![Backup-uri](/docs/images/backups.png)

## Crearea unui backup

Dintr-un tab **Backup-uri** al unui server (sau printr-un [program](/docs/schedules/)) puteți crea o instantanee a întregului director al serverului printr-un singur clic. Panoul oprește temporar lumea (`save-off` → `save-all`), comprimă datele, apoi reactivează salvarea (`save-on`), astfel încât backup-urile să fie consistente chiar și pe un server în funcțiune. Compresia rulează într-un fir de execuție de fundal, astfel încât să nu blocheze panoul. Un backup inițiat prin API poate purta o notă.

Fiecare arhivă este **verificată integritatea** în momentul scrierii: panoul redeschide fișierul zip și citește directorul acestuia. O arhivă coruptă sau imposibil de deschis este ștearsă, iar apelul de backup eșuează imediat, în loc ca problema să apară luni mai târziu, când o restaurare este singurul lucru între dvs. și pierderea datelor. O arhivă cu zero intrări (un server care nu a pornit niciodată) este permisă, dar marcată în eveniment.

Bifați **"Micșorează și lumea după aceea"** (pe tab-ul Backup-uri sau într-un program de backup) pentru a elimina fragmentele rar vizitate odată ce arhiva este scrisă în siguranță (vezi **[Micșorarea unei lumi](/docs/world-shrink/)**). Micșorarea rulează doar cât timp serverul este oprit; pe un server în funcțiune, backup-ul se efectuează în continuare, iar micșorarea este omisă.

![Backup-uri de server](/docs/images/server-backups.png)

## Motive pentru backup

Backup-urile sunt etichetate în funcție de motivul pentru care au fost create:

- **manual**: ați apăsat pe **Backup Acum**. Înlocuirea lumii active a unui server cu una din bibliotecă ia, de asemenea, mai întâi un backup `manual`.
- **programat**: creat de un [program](/docs/schedules/). Fiecare server nou primește, de asemenea, automat un backup zilnic programat (eșalonat între 02:00 și 05:59), astfel încât un server să aibă acoperire automată de la prima zi, nu doar înainte de actualizări.
- **pre-actualizare**: efectuat automat înainte de o actualizare a pachetului sau o schimbare a versiunii Minecraft, astfel încât o actualizare să fie întotdeauna reversibilă.
- **pre-restaurare**: efectuat automat chiar înainte de o restaurare sau o resetare a lumii, ca o plasă de siguranță în cazul în care restaurarea nu este ceea ce doreați.

## Păstrare

Păstrarea este limitată **per server, per motiv**: cele mai noi din fiecare grup sunt păstrate, cele mai vechi sunt eliminate automat după fiecare backup reușit:

| Motiv           | Păstrat implicit |
| --------------- | ---------------- |
| programat       | 10               |
| pre-actualizare | 10               |
| manual          | 20               |
| pre-restaurare  | 5                |

`pre-restaurare` (numite backup-uri de siguranță în panou) are propriul său mic spațiu, tocmai pentru ca un backup automat de siguranță să nu poată elimina niciodată un backup `manual` pe care l-ați păstrat în mod deliberat.

Două limite opționale se aplică peste numărul per motiv, ambele dezactivate implicit: o **vârstă maximă** (backup-urile mai vechi de N zile sunt eliminate, indiferent de motivul lor) și o **dimensiune totală maximă** per server (cele mai vechi sunt eliminate până când totalul se încadrează: backup-urile de siguranță mai întâi, apoi cele programate, apoi restul). Cel mai nou backup al unui server nu este niciodată eliminat de nicio limită.

### Modificarea acesteia

Administratorii stabilesc politica la nivel de panou în cardul **Păstrare Backup-uri** din pagina **Setări** (**Completare Valori Implicite** reintroduce valorile implicite de mai sus în formular, gata de salvare). Un server poate diferi la oricare dintre cele șase valori: deschideți tab-ul său **Backup-uri** și extindeți **Păstrare pentru Acest Server**. Fiecare câmp de acolo este gol, cu excepția cazului în care serverul îl setează, iar un câmp gol urmează valoarea la nivel de panou (afișată în interiorul acestuia). Astfel, un server poate, de exemplu, să păstreze 3 backup-uri programate și să folosească valorile la nivel de panou pentru tot restul; golirea unui câmp îl readuce la valoarea la nivel de panou.

![Cardul Păstrare Backup-uri în Setări](/docs/images/settings-retention.png)

![Păstrare pentru Acest Server pe tab-ul Backup-uri al unui server](/docs/images/server-retention.png)

Salvarea nu șterge niciodată nimic de la sine. Dacă noile limite ar lăsa backup-urile existente peste limită, panoul listează, per server, câte backup-uri de fiecare tip ar fi eliminate, cât spațiu eliberează și cât de vechi este cel mai vechi. De asemenea, indică atunci când un server depășea deja limitele înainte de această modificare (de exemplu, după un **De la Următorul Backup** anterior), deoarece aplicarea acum elimină tot ce depășește limita, nu doar ceea ce adaugă această editare. Apoi întreabă cum să le aplice:

- **Elimină Acum** șterge exact backup-urile pe care tocmai le-a listat, nimic mai mult: un backup realizat între timp așteaptă următoarea eliminare. De pe pagina Setări, un server aflat în mijlocul unei restaurări, backup sau acțiuni similare este omis și elimină după următorul backup; pe tab-ul propriu de Backup-uri al unui server, vi se cere să încercați din nou odată ce acea acțiune se finalizează. În timp ce backup-urile vechi ale unui server sunt șterse (de obicei secunde), alte acțiuni pe acel server trebuie să aștepte: un backup sau pornire programată care ajunge atunci reîncearcă în fiecare minut până când poate (până la 30 de minute), un server blocat este repornit în aproximativ 20 de secunde după ce se finalizează (până la 30 de minute), iar o repornire sau oprire programată care se suprapune cu acesta este omisă până la următoarea sa oră.
- **De la Următorul Backup** le păstrează pentru moment; fiecare server își elimină backup-urile data viitoare când creează unul, așa cum a făcut întotdeauna.

![Dialogul care listează ce ar elimina noile limite](/docs/images/retention-preview.png)

Un backup care este restaurat nu este niciodată eliminat cât timp rulează restaurarea: păstrarea îl lasă în pace (și nu șterge alte backup-uri pentru a face loc acestuia), iar ștergerea lui manuală este refuzată până când restaurarea se finalizează.

Aceleași setări sunt disponibile pentru scripturi ca puncte finale API de administrator: `GET`/`POST /api/backups/retention` și `/api/servers/:id/backups/retention`. Valorile la nivel de panou nu pot fi `null`. Pentru un server, o valoare `null` (sau `""`) elimină cheia respectivă, astfel încât să urmeze din nou valoarea la nivel de panou, iar `{ "reset": true }` le elimină pe toate. Sub fiecare dintre cele două căi, `POST …/preview` raportează ce ar elimina o modificare fără a o elimina (`backups`, `bytes`, `servers`, `ids` și o defalcare per server `byServer`), iar `POST …/apply` aplică politica salvată acum și răspunde cu `{ deleted, skipped }` la nivel de panou (`skipped` numără serverele ocupate) sau `{ deleted }` pentru un singur server. Trimiteți `{ "token": "..." }` din preview (păstrat timp de 10 minute) sau `{ "ids": [...] }` pentru a șterge doar acelea; fără niciuna, tot ce depășește limita este eliminat. O aplicare per server pe un server ocupat răspunde cu 409.

Backup-urile pot fi **redenumite** din lista de backup-uri (butonul de redenumire de pe fiecare rând). Arhiva de pe disc și înregistrarea panoului se mută împreună, astfel încât descărcarea, restaurarea și păstrarea continuă să funcționeze cu noul nume.

![Redenumirea unui backup](/docs/images/backup-rename.png)

> Păstrarea este limitată automat, dar arhivele mari modificate încă contează în [cota de stocare](/docs/storage/) a unui server, așa că fiți atenți la totalul pentru pachetele mari.

## Restaurare

Restaurarea unui backup oprește serverul (verificând că containerul s-a oprit cu adevărat înainte de a atinge fișierele), face un backup de siguranță `pre-restaurare`, înlocuiește **întregul director al serverului** cu instantaneul și îl lasă oprit pentru a-l porni din nou. Arhiva este despachetată mai întâi într-o parte și apoi înlocuită odată ce s-a extras complet, astfel încât o restaurare care eșuează pe parcurs lasă fișierele curente neatacate. Deoarece actualizările de pachete iau întotdeauna un backup `pre-actualizare` mai întâi, puteți oricând să reveniți la o actualizare problematică.

## Baza de date a panoului

Backup-urile serverului acoperă doar folderul propriu al fiecărui server. Baza de date a panoului (`panel.db`, care conține utilizatori, roluri, secrete 2FA, programe, pini de pachete și istoric) este salvată separat în timpul cronometrajului zilnic de întreținere:

- `VACUUM INTO` scrie o copie consistentă și defragmentată în `backups/_panel/` în folderul de date; cele mai noi **14** sunt păstrate.
- La pornire, panoul rulează `PRAGMA integrity_check` și înregistrează zgomotos dacă eșuează, indicându-vă spre `backups/_panel` pentru cea mai recentă copie bună.

Dacă faceți backup la întregul folder de date (care conține și `.secret-key`, cheia de criptare în repaus), ați făcut backup la tot.
