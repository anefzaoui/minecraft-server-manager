---
title: 'Integrări'
description: 'Fiecare server își poartă integrările sub grupul Setări: Discord, o Pagină de Stare publică, Invitații cu un singur clic și fila opțională Chatbot (doar pentru administratori).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Înapoi la indexul documentației](/docs/)

Fiecare server își poartă integrările sub grupul **Setări**: **Discord**, o **Pagină de Stare** publică, **Invitații** cu un singur clic și fila opțională **Chatbot** (doar pentru administratori). Această pagină acoperă Discord; [invitații și pagina de stare](/docs/invites-and-status-page/) acoperă acele două, iar [chatbotul](/docs/chatbot/) are propria sa pagină.

## Notificări Discord

Panoul redirecționează evenimentele serverului către un canal Discord printr-un webhook. Fără bot, fără OAuth.

### Configurare

1. În Discord: **Setări server → Integrări → Webhooks → New Webhook**. Alege canalul și copiază URL-ul webhook-ului.
2. În panou, deschide fila **Setări → Discord** a serverului, lipește URL-ul în **Webhook URL**, activează cardul **on** și apasă **Save**. URL-ul este stocat criptat (în același depozit de stocare ca și cheile API).
3. Folosește **Send Test** pentru a confirma că funcționează.

![Integrare Discord](/docs/images/integrations-discord.png)

Pentru a înlocui un URL stocat, lipește unul nou și salvează; lasă câmpul gol pentru a păstra cel curent. URL-ul stocat este afișat mascat (tokenul este ascuns).

### Ce este trimis

Notificările sunt grupate în categorii comutabile. Toate sunt activate implicit.

| Categorie                   | Evenimente                                                     |
| --------------------------- | -------------------------------------------------------------- |
| **Start / stop**            | Server pornit, server oprit                                    |
| **Blocări**                 | Blocare, buclă de blocare detectată, raport nou de blocare     |
| **Backup-uri**              | Backup creat, backup restaurat                                 |
| **Actualizări**             | Actualizare aplicată, actualizare anulată, actualizare eșuată  |
| **Eliminări / interdicții** | Jucător eliminat, jucător interzis                             |
| **Alerte**                  | Lucrurile care lasă în tăcere un server stricat (vezi mai jos) |

### Categoria Alerte

`Alerte` este canalul "ceva necesită o intervenție umană", pentru condiții care anterior erau vizibile doar în panou:

| Eveniment               | Semnificație                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Containerul a fost oprit din cauza lipsei de memorie.                                                                               |
| `unhealthy`             | Procesul este activ, dar sonda `mc-health` eșuează: un server viu, dar mort.                                                        |
| `startup-stalled`       | Încă pornește după aproximativ 10 minute fără "Done" în loguri (cu un diagnostic despre ce să se repare, acolo unde este cunoscut). |
| `stop-failed`           | O oprire grațioasă nu a avut efect și containerul rulează în continuare.                                                            |
| `schedule-failed`       | O repornire / backup / comandă programată a eșuat.                                                                                  |
| `quota-exceeded`        | Cota de disc în modul strict a fost atinsă și serverul a fost oprit.                                                                |
| `offline-after-restart` | Serverul era activ înainte ca panoul să repornească, acum nu mai este și nu va fi repornit automat.                                 |
| `port-change-failed`    | Schimbarea portului a eșuat și serverul nu a putut fi readus la portul vechi, deci este oprit.                                      |
| `auto-restart-gave-up`  | Un server blocat nu a fost repornit deoarece o altă acțiune l-a ținut ocupat prea mult timp.                                        |

### Cum funcționează livrarea

O punte de fundal verifică [logul de activitate](/docs/activity/) la fiecare 15 secunde și redirecționează rândurile mapate. Dacă un POST webhook eșuează tranzitoriu, acel rând este reîncercat la verificări ulterioare în loc să fie omis; după câteva încercări eșuate, rândul este omis, iar eșecurile de livrare sunt înregistrate cel mult o dată pe oră per server. După o repornire a panoului, puntea trimite evenimentele pe care nu le-a livrat încă, dar niciodată mai mult de două ore în urmă; la prima sa rulare, începe de la cel mai recent eveniment.
