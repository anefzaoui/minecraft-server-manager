---
title: 'Autentificare în doi pași'
description: 'Autentificarea în doi pași (2FA) adaugă un al doilea pas la conectare: după parola dvs., introduceți un cod scurt dintr-o aplicație de autentificare de pe telefon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Înapoi la indexul documentației](/docs/)

Autentificarea cu doi factori (2FA) adaugă un al doilea pas la conectare: după parola dvs., introduceți un cod scurt dintr-o aplicație de autentificare de pe telefon. Chiar dacă cineva vă află parola, nu poate intra fără dispozitivul dvs.

Funcționează cu orice aplicație de autentificare standard TOTP (Google Authenticator, Authy, 1Password, Microsoft Authenticator și altele) și este disponibilă pentru **fiecare** cont, nu doar pentru administratori. Protejarea propriei conectări nu este o acțiune de administrare a serverului, așa că și vizualizatorii și operatorii o pot activa.

## Activarea 2FA

Deschideți meniul contului (inițiala sau poza de profil, în dreapta sus) și alegeți **2FA**.

![Meniu cont](/docs/images/2fa-user-menu.png)

Veți primi o fereastră de înrolare:

![Înrolare](/docs/images/2fa-enroll.png)

1. **Scanați codul QR** cu aplicația dvs. de autentificare sau apăsați **Copiere** și introduceți manual cheia.
2. Introduceți **codul de 6 cifre** pe care îl afișează acum aplicația dvs.
3. **Confirmați parola.** Activarea 2FA vă reconfirmă parola, astfel încât o sesiune deschisă accidental să nu o poată activa cu dispozitivul altcuiva.
4. Faceți clic pe **Activare**.

### Salvați codurile de rezervă

În momentul în care 2FA este activată, panoul afișează un set de **coduri de rezervă** de unică folosință.

![Coduri de rezervă](/docs/images/2fa-backup-codes.png)

Fiecare cod funcționează **o singură dată**, pentru a vă conecta dacă pierdeți vreodată accesul la aplicația dvs. de autentificare. Salvați-le undeva în siguranță (un manager de parole este ideal), deoarece nu vor mai fi afișate. Puteți genera un nou set oricând (ceea ce invalidează cele vechi).

## Conectarea cu 2FA

De atunci, conectarea are un al doilea pas. După numele de utilizator și parola, panoul vă cere codul:

![Conectare 2FA](/docs/images/2fa-login-challenge.png)

Introduceți codul curent de 6 cifre din aplicația dvs. (sau unul dintre codurile de rezervă) și sunteți conectat. Până la finalizarea acestui pas, sesiunea **nu** este conectată: nu poate accesa nicio pagină sau API.

## Gestionarea sau dezactivarea 2FA

Deschideți aceeași intrare **2FA** din meniul contului cât timp este activată. După confirmarea parolei, puteți:

- **Regenerare Coduri de Rezervă** emite un nou set și le invalidează pe cele vechi.
- **Dezactivare 2FA** o elimină din contul dvs.

Ambele opțiuni vă reconfirmă parola curentă mai întâi.

## Ați pierdut telefonul _și_ codurile de rezervă?

Un **administrator** poate reseta 2FA-ul altui utilizator din **Setări → Utilizatori** (**Resetare 2FA** în meniul de acțiuni al acelui utilizator). Acest lucru șterge 2FA-ul pentru cont, astfel încât utilizatorul să se poată conecta doar cu parola sa și să o configureze din nou. Administratorii nu își pot reseta propriul 2FA fără parolă. Aceștia trec prin procesul normal de dezactivare protejat prin parolă, astfel încât o sesiune de administrator compromisă să nu își poată elimina propriul al doilea factor.

## Bine de știut

- Codurile sunt bazate pe timp și se rotesc la fiecare 30 de secunde; panoul acceptă o mică deviație a ceasului și se recuperează silențios dacă ceasul serverului este corectat ulterior.
- Un cod nu poate fi reutilizat: odată folosit pentru conectare, același cod nu va mai funcționa în fereastra sa de valabilitate.
- Codurile greșite sunt limitate ca număr. Limita este **comună** cu pasul parolei (o blocare per cont plus o limită per IP `RATE_LIMIT_AUTH_PER_15MIN`), astfel încât introducerea unei parole corecte nu poate reseta contorul chiar înainte de a ghici codul de 6 cifre.
- Modificările 2FA (activare, dezactivare, resetare, utilizare cod de rezervă) sunt înregistrate în [Jurnalul de activități](/docs/activity/).
