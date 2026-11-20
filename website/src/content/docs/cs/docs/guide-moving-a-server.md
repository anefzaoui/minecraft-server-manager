---
title: 'Přesun Minecraft serveru na jiný hosting'
description: 'Přesun světa je snadný. Přesun serveru, do kterého se hráči stále mohou přihlásit, s jejich inventáři, domovy a oprávněními beze změny, je ta část, která se obvykle pokazí.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Zpět na rejstřík dokumentace](/docs/)

Přesun světa je snadný. Přesun serveru, do kterého se hráči stále mohou přihlásit, s jejich inventáři, domovy a oprávněními beze změny, je ta část, která se pokazí. Níže uvedený postup minimalizuje výpadek na několik minut a zachovává možnost návratu, pokud nový stroj zklame.

## Nejprve si udělejte přehled

Zapište si tyto informace, než se čehokoli dotknete. Každý z nich již způsobil špatný konec migrace, když byl předpokládán, místo aby byl ověřen:

- **Verze a loader Minecraftu**, přesně. 1.20.1 NeoForge není 1.20.1 Forge.
- **Seznam modů nebo pluginů s verzemi.** Svět se bez modů, které ho vytvořily, nenačte.
- **Verze Javy**, která následuje verzi Minecraftu.
- **`level-name`** z `server.properties`. Složka světa se často nejmenuje `world`.
- **Online mode.** Pokud starý server běžel s `online-mode=false` a nový běží s `online-mode=true`, nebo naopak, každý hráč dostane jiné UUID a tím pádem zcela nový, prázdný inventář. Toto je nejbolestivější chyba na této stránce.
- **Cokoli žijícího mimo složku serveru**, jako například databáze MySQL používaná pluginem.

## Kopírujte, dokud běží, pak kopírujte znovu, dokud není zastaven

Trik pro krátký výpadek spočívá v tom, že se nejdříve provede pomalé kopírování.

1. **Se spuštěným serverem** zkopírujte celou složku serveru na nový stroj. Na velkém světě to může trvat hodinu; nikoho to neobtěžuje, protože nic neběží.
2. **Oznámte restart a poté server řádně zastavte.** Graceful stop zajistí, že hra uloží svět; zabití procesu to neudělá.
3. **Zkopírujte znovu.** Tentokrát se přesunou pouze změněné soubory, takže to trvá sekundy až minuty.
4. **Spusťte ho na novém stroji**, pokud možno na nepublikovaném portu, a sami se připojte. Zkontrolujte známou základnu, svůj inventář a zda se pluginy nebo mody načetly bez chyb.
5. **Poté** nasměrujte hráče na něj.

`rsync -a --delete` je obvyklý nástroj pro kroky 1 a 3. Zachovejte oprávnění a časová razítka: svět zkopírovaný pod nesprávným uživatelem je server, který se nespustí, a chyba to jasně neřekne.

## Zatím nemažte starý server

Starý stroj ponechte zastavený, ale neporušený, alespoň několik dní. Je to jediná skutečná možnost návratu. Nechte ho vypnutý, místo aby běžel, aby se nikdo náhodou nepřipojil k opuštěné kopii a nestavěl tam týden.

## Zajistěte, aby adresa přežila přesun

Pokud se hráči připojují na holou IP adresu, každý přesun nutí všechny hráče upravit jejich seznam serverů a někteří to nikdy neudělají.

Použijte název hostitele, který ovládáte a který směřuje na server. Přesun se pak stane změnou DNS a adresa v klientovi každého zůstane stejná. Den před přesunem snižte TTL (time-to-live) záznamu, aby se změna rychle rozšířila.

Pokud chcete, aby hráči zadávali holou doménu, zatímco server běží na nestandardním portu, záznam SRV to umožní. Je to stejný mechanismus, který komerční hostitelé používají k rozdávání `play.something.net`.

## Zkontrolujte nový stroj, než mu důvěřujete

Tři věci, které se liší mezi hostiteli a po přesunu způsobují problémy:

- **Firewall.** Váš herní port musí být otevřený, a pouze váš herní port. Nevystavujte administrační panel nebo mapu internetu jen proto, že fungovaly na localhost.
- **Rychlost jednoho jádra.** Minecraftu daleko více záleží na rychlosti jednoho jádra než na jejich počtu. Osm pomalých jader bude horší než dvě rychlá.
- **Disk.** Svět na rotujícím úložišti nebo silně sdíleném svazku bude při načítání chunků zadrhávat.

## Odchod od spravovaného panelu

Pokud přecházíte od hostitele, který vám poskytl ovládací panel místo stroje, najděte stahování nebo správce souborů a vezměte celou složku serveru, nikoli jen svět. Získejte samotné soubory pluginů a modů, nikoli seznam: verze jsou důležité a "nejnovější" je příští měsíc jiný soubor.

Zkontrolujte také, zda jsou vaše zálohy vaše. Záloha, která existuje pouze uvnitř panelu, který opouštíte, není záloha, kterou vlastníte.

## V Minecraft Server Manager

Celý panel je jedna složka. Jeho zkopírování na jiný stroj a spuštění panelu tam přenese každý server, svět, zálohu a nastavení s sebou, což z přesunu samotného panelu dělá kopii, nikoli migraci.

Pro jeden server namísto všech zachycuje blueprint jeho konfiguraci, sadu modů a připnutou verzi balíčku (a pokud ji zaškrtnete, aktivní svět) jako jediný `.mcserver.zip`, který lze importovat na jiný panel a znovu sestavit stejný server. Světy lze stahovat a instalovat samostatně, když cestuje pouze svět.

Pokud je herní port, který server používal, na novém stroji již obsazený, nebo chcete nejprve testovat na nepublikovaném portu, změňte ho v **Nastavení → Konfigurace**: karta **Herní port** má **Použít další volný port**, běžící server se před restartem na novém portu zeptá a pokud se tam nemůže spustit, vrátí se ke starému. Přepněte ho na veřejný port, až na něj nasměrujete hráče.

Související: [blueprints](/docs/blueprints/), [zálohy, které se skutečně obnoví](/docs/guide-backups/), [světy a soubory](/docs/worlds-and-files/).
