---
title: 'Zmenšení světa'
description: 'Časem se svět rozrůstá: každé místo, kde hráč kdy chodil, létal nebo'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Zpět na rejstřík dokumentace](/docs/)

Časem se svět rozrůstá: každé místo, kde hráč kdy chodil, létal nebo byl přenesen Ender perlou, zanechává na disku vygenerované chunky, i když se tam nikdo nikdy nevrátil. **Zmenšit svět** odstraní chunky, ve kterých nikdo téměř nestrávil čas, takže svět zabírá méně místa. Minecraft znovu vytvoří odstraněnou oblast ze seedu světa v okamžiku, kdy tam někdo znovu cestuje, takže je to bezpečné pro zemi, kterou nikdo nepoužívá, ale cokoli, co hráč _postavil_ na místě, kde se sotva zastavil, by také zmizelo, proto si nejprve udělejte zálohu (záloha je vrácení zpět).

## Co se počítá jako „zřídka navštívené“

Každý chunk zaznamenává, jak dlouho v něm hráči stáli (Minecraft tomu říká `InhabitedTime`). Zmenšit svět ve výchozím nastavení odstraní každý chunk s méně než **30 sekundami** celkového času stráveného hráči; dialogové okno pro zmenšení vám umožní změnit tento práh (1 sekunda až 1 hodina) a kolik chunků kolem spawnu zachovat (výchozí 8, `0` vypne ochranu spawnu).

Co je vždy zachováno:

- Oblast kolem **spawnu** světa (čteno z `level.dat`) v overworldu. Nether, End a vlastní dimenze nemají žádnou oblast spawnu.
- Jakýkoli chunk, jehož čas návštěvy se nepodařilo přečíst, například svět uložený s kompresním formátem, který panel nedokáže dekódovat (LZ4). Náhled a výsledek vám řeknou, kolik takových chunků bylo přeskočeno.

Jsou pokryty všechny dimenze světa: podřízené složky ve stylu Bukkitu (`world_nether`, `world_the_end`), stejně jako rozložení vanilla a Forge/Fabric (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Když je chunk odstraněn, jeho entity a body zájmu vesničanů jdou s ním, takže regenerovaný chunk nedědí zastaralé moby, důlní vozíky nebo pracovní místa.

## Provedení z karty Světy

1. Udělejte si zálohu z karty **Zálohy**. Zmenšení ze karty Světy za vás zálohu neprovede.
2. Otevřete **Svět → Světy**, najděte svět a klikněte na ikonu zmenšení.
3. Klikněte na **Náhled**, abyste viděli, kolik chunků (a kolik megabajtů) by bylo přibližně odstraněno. Zatím se nic nemění; náhled funguje, i když server běží.
4. Klikněte na **Zmenšit svět**. Zmenšení přímo upravuje soubory světa, takže server musí být zastaven: buď jej zastavte nejprve, nebo zaškrtněte možnost jej zastavit, zmenšit a znovu spustit najednou (server se znovu spustí, i když zmenšení selže). Průběh se zobrazuje v oznamovací oblasti.

![Zmenšit svět](/docs/images/world-shrink.png)

## Provedení jako součást zálohy

Na kartě **Zálohy** zaškrtněte **„Po zálohování také zmenšit svět“** před **Zálohovat nyní**. Archiv zálohy se zapíše jako první (tento archiv je vaše vrácení zpět), poté se svět zmenší, ale pouze pokud je server zastaven. Pokud server běží, záloha stále probíhá a zmenšení je přeskočeno s poznámkou.

Plánované zálohy mají stejnou možnost: v editoru plánu vyberte úlohu **Záloha** a zaškrtněte **„Zmenšit svět po každé záloze“**. Spárujte ji s plánem **Zastavit server** o několik minut dříve, pokud chcete, aby běžela bez dozoru.
