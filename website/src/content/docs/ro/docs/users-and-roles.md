---
title: 'Utilizatori și roluri'
description: 'Panoul este multi-utilizator.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Înapoi la indexul documentației](/docs/)

Panoul este multi-utilizator. Gestionați conturile în **Setări → Utilizatori**.

![Utilizatori](/docs/images/settings-users.png)

## Cele trei roluri

| Rol          | Poate face                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Totul: gestionarea utilizatorilor, cheilor API, fișierelor globale, suprascrierilor avansate Docker și a tuturor acțiunilor serverului.            |
| **operator** | Rulează și configurează servere (pornire/oprire, consolă, backup-uri, lumi, moduri, majoritatea setărilor), dar nu zonele exclusive pentru admini. |
| **viewer**   | Doar citire. Vizualizează serverele și starea lor, dar nu efectuează nicio modificare.                                                             |

Fiecare utilizator, inclusiv un vizualizator, își poate gestiona propria [autentificare în doi pași](/docs/two-factor-authentication/), deoarece protejarea propriului login nu este o acțiune de administrare a serverului.

## Doar pentru administratori și de ce

Câteva elemente sunt restricționate intenționat doar pentru administratori:

- **Gestionarea utilizatorilor, cheilor API și fișierelor globale.**
- **[API-ul public](/docs/public-api/)** - activarea `/api/v1` și crearea, delimitarea sau revocarea token-urilor sale Bearer doar pentru citire.
- **Suprascrieri Docker avansate** - nume personalizat al containerului, porturi suplimentare publicate și montări de tip bind. O montare de tip bind poate mapa orice cale de pe gazdă în interiorul unui container și, combinată cu accesul panoului la Docker, este echivalentă cu root pe gazdă. Aceste câmpuri apar doar pentru administratori.

Numele personalizate ale containerelor nu pot locui în propriul spațiu `msm-` al panoului, astfel încât un container numit manual nu poate umbri niciodată serverul altcuiva și redirecționa o comandă de oprire sau o comandă către instanța greșită.

## Gestionarea conturilor

![Poză de profil](/docs/images/profile-picture.png)

Administratorii pot crea utilizatori, schimba roluri, reseta parole și șterge conturi din tabelul Utilizatori. Coloana **2FA** arată dacă fiecare utilizator are activată autentificarea în doi pași; un administrator poate **reseta** 2FA-ul altui utilizator (pentru cazul pierderii telefonului și a codurilor de rezervă), dar niciodată nu și-l poate dezactiva pe al său fără parola, lucru pe care fluxul de auto-servire îl gestionează în schimb.

Logările eșuate sunt limitate pe cont (atât un contor per IP, cât și un contor global pe cont) pentru a încetini încercările de brute-force, iar aceeași limită acoperă și pasul codului 2FA, astfel încât o parolă corectă să nu poată reseta contorul înainte de ghicirea codului. În fața acestui sistem se află un limitator mai grosier per client IP pentru endpoint-urile de login / 2FA / setup, configurabil prin `RATE_LIMIT_AUTH_PER_15MIN` (implicit 100; în spatele unui reverse proxy, setați `TRUST_PROXY` pentru ca acesta să se bazeze pe IP-ul real al clientului).
