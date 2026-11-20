---
title: 'Integrace'
description: 'Každý server má své integrace ve skupině Nastavení: Discord, veřejná stránka Stav, pozvánky na jedno kliknutí a volitelná záložka Chatbot (pouze pro správce).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Zpět na přehled dokumentace](/docs/)

Každý server má své integrace ve skupině **Nastavení**: **Discord**, veřejná **Stránka stavu**, **Pozvánky** na jedno kliknutí a volitelná karta **Chatbot** (pouze pro administrátory). Tato stránka pokrývá Discord; [pozvánky a stránka stavu](/docs/invites-and-status-page/) pokrývají tyto dvě a [chatbot](/docs/chatbot/) má svou vlastní stránku.

## Oznámení na Discordu

Panel předává události serveru do kanálu na Discordu prostřednictvím webhooku. Žádný bot, žádné OAuth.

### Nastavení

1. Na Discordu: **Nastavení serveru → Integrace → Webhooky → Nový webhook**. Vyberte kanál a zkopírujte URL webhooku.
2. V panelu otevřete kartu serveru **Nastavení → Discord**, vložte URL do pole **URL webhooku**, zapněte kartu **zapnuto** a **Uložit**. URL je uložena šifrovaně (ve stejném úložišti v klidu jako vaše API klíče).
3. Použijte **Odeslat test** k potvrzení funkčnosti.

![Integrace Discordu](/docs/images/integrations-discord.png)

Pro nahrazení uložené URL vložte novou a uložte; pole nechte prázdné, abyste zachovali aktuální. Uložená URL je zobrazena maskovaně (token je skrytý).

### Co se odesílá

Oznámení jsou seskupena do přepínatelných kategorií. Všechny jsou ve výchozím nastavení zapnuté.

| Kategorie             | Události                                                              |
| --------------------- | --------------------------------------------------------------------- |
| **Start / stop**      | Server se spustil, server se zastavil                                 |
| **Havárie**           | Došlo k havárii, detekována smyčka havárií, nový report o havárii     |
| **Zálohy**            | Záloha vytvořena, záloha obnovena                                     |
| **Aktualizace**       | Aktualizace aplikována, aktualizace vrácena zpět, aktualizace selhala |
| **Vyhození / zákazy** | Hráč byl vyhozen, hráči byl udělen zákaz                              |
| **Upozornění**        | Věci, které tiše způsobí nefunkčnost serveru (viz níže)               |

### Kategorie Upozornění

`Upozornění` je kanál "něco potřebuje lidský zásah" pro podmínky, které byly dříve viditelné pouze v panelu:

| Událost                 | Význam                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `oom`                   | Kontejner byl zastaven kvůli nedostatku paměti.                                                         |
| `unhealthy`             | Proces běží, ale kontrola stavu `mc-health` selhává: server je spuštěný, ale nefunkční.                 |
| `startup-stalled`       | Server se stále spouští po ~10 minutách bez "Done" v logu (s diagnostikou, co opravit, pokud je známa). |
| `stop-failed`           | Graceful stop nebyl úspěšný a kontejner stále běží.                                                     |
| `schedule-failed`       | Naplánovaný restart / záloha / příkaz selhal.                                                           |
| `quota-exceeded`        | Byla překročena kvóta disku v přísném režimu a server byl zastaven.                                     |
| `offline-after-restart` | Server byl před restartem panelu spuštěn, nyní není a nebude automaticky spuštěn.                       |
| `port-change-failed`    | Změna portu selhala a server nemohl být vrácen na svůj starý port, takže je mimo provoz.                |
| `auto-restart-gave-up`  | Havarovaný server nebyl restartován, protože jiná akce jej příliš dlouho zaneprázdňovala.               |

### Jak funguje doručování

Background bridge kontroluje [log aktivity](/docs/activity/) každých 15 sekund a předává mapované řádky. Pokud POST požadavek na webhook dočasně selže, daný řádek je při pozdějších kontrolách znovu pokusně odeslán, místo aby byl ztracen; po několika neúspěšných pokusech je řádek přeskočen a selhání doručení jsou zaznamenána maximálně jednou za hodinu na server. Po restartu panelu bridge odešle události, které ještě nebyly doručeny, ale nikdy ne více než dvě hodiny zpětně; při svém úplně prvním spuštění začíná od nejnovější události.
