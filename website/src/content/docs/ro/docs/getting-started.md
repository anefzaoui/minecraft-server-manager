---
title: 'Primii pași'
description: 'Instalează Minecraft Server Manager și finalizează configurarea inițială: verificarea sistemului, fusul orar și contul de administrator.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Înapoi la indexul documentației](/docs/)

## Configurare inițială

Prima dată când deschideți panoul, un scurt expert de configurare vă ghidează prin proces:

1.  **Verificare sistem** se asigură că Docker este accesibil, Node.js este suficient de nou și folderul de date este scriibil. Dacă Docker nu rulează încă, puteți continua; crearea și pornirea serverelor așteaptă până când acesta este activ.
2.  **Creează-ți contul de administrator**. Acesta este singurul cont care există până când adăugați altele și are control complet. Alegeți un nume de utilizator (2 până la 32 de caractere) și o parolă de cel puțin 8 caractere. Veți fi conectat imediat ce este creat.
3.  **Configurare panou** (opțional): un domeniu public pentru a afișa jucătorilor în adresele de conectare, o cheie API CurseForge și fusul orar. Toate acestea pot fi modificate ulterior în **Setări**.

Ultimul pas oferă **Creare server** sau **Mergi la tabloul de bord**.

![Pasul Verificare sistem al configurării inițiale](/docs/images/setup-system-check.png)

> **Instalările expuse sunt protejate prin PIN.** Dacă porniți panoul legat la o adresă non-loopback (`PANEL_HOST` diferit de `127.0.0.1`), pagina de configurare solicită și un **PIN de 6 cifre**. Panoul îl afișează în consola sa la pornire. Introduceți-l împreună cu numele de utilizator și parola. Acest lucru împiedică un străin care ajunge primul la port să revendice contul de administrator. PIN-ul dispare odată ce contul de administrator există.

## Autentificare

După configurare, panoul este protejat de un ecran de autentificare. Introduceți numele de utilizator și parola pentru a continua.

![Autentificare](/docs/images/login.png)

Dacă [autentificarea cu doi factori](/docs/two-factor-authentication/) este activată pe contul dvs., vi se va solicita un cod de 6 cifre din aplicația dvs. de autentificare imediat după parolă.

## Orientare în panou

Totul este organizat în bara laterală din stânga:

- **Tablou de bord** - toți serverele dintr-o privire ([detalii](/docs/dashboard/)).
- **Servere**, **Pachete de moduri**, **Lumi**, **Scheme** - crearea și gestionarea serverelor și a conținutului acestora.
- **Actualizări**, **Copii de rezervă**, **Programări**, **Stocare**, **Activitate** - partea operațională: ce este învechit, instantanee, automatizare, utilizarea discului și jurnalul de audit.
- **Permisiuni** (jos, doar pentru administratori): ce poate face fiecare utilizator pe fiecare server ([detalii](/docs/users-and-roles/#per-server-permissions)).
- **Setări** (jos, doar pentru administratori): chei API, configurare panou, valori implicite pentru servere noi, [păstrarea copiilor de rezervă](/docs/backups/#retention), utilizatori, securitatea autentificării și API-ul public.

Sub acestea, bara laterală listează serverele dvs. Deschiderea unuia afișează propriile file: **Prezentare generală**, **Consolă**, **Jucători**, **Moduri**, **Lume**, **Copii de rezervă**, **Monitorizare** și **Setări**, majoritatea cu sub-file asociate (de exemplu, **Setări → Configurare** conține setările serverului și portul jocului acestuia). Vezi [Un singur server](/docs/servers/#a-single-server).

Bara de sus are butonul **Creare server**, un **comutator de temă** (întunecată/deschisă) și **meniul contului dvs.**, unde puteți schimba poza de profil, gestiona [autentificarea cu doi factori](/docs/two-factor-authentication/) sau vă puteți deconecta.

## Pe telefon sau tabletă

Fiecare pagină este concepută mai întâi pentru un ecran îngust și se extinde de acolo: bara laterală se ascunde în spatele butonului de meniu, tabelele de date se empachetează în carduri, barele de instrumente se înfășoară, iar șina de control al lumii se restrânge la un card pe care îl deschideți când aveți nevoie de el. Butoanele și etichetele au o dimensiune reală a țintei tactile. Nimic nu este exclusiv pentru desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Tablou de bord pe telefon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Prezentare generală server pe telefon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Consolă pe telefon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Filă Moduri pe telefon" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Compatibilitate versiuni pe telefon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Setări pe telefon" width="180">
</p>

## Ce ai nevoie

Panoul comunică cu Docker pentru a rula servere, deci are nevoie de acces la un demon Docker (Docker Desktop sau un socket Docker Engine). Când Docker este accesibil, indicatorul Docker din tabloul de bord afișează **Conectat** și versiunea sa. Dacă nu este, panoul rulează în continuare. Nu puteți porni servere până când demonul nu este activ.

## Pașii următori

- [Creează-ți primul server →](/docs/servers/)
- [Securizează-ți contul cu 2FA →](/docs/two-factor-authentication/)
