---
title: 'Záznam aktivit'
description: 'Stránka Aktivita je kompletní auditní záznam: prohledávatelný, chronologický záznam všeho, co se v panelu stalo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Aktivita** je kompletní auditní záznam: prohledávatelný, chronologický záznam všeho, co se na panelu stalo.

![Aktivita](/docs/images/activity.png)

## Co se zaznamenává

- **Autentizace** - přihlášení (včetně toho, zda bylo použito 2FA nebo záložní kód), a povolení, zakázání nebo resetování 2FA.
- **Životní cyklus serveru** - vytváření, spouštění, zastavování, restartování, pády a události nedostatku paměti.
- **Upozornění** - zaseknuté spouštění, chyby zastavení, selhané plány, zastavení kvůli kvótě, nezdravé kontejnery, offline po restartu.
- **Data** - vytvořené a obnovené zálohy, exportované šablony, instalace a aktualizace balíčků.
- **Konfigurace** - změny příkazů chatu, změny rolí a úpravy nastavení.

Každý záznam zaznamenává, kdo to provedl (uživatelské jméno nebo panel/plánovač pro automatizované akce), ke kterému serveru se vztahuje a kdy. [Dashboard](/docs/dashboard/) zobrazuje nejnovější záznamy; tato stránka je kompletní historie. Události životního cyklu a upozornění lze také předávat na Discord (viz [Integrace](/docs/integrations/)).

Protože zachycuje události relevantní pro zabezpečení (přihlášení, změny 2FA, změny rolí), je log aktivity také vaším prvním místem, kam se podívat, pokud něco s účtem nevypadá v pořádku.
