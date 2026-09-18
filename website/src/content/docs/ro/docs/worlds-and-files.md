---
title: 'Lumile și fișierele'
description: 'Pagina Lumile gestionează datele lumilor pe serverele tale: schimbă lumea activă, încarcă o lume sau descarcă una.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Înapoi la indexul documentației](/docs/)

## Lumi

Pagina **Lumi** gestionează datele lumilor pe serverele tale: schimbă lumea activă, încarcă o lume sau descarcă una.

![Lumi](/docs/images/worlds.png)

## Managerul de fișiere

Sub secțiunea **Lume** a unui server, fila **Fișiere** este un manager de fișiere complet în browser pentru directorul de date al acelui server. Listează, citește, editează, creează, redenumește, mută, copiază, șterge și încarcă fișiere: tot ce ai face în mod normal prin SSH, din browser.

![Manager de fișiere](/docs/images/server-files.png)

Fișierele text se deschid într-un editor cu o limită de 2 MB; fișierele mai mari pot fi descărcate. Încărcările acceptă mai multe fișiere simultan.

### Rămânând în interiorul sandbox-ului

Fiecare operațiune pe fișiere este limitată la propriul director de date al serverului. Panoul rezolvă fiecare cale și refuză orice ar ieși din limită: traversare `..`, căi absolute și chiar linkuri simbolice care indică în afara directorului (inclusiv cele nefuncționale care nu există încă). Un mod sau un plugin nu poate planta un link pentru a păcăli managerul de fișiere să citească sau să scrie în altă parte pe gazdă.

## Moduri

Pentru serverele modificate, fila **Moduri** (grupul său propriu în bara laterală a serverului) gestionează setul de moduri: răsfoiește și adaugă moduri și vezi ce este instalat. Actualizările de moduri și pachete apar pe pagina [Actualizări](/docs/updates/).

### Adăugarea de moduri

![Moduri](/docs/images/mods.png)

Patru moduri de intrare, toate de pe bara de instrumente a filei Moduri:

- **Caută moduri** - caută pe **Modrinth sau CurseForge** (eticheta CurseForge apare odată ce o cheie API este stocată în Setări → Chei API), iar pe serverele de pluginuri și **Hangar** (registrul propriu de pluginuri al PaperMC) și **SpigotMC** (prin proxy-ul CDN al Spiget) - ambele fără chei. Totul este filtrat după loader-ul serverului și versiunea Minecraft; serverele Quilt văd automat și build-urile etichetate fabric, deoarece Quilt rulează moduri fabric. Rezultatele deja pe server afișează o insignă **Instalat**. Dacă un autor CurseForge interzice descărcările automate - sau o resursă SpigotMC este găzduită în afara site-ului - panoul o spune clar și oferă o cale **Deschide pagina** + **Încarcă jar** în loc să eșueze în timpul instalării.

  ![Căutare Hangar](/docs/images/mods-search-hangar.png)

- **Importă zip** - un buton, trei forme, detectate automat:
  - Un **modpack Modrinth (`.mrpack`)**: fiecare fișier fixat este canonizat înapoi în proiectul său Modrinth prin căutare hash (astfel încât modurile importate să păstreze nume reale, pictograme și să rămână verificabile la actualizări; fișierele pe care Modrinth nu le cunoaște se instalează de la propriul URL al pachetului), verificat împotriva sumelor de control sha512 ale pachetului în timpul descărcării și previzualizat cu verdictul de potrivire. Fișierele doar pentru client sunt omise vizibil, iar ambele arbori de suprascriere (`overrides/`, apoi `server-overrides/` - copia specifică serverului câștigă) pot fi aplicate.

    ![Import mrpack](/docs/images/mrpack-import.png)

  - O **exportare de modpack CurseForge** (zip-ul pe care aplicația CurseForge îl produce, cu `manifest.json`): fiecare mod fixat este rezolvat în bloc, previzualizat cu avertismente (loader/MC greșit pentru acest server, fișiere care nu mai sunt pe CurseForge, moduri care necesită o descărcare manuală) și instalat cu progres real. `overrides/` al pachetului (configurații, scripturi) poate fi aplicat opțional - orice fișier care ar fi suprascris este salvat mai întâi în `.import-backups/<timestamp>/` în interiorul folderului serverului.
  - Un **zip simplu de jar-uri** pe care le-ai colectat tu: fiecare jar este identificat (potrivire hash Modrinth → amprentă CurseForge → metadatele proprii ale jar-ului) și judecat în raport cu serverul - _se potrivește / loader greșit / versiune MC greșită / deja instalat / neidentificat_ - astfel încât să alegi ce aparține de fapt înainte ca ceva să se instaleze.
- **Adaugă după link** - lipește aproape orice: pagini de proiect Modrinth, CurseForge, Hangar sau SpigotMC, un depozit GitHub sau un URL de lansare (un simplu `owner/repo` funcționează și el - instalările GitHub preferă cea mai recentă lansare stabilă și omit jar-urile sidecar `-sources`/`-javadoc`), un simplu slug Modrinth sau orice URL direct `.jar`. Panoul rezolvă build-ul corect pentru loader-ul serverului și versiunea MC.

  ![Adaugă după link](/docs/images/mods-add-by-link.png)

- **Încarcă jar** (din fallback-ul de căutare sau rezolvitorul de descărcări în așteptare) - jar-urile încărcate sunt identificate în același mod, astfel încât să își păstreze numele real, versiunea, pictograma și să devină verificabile la actualizări.

Fiecare instalare din registru este **verificată prin sumă de control în timpul descărcării**: fluxul este verificat împotriva celui mai puternic digest publicat de registru (sha512 → sha256 → sha1 → md5), iar o nepotrivire anulează procesul înainte ca ceva să ajungă pe server.

Un zip întreg (`.mrpack` inclus) poate, de asemenea, **crea un server**: în fila _Din modpack_ a vrăjitorului, încarcă-l și manifestul pachetului (sau un vot majoritar printre jar-urile identificate) completează loader-ul, versiunea Minecraft și build-ul loader-ului.
