---
title: 'Začínáme'
description: 'Při prvním otevření panelu vás vyzve k vytvoření účtu správce.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Zpět na rejstřík dokumentace](/docs/)

## První nastavení

Při prvním spuštění panelu vás vyzve k vytvoření účtu správce. Toto je jediný účet, který existuje, dokud nepřidáte další, a má plnou kontrolu.

Vyberte si uživatelské jméno a heslo o délce alespoň 8 znaků. To je vše: jste přihlášeni a přesměrováni přímo na řídicí panel.

> **Zpřístupněné instalace jsou chráněny PINem.** Pokud spustíte panel připojený k adrese, která není smyčková (`PANEL_HOST` jiný než `127.0.0.1`), stránka nastavení také požádá o **6místný PIN**. Panel jej při spuštění vypíše do své konzole. Zadejte jej spolu s uživatelským jménem a heslem. Tím zabráníte cizí osobě, která se k portu dostane jako první, aby si nárokovala účet správce. PIN zmizí, jakmile účet správce existuje.

## Přihlášení

Po nastavení je panel chráněn přihlašovací obrazovkou. Pro pokračování zadejte své uživatelské jméno a heslo.

![Přihlášení](/docs/images/login.png)

Pokud je na vašem účtu povoleno [dvoufaktorové ověřování](/docs/two-factor-authentication/), budete po zadání hesla vyzváni k zadání 6místného kódu z vaší ověřovací aplikace.

## Orientace

Vše je přístupné z levého postranního panelu:

- **Řídicí panel** – přehled všech serverů ([podrobnosti](/docs/dashboard/)).
- **Servery**, **Modpacky**, **Svety**, **Šablony** – vytváření a správa serverů a jejich obsahu.
- **Aktualizace**, **Zálohy**, **Plány**, **Úložiště**, **Aktivita** – provozní strana: co je zastaralé, vaše snímky, automatizace, využití disku a protokol auditu.
- **Nastavení** (dole): uživatelé, API klíče a konfigurace panelu.

Horní lišta obsahuje tlačítko **Vytvořit server**, **přepínač motivu** (tmavý/světlý) a **menu účtu**, kde můžete spravovat [dvoufaktorové ověřování](/docs/two-factor-authentication/) nebo se odhlásit.

## Na telefonu nebo tabletu

Každá stránka je navržena nejprve pro úzkou obrazovku a odtud se rozšiřuje: postranní panel se schová za tlačítko nabídky, datové tabulky se skládají do karet, panely nástrojů se zalomí a lišta ovládání světa se zhroutí do karty, kterou otevřete, když ji potřebujete. Tlačítka a čipy mají skutečnou velikost dotykové plochy. Nic není pouze pro stolní počítače.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Řídicí panel na telefonu" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Přehled serveru na telefonu" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konzole na telefonu" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Karta Modifikace na telefonu" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Nastavení na telefonu" width="180">
</p>

## Co potřebujete

Panel komunikuje s Dockerem pro spouštění serverů, takže potřebuje přístup k démonu Dockeru (Docker Desktop nebo socket Docker Engine). Když je Docker dostupný, dlaždice Docker na řídicím panelu zobrazuje **Připojeno** a jeho verzi. Pokud není, panel stále běží. Servery nemůžete spustit, dokud není démon spuštěn.

## Další kroky

- [Vytvořte svůj první server →](/docs/servers/)
- [Zabezpečte svůj účet pomocí 2FA →](/docs/two-factor-authentication/)
