---
title: 'Consolă și comenzi de chat'
description: 'Tabul Consola transmite jurnalul serverului în timp real și oferă o casetă de comandă pentru a trimite orice comandă a serverului.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Înapoi la indexul documentației](/docs/)

## Consola live

Tabul **Consolă** transmite jurnalul serverului în timp real și oferă o casetă de comandă pentru a trimite orice comandă a serverului. Fără `docker exec`, fără SSH. Ieșirea revine inline, cu culori și tot.

![Consolă](/docs/images/server-console.png)

Consola este, de asemenea, locul unde panoul citește starea serverului: monitorizează jurnalul pentru a clasifica faza de pornire ("Loading mods", "Generating world", "Finishing startup") și apelează `list` pentru a urmări cine este online, astfel încât tabloul de bord și cardurile serverului să reflecte întotdeauna realitatea.

Acest sondaj deschide o conexiune RCON de scurtă durată la fiecare ciclu, pe care serverul o înregistrează ca o pereche `Thread RCON Client … started` / `shutting down` la fiecare ~20 de secunde și (pe serverele al căror nucleu sau plugin-uri o repetă) o linie `Rcon issued server command: …` pentru fiecare interogare doar pentru citire - `list` pentru numărul de jucători, plus citiri `time query …` și `gamerule <name>` în timp ce pagina World Controls este deschisă. Comutatorul **Hide RCON noise** de deasupra jurnalului filtrează acele linii (împreună cu liniile de pornire ale ascultătorului RCON). Este activat implicit și amintit per browser; dezactivați-l pentru a vedea fluxul brut.

Comenzile trimise de pe panou pot fi anunțate în joc sub o etichetă per server, astfel încât jucătorii să știe că un operator a acționat, mai degrabă decât o consolă misterioasă.

## Comenzi de chat

Comenzile de chat permit jucătorilor să declanșeze acțiuni ale panoului tastând o comandă prefix în chat-ul jocului, de exemplu `!spawn` pentru teleportare aleatorie. Detecția se bazează pe jurnal, iar execuția trece prin server, deci **nu sunt necesare moduri**.

![Comenzi de chat](/docs/images/chat-commands.png)

Fiecare comandă are:

- Un **declanșator** (de ex. `spawn`) și un **prefix** (`!` implicit).
- O **acțiune**: teleportare aleatorie, teleportare la o structură, teleportare la un biom sau executarea de comenzi brute de consolă.
- Un **nivel de permisiune**: toți, jucători pe lista albă sau doar operatori.
- Un **interval de reîmprospătare**, și mesaje personalizabile de așteptare / succes / eșec cu substituenți precum `{distance}`.

### O notă despre siguranță

Comenzile care pot distruge un server (`stop`, `op`, `ban`, `whitelist` și similare) sunt permise numai pe declanșatoare **doar pentru operatori**. Panoul verifică aceste comenzi chiar și atunci când sunt imbricate într-un lanț `execute … run …`, astfel încât un declanșator cu permisiuni scăzute să nu poată strecura o comandă periculoasă. Textul obișnuit din chat care menționează pur și simplu acele cuvinte (cum ar fi un mesaj `say`) este lăsat neatins.
