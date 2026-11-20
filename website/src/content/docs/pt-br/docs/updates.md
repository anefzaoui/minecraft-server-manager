---
title: 'Atualizações'
description: 'Acompanhe e aplique atualizações de versões do Minecraft, modpacks, mods e plugins em todos os servidores, com uma política por servidor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Voltar ao índice da documentação](/docs/)

A página **Atualizações** rastreia o que está desatualizado em toda a sua frota em um só lugar:

- Versões de **Modpack** ([modpacks](/docs/modpacks/)) em comparação com o índice de lançamento do Modrinth / CurseForge / GTNH.
- **Conteúdo personalizado** que você adicionou (mods, datapacks, resource packs, plugins), cada um em comparação com sua origem: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) ou GitHub Releases. As consultas ao GitHub usam revalidação ETag, então verificações diárias mal tocam em seu limite de taxa.
- Imagem do **Docker** desatualizada: ID da imagem de cada contêiner do servidor em comparação com uma tag recém-baixada (deduplicada entre servidores com a mesma tag), oferecida como uma atualização que requer apenas reconstrução.
- **Fixações de versão autônomas**: para um servidor sem um pack gerenciado, uma fixação explícita de `mc_version` em comparação com o manifesto da Mojang e uma variável de ambiente explícita de build do loader (`PAPER_BUILD`, `FORGE_VERSION` e similares) em comparação com o registro do loader. Builds do Paper vêm da **API Fill v3** atual do PaperMC (o endpoint legado v2 parou de receber novas versões do Minecraft). Em um servidor com mods, uma versão mais recente do Minecraft só é oferecida depois que uma [verificação de versão](#minecraft-version-compatibility) mostrou que todos os mods instalados têm uma build para ela. Um servidor Forge fixado é oferecido a build recomendada do Forge, nunca uma build mais antiga do que a que está fixada, e um servidor fixado a uma release nunca recebe uma pré-release (uma já em beta pode receber um beta mais novo ou a release). Aplicar um build do loader faz um backup pré-atualização primeiro. Mover um servidor Forge ou NeoForge para uma nova versão do Minecraft limpa seu número de build do loader fixado, pois um build é feito para uma versão do Minecraft; uma palavra-chave como `latest` é mantida, pois segue a versão por si só. Para escolher uma build específica você mesmo, veja [alterando a versão do mod loader](#changing-the-mod-loader-version).

![Atualizações](/docs/images/updates.png)

## Como funciona

O painel verifica as versões fixadas de cada servidor em relação à origem upstream e lista qualquer coisa com uma nova release. Uma contagem correspondente também aparece no bloco "Atualizações disponíveis" do [painel](/docs/dashboard/).

As verificações são executadas diariamente em um [agendamento](/docs/schedules/) padrão e sob demanda com **Verificar Tudo Agora**. **Ignorar** em uma linha para de oferecer aquela versão específica; uma mais nova será oferecida novamente. A **política** de atualização é por servidor: o painel deixa tudo manual (o padrão, que também mantém o servidor fora desta página), apenas notifica você, ou aplica as atualizações do pack por conta própria ([política de atualização](/docs/modpacks/#update-policy)).

## Compatibilidade de versão do Minecraft

Uma versão mais recente do Minecraft não é uma atualização se seus mods não puderem acompanhá-la. Cada servidor tem sua própria aba **Versões** (em Mods) que responde a essa pergunta:

- A versão que o servidor executa agora e a **versão mais alta para a qual todos os mods instalados têm uma build**.
- Uma linha colapsável por versão futura do Minecraft, com quantos mods estão prontos e quantos não têm nada publicado ainda. Abra uma linha para ver quais mods ficariam para trás e quais estão bem.

![Compatibilidade de versão](/docs/images/server-versions.png)

Pressione **Verificar Versões Futuras** para executá-lo. Nada é escaneado por conta própria: uma verificação lê cada jar na pasta de mods do servidor e pergunta ao Modrinth e CurseForge sobre cada um, então isso só acontece quando você pede. O progresso e os resultados parciais são escritos conforme ele avança, então fechar a página ou atualizar não perde nada, e uma verificação interrompida por uma reinicialização do painel informa e oferece para executar novamente. Tudo o que uma verificação interrompida já havia apurado é mantido, então executá-la novamente não refaz esse trabalho.

Um relatório descreve apenas o servidor para o qual foi feito. Altere a versão do Minecraft, o loader ou os próprios mods (adicione um, remova um, atualize um) e o relatório é marcado como desatualizado e para de ser usado, até que você execute a verificação novamente.

Os mods são identificados a partir da própria lista de arquivos do modpack, quando há uma, e de outra forma pelo conteúdo do arquivo, da mesma forma que um launcher reconhece um jar. Dois tipos de mod não podem ser respondidos e nenhum é adivinhado:

- **Não foi possível identificar**: um jar feito à mão ou uma build privada que nenhum registro reconhece.
- **Não foi possível verificar**: um mod do GitHub Releases, Hangar ou SpigotMC, ou um cujo projeto foi removido. Estes não publicam uma lista de para qual versão do Minecraft cada build se destina.

Enquanto qualquer um deles estiver instalado, o painel não oferecerá uma atualização de versão do Minecraft com um clique, porque não pode dizer honestamente o que quebraria. A aplicação de uma versão acima do que os mods suportam é recusada e nomeia os mods que a bloqueiam.

Mods que você **desabilitou** não participam: o servidor não os carrega, então desativar um mod é uma maneira real de contornar um bloqueador. Ligar ou desligar um mod marca o relatório para ser verificado novamente.

Isso cobre servidores que executam mods: Fabric, Forge, NeoForge e Quilt. Servidores de plugin estilo Paper mantêm o comportamento simples de última release e não têm aba Versões, porque dois dos registros de onde vêm os plugins não publicam nada que uma verificação possa ler.

![Uma versão aberta, mostrando quais mods ficariam para trás](/docs/images/server-versions-expanded.png)

Abrir uma versão lista os mods sem build para ela primeiro (aqueles que decidem a resposta) e mantém os prontos atrás de um clique. Grandes packs carregam uma página de mods por vez, então um servidor de 300 mods abre tão rápido quanto um de cinco mods.

## Alterando a versão do mod loader

A aba **Versões** também tem um cartão **Versão do Loader**. Ele mostra qual build do Forge, NeoForge, Fabric ou Quilt o servidor tem instalado e, onde pode ser alterado, um seletor para mudar para outro.

- **Um servidor Forge, NeoForge, Fabric ou Quilt** pode executar qualquer build publicada. O seletor lista as builds recentes para a versão do Minecraft do servidor, com as builds recomendada e mais recente do Forge rotuladas. **Outra Build…** aceita qualquer uma mais antiga pelo seu número, e **Padrão** volta a deixar o servidor escolher.
- **Um modpack Forge ou Fabric do CurseForge** instala a versão do loader que seu próprio manifesto declara, então a maneira usual de mudá-la é atualizar o pack. Quando o próprio pack lista a versão errada (um mod dentro dele pede um Forge mais novo do que o pack instala), o cartão pode substituí-lo, e **Versão do Modpack** remove a substituição novamente. Atualizar o pack também a remove, pois a nova versão declara seu próprio loader. Se a nova versão ainda listar a errada, defina a substituição novamente.
- **Um modpack NeoForge do CurseForge, ou um modpack Modrinth,** mostra seu loader, mas não pode ser substituído: a imagem do servidor só aplica a substituição a packs Forge e Fabric. Seu loader segue a versão do pack, então atualize o pack em vez disso. O loader de um pack FTB também não pode ser alterado aqui. Seu cartão geralmente não aparece, pois o próprio instalador da FTB mantém registros que o painel não lê.

O painel verifica se a build existe antes de perguntar qualquer coisa a você. Uma build Forge ou NeoForge é feita para uma versão do Minecraft, então em um servidor que segue a última release, fixar uma também mantém o servidor na versão do Minecraft que ele executa agora (a confirmação diz isso). Escolher **Padrão** depois remove a fixação, mas mantém essa versão do Minecraft. Um servidor que seguiu a última release também pode mudar para uma imagem Java diferente quando for reconstruído, a que essa versão precisa. Tal servidor que nunca iniciou é solicitado a iniciar uma vez primeiro, para que o painel saiba essa versão. Forge pula números de build (não há 47.4.14 entre 47.4.13 e 47.4.15), então um mod que "requer 47.4.14 ou acima" é satisfeito pela próxima build acima, e a recusa a nomeia. Uma mudança faz um backup pré-atualização, então reconstrói o servidor. A nova build é instalada na próxima vez que o servidor iniciar, e o cartão diz isso até então.

## Desfazendo uma atualização de mod

Cada build de um mod da qual ele foi atualizado permanece na biblioteca compartilhada, então uma atualização que quebra algo é reversível. A linha do mod na aba **Mods** ganha um botão **Reverter** que restaura a build anterior. Não há download, então funciona mesmo que o projeto tenha sido removido de seu registro desde então. A build da qual você reverteu para de ser oferecida até que uma mais nova apareça.

![Reverter um mod para a build da qual ele foi atualizado](/docs/images/mods-revert.png)

## Aplicando uma atualização

Atualizações nunca são silenciosas. Quando você escolhe atualizar um pack (ou [mudar para outra versão](/docs/modpacks/#changing-the-pack-version), incluindo as mais antigas), o painel:

1. Faz um **backup pré-atualização** (para que seja reversível; por padrão, os últimos 10 backups pré-atualização por servidor são mantidos, veja [retenção](/docs/backups/#retention)).
2. Repina a nova versão exata.
3. Reconstrói o servidor, resolvendo o runtime Java se necessário.
4. Monitora a primeira inicialização, com um orçamento de tempo por plataforma.

Se ele não iniciar corretamente, você reverte para o backup pré-atualização. Um servidor que segue releases estáveis nunca recebe um beta, e o link do changelog aponta para a diferença real por versão onde a origem a fornece. Uma atualização falha também dispara um [alerta](/docs/integrations/) no Discord se a integração estiver configurada.
