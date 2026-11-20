---
title: 'Utilizatori și roluri'
description: 'Conturi, rolurile de administrator, operator și vizualizator, și permisiuni per server în Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Înapoi la indexul documentației](/docs/)

Panoul este multi-utilizator. Gestionați conturile în **Setări → Utilizatori**.

![Utilizatori](/docs/images/settings-users.png)

## Cele trei roluri

| Rol          | Implicit pe fiecare server                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Totul: gestionați utilizatori, chei API, fișiere globale, suprascrieri Docker avansate și toate acțiunile serverului.                                    |
| **operator** | Rulați și configurați servere (porniți/opriți, consolă, backup-uri, lumi, moduri, majoritatea setărilor), dar nu zonele exclusive pentru administratori. |
| **viewer**   | Doar citire. Vizualizați serverele și starea lor, dar nu efectuați modificări.                                                                           |

Fiecare utilizator, inclusiv un vizualizator, își poate gestiona propria [autentificare cu doi factori](/docs/two-factor-authentication/), deoarece protejarea propriului login nu este o acțiune de gestionare a serverului.

Un rol este **implicit** pentru fiecare server. Pentru a acorda cuiva drepturi diferite pe un singur server, utilizați permisiunile specifice serverului de mai jos.

## Permisiuni specifice serverului

Pagina **Permisiuni** (în bara laterală sau **Permisiuni server** sub **Setări → Utilizatori**) afișează o grilă: fiecare operator și vizualizator pe verticală, fiecare server pe orizontală. Faceți clic pe o celulă pentru a decide ce poate face acel utilizator pe acel singur server. Administratorii nu sunt listați deoarece au întotdeauna totul.

![Permisiuni](/docs/images/settings-permissions.png)

Fiecare celulă este un set de permisiuni:

| Permisiune   | Ce permite pe acel server                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **View**     | Vizualizați serverul, starea sa, ieșirea consolei, jucătorii, istoricul și statisticile.                                                      |
| **Power**    | Porniți, opriți, reporniți, opriți forțat și reconstruiți serverul.                                                                           |
| **Console**  | Rulați comenzi de consolă și acțiuni rapide ale lumii, trimiteți chat și gestionați comenzi de chat.                                          |
| **Players**  | Eliminați (kick), interziceți (ban), adăugați pe lista albă (whitelist), acordați rol de operator (op) și editați notele jucătorilor.         |
| **Content**  | Instalați și eliminați moduri, pluginuri, pachete, lumi, datapack-uri și editați inventarele.                                                 |
| **Backups**  | Creați, restaurați, descărcați și ștergeți backup-uri.                                                                                        |
| **Files**    | Răsfoiți, editați, încărcați și descărcați fișierele serverului, jurnalele arhivate și pachetele de jurnale; exportați șabloane (blueprints). |
| **Settings** | Modificați setările serverului, proprietățile, integrările, pictograma și actualizați versiunile.                                             |
| **Delete**   | Ștergeți serverul.                                                                                                                            |

![Editor de permisiuni](/docs/images/permissions-editor.png)

Sub grilă, **Ce acoperă fiecare permisiune** detaliază fiecare permisiune în ceea ce poate face o persoană, ce nu este inclus și rutele exacte ale panoului pe care le deblochează. Ultima listă este verificată în raport cu codul rulat de suita de teste.

![Referință permisiuni](/docs/images/permissions-reference.png)

Pe un telefon, grila se empachetează într-un card per utilizator, cu un rând per server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Permisiuni pe un telefon" width="180">
</p>

Cum se potrivesc piesele:

- **Rolul este implicit.** Un operator începe cu toate permisiunile pe toate serverele; un vizualizator începe doar cu Vizualizare. O celulă cu text estompat (tooltip-ul său spune "Implicit rol") nu a fost niciodată modificată.
- **O celulă suprascrie rolul doar pentru acel server.** Acordați unui vizualizator Putere și Consola pe un server și acesta îl poate rula, în timp ce toate celelalte servere rămân doar pentru citire pentru el. Eliminați Ștergerea de la un operator pe serverul principal și acesta păstrează totul acolo.
- **Fiecare permisiune include Vizualizare.** Nu puteți acționa asupra unui server pe care nu îl puteți vedea.
- **Dezactivați totul pentru a ascunde un server.** Acesta dispare din bara laterală, tabloul de bord, backup-urile, programările, activitatea, actualizările, pachetele de moduri, starea live, sarcinile în curs și șabloanele utilizatorului, iar biblioteca de lumi încetează să-l numească. Un link direct, o cerere API sau o conexiune la consolă răspund "neidentificat", la fel ca un server care nu există.
- **Acțiunile la nivel de panou urmează în continuare rolul.** Crearea de servere (inclusiv clonarea unuia), stocarea, utilizatorii, cheile API, setările globale și programările la nivel de panou nu sunt specifice serverului, așa că un vizualizator cu permisiuni pe unele servere nu poate face totuși niciuna dintre acestea. Operatorii păstrează crearea de servere și programările la nivel de panou; stocarea, utilizatorii, cheile API și setările globale sunt exclusive pentru administratori.
- **Programările urmează serverul.** O repornire programată, un backup sau o comandă pe un server necesită permisiunea corespunzătoare acolo (Putere, Backup-uri sau Consola), indiferent de rol.
- **Șabloanele urmează, de asemenea, serverul.** Exportarea unui server ca șablon necesită Permisiunea Fișiere acolo, deoarece arhiva transportă fișierele sale. Un șablon exportat dintr-un server pe care cineva nu îl poate vedea este ascuns și pentru el.
- **Zonele exclusive pentru administratori rămân exclusive pentru administratori** pe fiecare server: chatbot-ul, retenția backup-urilor și suprascrierile Docker avansate.

Fiecare modificare este înregistrată în jurnalul de activitate cu cine a modificat ce; aceste intrări sunt afișate doar administratorilor. Ștergerea unui utilizator îi elimină rândurile. Eliminarea unui server le păstrează, astfel încât un server ascuns de cineva rămâne ascuns în istoricul său și în backup-urile păstrate.

Instalările existente continuă să funcționeze neschimbate: până când un administrator editează o celulă, fiecare utilizator are exact ceea ce i-a oferit rolul său înainte.

## Exclusiv pentru administratori și de ce

Câteva lucruri sunt restricționate intenționat pentru administratori:

- **Gestionarea utilizatorilor, stocarea, setările globale, cheile API și fișierele globale.**
- **[API-ul public](/docs/public-api/)**: activarea `/api/v1` și crearea, delimitarea sau revocarea token-urilor sale de tip Bearer doar pentru citire.
- **Suprascrieri Docker avansate**: nume personalizat al containerului, publicări suplimentare de porturi și montări (bind mounts). O montare (bind mount) poate mapa orice cale de pe gazdă într-un container și, combinată cu accesul Docker al panoului, aceasta este efectiv root pe gazdă. Aceste câmpuri apar doar pentru administratori.

Numele personalizate ale containerelor nu pot locui, de asemenea, în spațiul `msm-` al panoului, astfel încât un container numit manual nu poate umbri niciodată instanța altui server și poate direcționa greșit o oprire sau o comandă către instanța greșită.

## Gestionarea conturilor

![Imagine de profil](/docs/images/profile-picture.png)

Administratorii pot crea utilizatori, modifica roluri, reseta parole și șterge conturi din tabelul Utilizatori. Coloana **2FA** arată dacă fiecare utilizator are activată autentificarea cu doi factori; un administrator poate reseta 2FA-ul altui utilizator cu **Resetare 2FA** din meniul de acțiuni al acelui utilizator (pentru cazul pierderii telefonului și a codurilor de rezervă), dar niciodată nu și-l poate dezactiva pe al său fără parola, ceea ce fluxul de auto-servire gestionează în schimb.

Logările eșuate sunt limitate pe cont (atât un contor per IP, cât și un contor global per cont) pentru a încetini încercările de forță brută, iar aceeași limită acoperă și pasul codului 2FA, astfel încât o parolă corectă să nu poată reseta contorul înainte de ghicirea codului. În fața acestui lucru se află un limitator de cereri mai grosier per IP client pe endpoint-urile de login / 2FA / setup, ajustabil prin `RATE_LIMIT_AUTH_PER_15MIN` (implicit 100; în spatele unui reverse proxy, setați `TRUST_PROXY` pentru a cheia pe IP-ul real al clientului).
