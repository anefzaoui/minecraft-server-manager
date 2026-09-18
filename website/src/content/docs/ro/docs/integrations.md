---
title: 'Integrări'
description: 'Fiecare server își poartă integrările sub grupul Setări: Discord, o Pagină de Stare publică, Invitații cu un singur clic și fila opțională Chatbot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Înapoi la indexul documentației](/docs/)

Fiecare server își poartă integrările sub grupul **Setări**: **Discord**, o **Pagină de Stare** publică, **Invitații** cu un singur clic și fila opțională **Chatbot**. Această pagină acoperă Discord (celelalte au propria documentație și ajutoare de configurare în panou).

## Notificări Discord

Panoul redirecționează evenimentele serverului către un canal Discord printr-un webhook. Fără bot, fără OAuth.

### Configurare

1. În Discord: **Setări server → Integrări → Webhooks → Noul Webhook**. Alegeți canalul și copiați URL-ul webhook-ului.
2. În panou, deschideți fila **Setări → Discord** a serverului, lipiți URL-ul în **URL Webhook**, activați cardul **pornit** și **Salvați**. URL-ul este stocat criptat (în același depozit la repaus ca și cheile API).
3. Utilizați **Trimite test** pentru a confirma că funcționează.

![Integrare Discord](/docs/images/integrations-discord.png)

Pentru a înlocui un URL stocat, lipiți unul nou și salvați; lăsați câmpul gol pentru a păstra cel curent. URL-ul stocat este afișat mascat (tokenul este ascuns).

### Ce este trimis

Notificările sunt grupate în categorii comutabile. Toate sunt activate implicit.

| Categorie                   | Evenimente                                                    |
| --------------------------- | ------------------------------------------------------------- |
| **Pornire / oprire**        | Server pornit, server oprit                                   |
| **Blocări**                 | Blocare, buclă de blocare detectată, raport nou de blocare    |
| **Backupuri**               | Backup creat, backup restaurat                                |
| **Actualizări**             | Actualizare aplicată, actualizare anulată, actualizare eșuată |
| **Eliminări / interdicții** | Jucător eliminat, jucător interzis                            |
| **Alerte**                  | Lucrurile care lasă un server defect (vezi mai jos)           |

### Categoria Alerte

`Alerte` este canalul „ceva necesită o intervenție umană”, pentru condiții care anterior erau vizibile doar în panou:

| Eveniment               | Semnificație                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Containerul a fost oprit din cauza lipsei de memorie.                                                                       |
| `unhealthy`             | Procesul este activ, dar sonda `mc-health` eșuează: un server viu, dar mort.                                                |
| `startup-stalled`       | Încă pornește după ~10 minute fără „Done” în loguri (cu un diagnostic despre ce să se remedieze, acolo unde este cunoscut). |
| `stop-failed`           | O oprire grațioasă nu a avut efect și containerul rulează în continuare.                                                    |
| `schedule-failed`       | O repornire / backup / comandă programată a eșuat.                                                                          |
| `quota-exceeded`        | Cota strictă de disc a fost depășită și serverul a fost oprit.                                                              |
| `offline-after-restart` | Serverul era activ înainte ca panoul să repornească, acum nu este și nu va fi pornit automat.                               |
| `crash-report`          | Un nou raport de blocare a fost capturat și analizat.                                                                       |
| `update-failed`         | O actualizare protejată nu a pornit corect.                                                                                 |

### Cum funcționează livrarea

O punte de fundal verifică [logul de evenimente](/docs/activity/) la fiecare 15 secunde și redirecționează rândurile mapate. Dacă o postare webhook eșuează tranzitoriu, acel rând este reîncercat la verificări ulterioare, în loc să fie pierdut; un webhook permanent indisponibil este dezactivat (o linie de log pe oră) după câteva încercări. Puntea nu redă niciodată evenimente de dinainte de pornirea panoului.
