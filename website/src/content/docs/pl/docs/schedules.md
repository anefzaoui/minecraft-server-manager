---
title: 'Harmonogramy'
description: 'Strona Harmonogramy automatyzuje powtarzalne zadania za pomocą wyrażeń cron.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Harmonogramy** automatyzuje powtarzalne zadania za pomocą wyrażeń cron. Bez zewnętrznego crona, bez skryptów.

![Harmonogramy](/docs/images/schedules.png)

## Co można zaplanować

- **Restartuje** - nocny restart, aby utrzymać długo działający serwer w dobrej kondycji.
- **Kopie zapasowe** - regularne migawki (oznaczone jako `scheduled` na stronie [Kopie zapasowe](/docs/backups/)).
- **Polecenia** - uruchamiaj dowolne polecenie serwera według harmonogramu.
- **Sprawdzanie aktualizacji** - okresowo odświeżaj, co jest nieaktualne.

Każdy harmonogram jest skierowany do konkretnego serwera (lub panelu globalnie), działa na własnym wyrażeniu cron i może być włączony lub wyłączony bez usuwania. Pokazywany jest czas ostatniego uruchomienia, aby można było potwierdzić, że działa.
