---
title: 'Integrace'
description: 'Každý server má své integrace ve skupině Nastavení: Discord, veřejná stránka Stav, pozvánky na jedno kliknutí a volitelná záložka Chatbot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Zpět na obsah dokumentace](/docs/)

Každý server má své integrace ve skupině **Nastavení**: **Discord**, veřejná **Stránka stavu**, **Pozvánky** na jedno kliknutí a volitelná karta **Chatbot**. Tato stránka se věnuje Discordu (ostatní mají vlastní dokumentaci a průvodce nastavením v panelu).

## Oznámení na Discordu

Panel předává události serveru na kanál Discordu prostřednictvím webhooku. Žádný bot, žádné OAuth.

### Nastavení

1. Na Discordu: **Nastavení serveru → Integrace → Webhooky → Nový webhook**. Vyberte kanál a zkopírujte URL webhooku.
2. V panelu otevřete kartu serveru **Nastavení → Discord**, vložte URL do pole **URL webhooku**, zapněte kartu **zapnout** a **Uložit**. URL je uložena šifrovaně (ve stejném úložišti v klidu jako vaše API klíče).
3. Použijte **Odeslat test**, abyste potvrdili, že to funguje.

![Integrace Discordu](/docs/images/integrations-discord.png)

Chcete-li nahradit uloženou URL, vložte novou a uložte; ponechte pole prázdné, abyste zachovali aktuální. Uložená URL je zobrazena maskovaně (token je skrytý).

### Co se odesílá

Oznámení jsou seskupena do přepínatelných kategorií. Všechny jsou ve výchozím stavu zapnuté.

| Kategorie              | Události                                                              |
| ---------------------- | --------------------------------------------------------------------- |
| **Start / stop**       | Server se spustil, server se zastavil                                 |
| **Havárie**            | Detekována havárie, smyčka havárií, nový report o havárii             |
| **Zálohy**             | Záloha vytvořena, záloha obnovena                                     |
| **Aktualizace**        | Aktualizace aplikována, aktualizace vrácena zpět, aktualizace selhala |
| **Vyloučení / zákazy** | Hráč vyloučen, hráči zakázán                                          |
| **Upozornění**         | Věci, které tiše způsobí nefunkčnost serveru (viz níže)               |

### Kategorie Upozornění

`Upozornění` je kanál "něco potřebuje lidskou pozornost", pro podmínky, které byly dříve viditelné pouze v panelu:

| Událost                 | Význam                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `oom`                   | Kontejner byl zastaven kvůli vyčerpání paměti.                                                  |
| `unhealthy`             | Proces běží, ale kontrola `mc-health` selhává: živý, ale mrtvý server.                          |
| `startup-stalled`       | Stále se spouští po ~10 minutách bez "Hotovo" v logu (s diagnózou, co opravit, pokud je známa). |
| `stop-failed`           | Elegantní zastavení neproběhlo a kontejner stále běží.                                          |
| `schedule-failed`       | Naplánovaný restart / záloha / příkaz selhal.                                                   |
| `quota-exceeded`        | Přísný diskový kvóta byl překročen a server byl zastaven.                                       |
| `offline-after-restart` | Server byl před restartem panelu spuštěn, nyní není a nebude automaticky spuštěn.               |
| `crash-report`          | Nový report o havárii byl zachycen a zpracován.                                                 |
| `update-failed`         | Zabezpečený upgrade nebyl úspěšný.                                                              |

### Jak funguje doručování

Backgroundový most kontroluje [log událostí](/docs/activity/) každých 15 sekund a předává mapované řádky. Pokud POST požadavek na webhook dočasně selže, tento řádek je při pozdějších kontrolách znovu pokusně odeslán, místo aby byl ztracen; trvale nedostupný webhook je po několika pokusech ztlumen (jeden řádek logu za hodinu). Most nikdy znovu nepřehrává události z doby před spuštěním panelu.
