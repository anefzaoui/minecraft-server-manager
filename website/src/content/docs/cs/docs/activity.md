---
title: 'Záznam aktivit'
description: 'Stránka Aktivita je kompletní auditní záznam: prohledávatelný, chronologický záznam všeho, co se v panelu stalo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Zpět na index dokumentace](/docs/)

Stránka **Aktivita** je kompletní auditní záznam: prohledávatelný, chronologický záznam všeho, co se v panelu stalo. Filtrujte podle serveru nebo typu události, prohledávejte souhrny a exportujte filtrované záznamy jako CSV nebo JSON. Položky, které zachytily log (například pád), jej otevřou na místě.

![Aktivita](/docs/images/activity.png)

## Co se zaznamenává

- **Autentizace**: přihlášení (včetně použití 2FA nebo záložního kódu), uzamčení účtu, změny hesla a povolení, zakázání nebo resetování 2FA.
- **Životní cyklus serveru**: vytváření, spouštění, zastavování, restartování, pády, automatické restarty a události nedostatku paměti.
- **Upozornění**: zaseknuté spouštění, selhání zastavení, selhané plány, zastavení kvůli kvótě, nezdravé kontejnery, offline po restartu.
- **Data**: vytvořené a obnovené zálohy, exportované šablony, instalace a aktualizace balíčků, změny modů a světů a úpravy souborů.
- **Hráči**: vyhození, zákazy, změny whitelistu a operátorů a poznámky k hráčům.
- **Konfigurace**: změny příkazů v chatu, změny uživatelů a rolí, změny oprávnění pro konkrétní server, změny herních portů a úpravy nastavení.

Každá položka zaznamenává, kdo ji provedl (uživatelské jméno nebo panel/plánovač pro automatizované akce), ke kterému serveru se vztahuje a kdy. [Dashboard](/docs/dashboard/) zobrazuje nejnovější položky; tato stránka je kompletní historie. Operátoři a prohlížeči vidí pouze položky pro servery, které mohou zobrazit (plus celopanelové), a změny oprávnění pro konkrétní servery jsou zobrazeny pouze administrátorům. Události životního cyklu a upozornění lze také přesměrovat na Discord (viz [Integrace](/docs/integrations/)).

Protože zaznamenává události relevantní pro zabezpečení (přihlášení, změny 2FA, změny rolí a oprávnění), je log aktivity také vaším prvním místem, kam se podívat, pokud se s účtem něco nezdá.
