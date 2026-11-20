---
title: 'Invitații și pagina de stare'
description: 'Invită prieteni pe un server cu adresa, versiunea și un modpack de client, și partajează o pagină de stare publică ce afișează doar ce alegi tu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Înapoi la indexul documentației](/docs/)

Două file sub grupul **Setări** al unui server ajută jucătorii să-l găsească și să se conecteze la el: **Invitații** scrie tot ce are nevoie un prieten pentru a se conecta, iar **Pagina de stare** publică o mică pagină publică ce arată dacă serverul este activ. Ambele necesită permisiunea **Setări** a serverului ([utilizatori și roluri](/docs/users-and-roles/#per-server-permissions)).

## Invitații

**Setări → Invitații** are un card **Invitați prieteni**:

- **Adresă de partajat** listează adresele mașinii din rețeaua locală cu portul de joc al serverului, adresa publică atunci când panoul o poate detecta (jucătorii din afara rețelei dvs. o accesează doar prin redirecționare de port) și **Adresă personalizată…** pentru un domeniu sau o adresă pe care ați configurat-o dvs., cum ar fi `play.example.com:25565`.
- **Text invitație** este un mesaj gata de copiat cu numele serverului, adresa aleasă și versiunea și tipul său de Minecraft. **Copiere text invitație** îl pune în clipboard. Când lista albă este activată, textul cere prietenilor numele lor de utilizator Minecraft, iar cardul vă reamintește să adăugați fiecare prieten în fila **Jucători** înainte ca aceștia să se conecteze.
- **Ce au nevoie prietenii** spune ce este necesar din partea jucătorului: nimic altceva decât versiunea corectă de Minecraft pentru un server vanilla sau cu pluginuri (Paper și similare), sau modurile serverului pentru unul modificat.

### Modpack-ul clientului

Pe un server modificat, cardul oferă și **Descărcare Modpack Client (.mrpack)**. Prietenii îl importă în Prism Launcher sau Modrinth App, care instalează versiunea de Minecraft și loader-ul de moduri al serverului, descarcă modurile și adaugă serverul în lista lor multiplayer cu adresa aleasă.

Fișierul este construit din modurile pe care le-ați adăugat dvs. serverului (suprapunerea de moduri personalizate) care provin de la Modrinth. Modurile din alte surse sunt listate în schimb pe card, astfel încât prietenii să poată adăuga acele fișiere în folderul lor `mods` manual. Pe un server creat dintr-un modpack, prietenii ar trebui să instaleze acel pachet, la versiunea pe care rulează serverul, în lansatorul lor; fila **Prezentare generală** arată versiunea.

### Joaca pe internet

**Joaca pe internet (redirecționare de port)** din partea de jos a cardului explică partea de router: redirecționați portul de joc al serverului (TCP și UDP) către mașina care rulează panoul, apoi partajați adresa publică cu portul. Dacă furnizorul dvs. de internet folosește CGNAT, redirecționarea de port nu poate funcționa, iar un serviciu de tunel (de exemplu, playit.gg) este soluția. Panoul nu deschide porturi de router de la sine. Doar porturile de joc aparțin internetului; păstrați portul propriu al panoului și porturile RCON închise ([porturi dintr-o privire](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Pagina de stare

**Setări → Pagina de stare** activează o pagină publică pentru un singur server, dezactivată implicit:

1. Activați cardul.
2. Alegeți **Adresa paginii**: pagina se găsește la `/status/<adresă>` pe panoul dvs., iar adresa este formată din 3 până la 40 de litere mici, cifre sau cratime, unică între serverele dvs.
3. Apăsați **Salvează**. **Deschide pagina** și **Copiază link** vă oferă apoi linkul de partajat.

Oricine are linkul vede numele serverului, MOTD-ul său, versiunea, dacă rulează, numărul de jucători și timpul de funcționare, și nimic altceva. Pagina nu are link către panou și nu necesită autentificare. Citește starea din memoria panoului, astfel încât vizitatorii să nu genereze niciodată activitate pe daemon-ul Docker.

Dezactivarea paginii îi păstrează adresa, astfel încât activarea ei din nou restaurează același link. Pentru o pagină sau un bot propriu, [API-ul public](/docs/public-api/) returnează același tip de stare ca JSON.

Legate de: [Notificări Discord](/docs/integrations/), [harta live](/docs/live-map/), [crearea și gestionarea serverelor](/docs/servers/).
