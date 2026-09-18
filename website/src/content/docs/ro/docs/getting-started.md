---
title: 'Primii pași'
description: 'Prima dată când deschideți panoul, acesta vă solicită să creați un cont de administrator.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Înapoi la indexul documentației](/docs/)

## Configurare la prima rulare

Prima dată când deschideți panoul, acesta vă cere să creați un cont de administrator. Acesta este singurul cont care există până când adăugați altele și are control complet.

Alegeți un nume de utilizator și o parolă de cel puțin 8 caractere. Atât: sunteți conectat și direcționat direct către tabloul de bord.

> **Instalările expuse sunt protejate cu PIN.** Dacă porniți panoul legat la o adresă non-loopback (`PANEL_HOST` diferit de `127.0.0.1`), pagina de configurare vă cere și un **PIN de 6 cifre**. Panoul îl afișează în consola sa la pornire. Introduceți-l împreună cu numele de utilizator și parola. Acest lucru împiedică un străin care ajunge primul la port să revendice contul de administrator. PIN-ul dispare odată ce contul de administrator există.

## Autentificare

După configurare, panoul este protejat de un ecran de conectare. Introduceți numele de utilizator și parola pentru a continua.

![Autentificare](/docs/images/login.png)

Dacă [autentificarea cu doi factori](/docs/two-factor-authentication/) este activată pe contul dvs., vi se va cere un cod de 6 cifre de la aplicația dvs. de autentificare imediat după parolă.

## Orientare în panou

Totul este organizat în bara laterală din stânga:

- **Tablou de bord** - toți serverele dintr-o privire ([detalii](/docs/dashboard/)).
- **Servere**, **Modpack-uri**, **Lumi**, **Scheme** - creați și gestionați servere și conținutul acestora.
- **Actualizări**, **Copii de rezervă**, **Programări**, **Stocare**, **Activitate** - partea operațională: ce este învechit, instantaneele dvs., automatizare, utilizarea discului și jurnalul de audit.
- **Setări** (jos): utilizatori, chei API și configurarea panoului.

Bara de sus conține butonul **Creare server**, un **comutator de temă** (întunecată/deschisă) și **meniul contului dvs.**, unde puteți gestiona [autentificarea cu doi factori](/docs/two-factor-authentication/) sau vă puteți deconecta.

## Pe telefon sau tabletă

Fiecare pagină este concepută mai întâi pentru un ecran îngust și se lărgește de acolo: bara laterală se ascunde în spatele butonului de meniu, tabelele de date se stivuiesc în carduri, barele de instrumente se înfășoară, iar șina de control al lumii se colapsează într-un card pe care îl deschideți când aveți nevoie de el. Butoanele și etichetele au o dimensiune reală a țintei tactile. Nimic nu este exclusiv pentru desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Tablou de bord pe telefon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Prezentare generală a serverului pe telefon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Consolă pe telefon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Fila Mod-uri pe telefon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Setări pe telefon" width="180">
</p>

## Ce aveți nevoie

Panoul comunică cu Docker pentru a rula servere, deci are nevoie de acces la un demon Docker (Docker Desktop sau un socket Docker Engine). Când Docker este accesibil, fișa Docker din tabloul de bord afișează **Conectat** și versiunea sa. Dacă nu este, panoul rulează în continuare. Nu puteți porni servere până când demonul nu este pornit.

## Pașii următori

- [Creați primul server →](/docs/servers/)
- [Securizați-vă contul cu 2FA →](/docs/two-factor-authentication/)
