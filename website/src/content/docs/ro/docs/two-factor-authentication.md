---
title: 'Autentificare în doi pași'
description: 'Autentificarea în doi pași (2FA) adaugă un al doilea pas la conectare: după parola dvs., introduceți un cod scurt dintr-o aplicație de autentificare de pe telefon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Înapoi la indexul documentației](/docs/)

Autentificarea cu doi factori (2FA) adaugă un al doilea pas la conectare: după parola ta, introduci un cod scurt dintr-o aplicație de autentificare de pe telefon. Chiar dacă cineva îți află parola, nu poate accesa contul fără dispozitivul tău.

Funcționează cu orice aplicație de autentificare standard TOTP (Google Authenticator, Authy, 1Password, Microsoft Authenticator și altele) și este disponibilă pentru **orice** cont, nu doar pentru administratori. Protejarea propriei tale conectări nu este o acțiune de administrare a serverului, așa că și vizualizatorii și operatorii o pot activa.

## Activarea 2FA

Deschide meniul contului (inițiala ta, în dreapta sus) și alege **Autentificare cu doi factori**.

![Meniu cont](/docs/images/2fa-user-menu.png)

Vei primi o fereastră de înrolare:

![Înrolare](/docs/images/2fa-enroll.png)

1. **Scanează codul QR** cu aplicația ta de autentificare sau apasă **Copiere** și introdu cheia manuală.
2. Introdu **codul de 6 cifre** pe care îl afișează acum aplicația ta.
3. **Confirmă parola.** Activarea 2FA verifică din nou parola, astfel încât o sesiune deschisă neintenționat să nu o poată activa cu dispozitivul altcuiva.
4. Apasă **Activare**.

### Salvează-ți codurile de rezervă

În momentul în care 2FA este activată, panoul afișează un set de **coduri de rezervă** valabile o singură dată.

![Coduri de rezervă](/docs/images/2fa-backup-codes.png)

Fiecare cod funcționează **o singură dată**, pentru a te conecta dacă pierzi vreodată accesul la aplicația de autentificare. Salvează-le undeva în siguranță (un manager de parole este ideal), deoarece nu vor mai fi afișate. Poți genera un nou set oricând (ceea ce invalidează setul vechi).

## Conectarea cu 2FA

De atunci, conectarea are un al doilea pas. După numele de utilizator și parola, panoul îți cere codul:

![Conectare 2FA](/docs/images/2fa-login-challenge.png)

Introdu codul curent de 6 cifre din aplicația ta (sau unul dintre codurile de rezervă) și ești conectat. Până la finalizarea acestui pas, sesiunea **nu** este conectată: nu poate accesa nicio pagină sau API.

## Gestionarea sau dezactivarea 2FA

Deschide aceeași opțiune **Autentificare cu doi factori** din meniul contului cât timp este activată. După confirmarea parolei, poți:

- **Regenera codurile de rezervă** - emite un nou set și invalidează setul vechi.
- **Dezactiva 2FA** - o elimină din contul tău.

Ambele acțiuni verifică mai întâi parola curentă.

## Ai pierdut telefonul _și_ codurile de rezervă?

Un **administrator** poate reseta 2FA-ul altui utilizator din **Setări → Utilizatori** (butonul **Resetare** din coloana 2FA). Acest lucru șterge 2FA-ul contului, permițând utilizatorului să se conecteze doar cu parola și să o configureze din nou. Administratorii nu își pot reseta propriul 2FA fără parolă. Aceștia trec prin procesul normal de dezactivare protejat de parolă, astfel încât o sesiune de administrator compromisă să nu își poată elimina propriul al doilea factor.

## Bine de știut

- Codurile sunt bazate pe timp și se rotesc la fiecare 30 de secunde; panoul acceptă o mică deviație a ceasului și se recuperează silențios dacă ceasul serverului este corectat ulterior.
- Un cod nu poate fi reutilizat - odată folosit pentru conectare, același cod nu va mai funcționa în fereastra sa de valabilitate.
- Codurile greșite sunt limitate ca frecvență. Limita este **comună** cu pasul parolei (o blocare per cont plus o limită per IP `RATE_LIMIT_AUTH_PER_15MIN`), astfel încât introducerea unei parole corecte nu poate reseta contorul chiar înainte de a ghici codul de 6 cifre.
- Modificările 2FA (activare, dezactivare, resetare, utilizare cod de rezervă) sunt înregistrate în [Jurnalul de activități](/docs/activity/).
