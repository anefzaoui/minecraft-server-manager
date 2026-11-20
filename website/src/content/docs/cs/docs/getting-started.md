---
title: 'Začínáme'
description: 'Nainstalujte Minecraft Server Manager a dokončete prvotní nastavení: kontrolu systému, vaši časovou zónu a účet správce.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Zpět na index dokumentace](/docs/)

## První nastavení

Při prvním otevření panelu vás provede krátký průvodce nastavením:

1.  **Kontrola systému** zajistí, že Docker je dostupný, Node.js je dostatečně nová verze a složka s daty je zapisovatelná. Pokud Docker ještě neběží, můžete pokračovat; vytváření a spouštění serverů počká, dokud se nespustí.
2.  **Vytvoření účtu správce**. Toto je jediný účet, který existuje, dokud nepřidáte další, a má plnou kontrolu. Zvolte uživatelské jméno (2 až 32 znaků) a heslo o minimální délce 8 znaků. Po vytvoření jste přihlášeni.
3.  **Konfigurace panelu** (volitelné): veřejná doména pro zobrazení hráčům v adresách pro připojení, API klíč CurseForge a vaše časové pásmo. Vše lze později změnit v **Nastavení**.

Poslední krok nabízí **Vytvořit server** nebo **Přejít na řídicí panel**.

![Krok kontroly systému při prvním nastavení](/docs/images/setup-system-check.png)

> **Veřejně dostupné instalace jsou chráněny PINem.** Pokud spustíte panel na adrese, která není smyčková (`PANEL_HOST` jiný než `127.0.0.1`), stránka nastavení také požaduje **6místný PIN**. Panel jej vypíše do své konzole při spuštění. Zadejte jej spolu s uživatelským jménem a heslem. Tím zabráníte cizí osobě, která se k portu dostane jako první, aby si nárokovala účet správce. PIN zmizí, jakmile účet správce existuje.

## Přihlášení

Po nastavení je panel chráněn přihlašovací obrazovkou. Pro pokračování zadejte své uživatelské jméno a heslo.

![Přihlášení](/docs/images/login.png)

Pokud je na vašem účtu povoleno [dvoufaktorové ověřování](/docs/two-factor-authentication/), budete po zadání hesla vyzváni k zadání 6místného kódu z vaší aplikace pro ověřování.

## Orientace

Vše vychází z levého postranního panelu:

- **Řídicí panel** – přehled všech serverů ([podrobnosti](/docs/dashboard/)).
- **Servery**, **Modpacky**, **Světové šablony**, **Blueprinty** – vytváření a správa serverů a jejich obsahu.
- **Aktualizace**, **Zálohy**, **Plány**, **Úložiště**, **Aktivita** – provozní strana: co je zastaralé, vaše snímky, automatizace, využití disku a protokol auditu.
- **Oprávnění** (v dolní části, pouze pro správce): co může každý uživatel dělat na každém serveru ([podrobnosti](/docs/users-and-roles/#per-server-permissions)).
- **Nastavení** (v dolní části, pouze pro správce): API klíče, konfigurace panelu, výchozí hodnoty pro nové servery, [uchovávání záloh](/docs/backups/#retention), uživatelé, zabezpečení přihlášení a veřejné API.

Pod nimi postranní panel uvádí vaše servery. Otevřením jednoho se zobrazí jeho vlastní karty: **Přehled**, **Konzole**, **Hráči**, **Mody**, **Svět**, **Zálohy**, **Monitorování** a **Nastavení**, většina s příslušnými podkartami (například **Nastavení → Konfigurace** obsahuje nastavení serveru a jeho herní port). Viz [Jeden server](/docs/servers/#a-single-server).

Horní lišta obsahuje tlačítko **Vytvořit server**, **přepínač motivu** (tmavý/světlý) a **nabídku účtu**, kde můžete změnit obrázek profilu, spravovat [dvoufaktorové ověřování](/docs/two-factor-authentication/) nebo se odhlásit.

## Na telefonu nebo tabletu

Každá stránka je navržena nejprve pro úzkou obrazovku a odtud se rozšiřuje: postranní panel se schová za tlačítko nabídky, datové tabulky se skládají do karet, panely nástrojů se zalomí a lišta ovládání světa se zhroutí do karty, kterou otevřete, když ji potřebujete. Tlačítka a čipy mají skutečnou velikost dotykové plochy. Nic není pouze pro stolní počítače.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Řídicí panel na telefonu" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Přehled serveru na telefonu" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konzole na telefonu" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Karta Mody na telefonu" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Kompatibilita verzí na telefonu" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Nastavení na telefonu" width="180">
</p>

## Co potřebujete

Panel komunikuje s Dockerem pro spouštění serverů, takže potřebuje přístup k démonu Dockeru (Docker Desktop nebo socket Docker Engine). Když je Docker dostupný, dlaždice Docker na řídicím panelu zobrazuje **Připojeno** a jeho verzi. Pokud není, panel stále běží. Servery však nemůžete spustit, dokud není démon spuštěn.

## Další kroky

- [Vytvořte svůj první server →](/docs/servers/)
- [Zabezpečte svůj účet pomocí 2FA →](/docs/two-factor-authentication/)
