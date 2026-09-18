---
title: 'Plánované úlohy'
description: 'Stránka Plánované úlohy automatizuje opakující se úkoly pomocí cron výrazů.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Plány** automatizuje opakující se úlohy pomocí cron výrazů. Žádný externí cron, žádné skripty.

![Plány](/docs/images/schedules.png)

## Co můžete plánovat

- **Restartování** - noční restart pro udržení dlouho běžícího serveru v dobrém stavu.
- **Zálohy** - pravidelné snímky (označené `scheduled` na stránce [Zálohy](/docs/backups/)).
- **Příkazy** - spouštění libovolných příkazů serveru podle plánu.
- **Kontroly aktualizací** - periodické obnovování toho, co je zastaralé.

Každý plán cílí na konkrétní server (nebo na panel globálně), běží na vlastním cron výrazu a lze jej povolit nebo zakázat bez jeho smazání. Zobrazuje se čas posledního spuštění, takže si můžete potvrdit, že funguje.
