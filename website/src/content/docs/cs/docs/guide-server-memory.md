---
title: 'Kolik RAM potřebuje server pro Minecraft?'
description: 'Kolik RAM potřebuje server pro Minecraft pro vanilla, Paper, lehké mody a velké modpacky a kolik nechat pro stroj.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Zpět na index dokumentace](/docs/)

Krátká odpověď pro server, na kterém se bude skutečně hrát:

| Co spouštíte                               | Java heap  | Přidělte stroji |
| ------------------------------------------ | ---------- | --------------- |
| Vanilla nebo Paper, do 10 hráčů            | 2 GB       | 4 GB            |
| Paper s pluginy, 10 až 30 hráčů            | 4 GB       | 6 GB            |
| Lehký modpack, 40 až 80 modů               | 4 GB       | 6 GB            |
| Velký "kitchen-sink" pack, 150 až 300 modů | 6 až 8 GB  | 10 GB           |
| GregTech New Horizons a podobní "monstra"  | 8 až 12 GB | 16 GB           |

Dvě čísla, ne jedno. To je část, kterou většina průvodců vynechává, a je to důvod, proč lidé koupí 4 GB server, přidělí Jave 4 GB a pak sledují, jak umírá.

## Heap a stroj jsou různá čísla

Java heap (`-Xmx`) je množství paměti, které hra samotná může použít pro svět, entity a data modů. Stroj, neboli kontejner, musí pojmout tento heap **plus** vše ostatní, co Java potřebuje: metadata tříd, zásobníky vláken, účetnictví garbage collectoru, síťové buffery a samotnou JVM. Tento režijní náklad je zhruba 0,5 až 1,5 GB pro modovaný server.

Pokud se heap rovná paměti stroje, jádro zabije server v okamžiku, kdy se Java pokusí o tento režijní náklad. V Dockeru se to projeví jako ukončovací kód 137 a v logách jako nic: proces jednoduše zmizí uprostřed věty. Lidé obvykle obviňují mod.

Bezpečné pravidlo: **heap plus 25 procent a alespoň jeden volný gigabyte.** 8 GB heap vyžaduje 10 GB stroj.

## Více RAM neznamená vyšší výkon

Minecraft je ve většině svých činností vázán na jedno vlákno. Přidělení 16 GB pro 40modový pack nezrychlí generování chunků; prodlouží každou pauzu garbage collection, protože je toho víc k procházení. Server, který se zadrhává každých třicet sekund, je často server s příliš velkým heapem, ne s příliš malým.

Zvyšte heap, když vidíte toto, a ne jinak:

- `java.lang.OutOfMemoryError: Java heap space` v logu.
- Opakované "Can't keep up! Is the server overloaded?" s pauzami garbage collection v časování.
- Využití paměti, které stoupne ke stropu a zůstane tam přišpendlené hodiny.

## Proč váš server ukazuje 12 GB použitých, i když nikdo není online

Protože jste mu to řekli. Spiknou se dva výchozí stavy:

1. Běžný Docker image nastavuje počáteční heap rovný maximálnímu, takže `-Xms` a `-Xmx` jsou obě vaše číslo. Java si ho nárokuje předem, místo aby do něj rostla.
2. Populární sada Aikar flagů obsahuje `-XX:+AlwaysPreTouch`, která při startu projde každou stránku tohoto heapu, aby byly stránky skutečně alokovány. Je to záměrné: vyměňuje pomalejší start a vysoké číslo v klidu za méně pauz později.

Měřeno na Paper 1.21.1 s 2 GB heapem v 4 GB kontejneru, vzorkováno po dobu tří minut po dokončení načítání světa:

| Konfigurace                            | Rezidentní paměť |
| -------------------------------------- | ---------------- |
| Bez flagů                              | 2.60 GiB         |
| Aikar flagy                            | 2.59 GiB         |
| Aikar flagy bez `AlwaysPreTouch`       | 1.95 GiB         |
| Aikar flagy s 512 MB počátečním heapem | 1.38 GiB         |
| Bez flagů s 512 MB počátečním heapem   | 1.25 GiB         |

Takže server "používající" 12 GB v klidu je obvykle 12 GB heap, který byl předem dotknut, ne únik paměti. Vaše monitorování ho čte správně; číslo prostě neznamená to, co vypadá.

Pokud chcete poctivé číslo v klidu, nastavte počáteční heap nižší než maximální. Zaplatíte za to několika dalšími kolekcemi na začátku. Pokud dáváte přednost konstantním časům snímků, nechte to být a přestaňte sledovat graf.

## Hráči jsou méně důležití, než si myslíte

Zdvojnásobení z 10 na 20 hráčů stojí mnohem méně než přidání padesáti modů. Hráči většinou přidávají entity a načtené chunky, které se škálují mírně. Mody přidávají data tříd, registry, funkce generování světa a jejich vlastní cache, které ne. Velikost pro pack nejprve, pak přidejte zhruba 100 až 200 MB na běžného hráče na modovaném serveru.

Viditelnost (view distance) je další velká páka. Snížení z 12 na 8 chunků může ušetřit gigabyte na rušném serveru a je v hraní sotva znatelné.

## V Minecraft Server Manager

Každý server má dvě oddělená pole, **Java heap** a **limit paměti kontejneru**, přesně proto, že jsou to odlišné otázky. Průvodce vytvořením nastavuje limit kontejneru o 50 procent nad heapem za vás a panel odmítá uložit server, jehož limit kontejneru není nad jeho heapem, protože tato kombinace končí ukončovacím kódem 137 místo chybové zprávy.

Měřič paměti na serveru ukazuje, co kontejner skutečně používá, s poznámkou, když byl heap nárokován předem, takže předem dotknutý heap není čten jako nekontrolovaný. Server, který jádro zabilo kvůli paměti, je zaznamenán přesně takto v historii, místo jako záhadný pád.

Související: [vytváření a správa serverů](/docs/servers/),
[reporty o pádech](/docs/servers/#crash-reports--mclogs-analysis), [úložiště a kvóty](/docs/storage/).
