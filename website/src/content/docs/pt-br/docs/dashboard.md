---
title: 'O painel'
description: 'O painel é sua base principal: cada servidor, seu status em tempo real e um feed contínuo do que tem acontecido.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Voltar ao índice da documentação](/docs/)

O painel é sua base: cada servidor, seu status em tempo real e um feed contínuo do que tem acontecido.

![Dashboard](/docs/images/dashboard.png)

## Os blocos de resumo

Na parte superior:

- **Servidores online**: quantos dos seus servidores estão rodando no momento, do total.
- **Jogadores conectados**: o número total de jogadores em todos os servidores em execução.
- **Atualizações disponíveis**: quantos servidores, pacotes ou mods têm uma versão mais nova ([veja Atualizações](/docs/updates/)).
- **Docker**: se o painel consegue alcançar o daemon do Docker e sua versão.

Uma segunda linha adiciona **Memória alocada** (e quanto está em uso), **Armazenamento usado** em todas as pastas de dados dos servidores, **Saúde · 24h** (travamentos, paradas por falta de memória e reinícios automáticos no último dia) e **Atualizações** divididas entre atualizações de mods e de nível de servidor. Abaixo deles, **Servidores por Status** conta seus servidores em cada estado, e o **Visão Geral de Recursos** mostra a participação de cada servidor em memória e CPU.

## Cartões de servidor

Cada servidor aparece como um cartão com seu status (Rodando, Iniciando, Parado, Travado e estados intermediários como Não Saudável ou Travado), o tipo e a versão do Minecraft, sua porta de jogo e suas tags. Cada cartão mostra o uso de **jogadores** e **disco** em relação à cota; servidores em execução também mostram **CPU** e **memória** em tempo real, atualizados continuamente.

Clique em um cartão para abrir aquele servidor. O cartão vazio **Criar um Servidor** e o botão **Criar um Servidor** na barra superior iniciam o [assistente de criação](/docs/servers/).

Você pode pesquisar seus servidores (por nome, tipo, versão ou tag), ordená-los por status, nome, tamanho, último início ou criação, e alternar entre layouts de grade e lista com o seletor à direita.

## Atividade recente

O feed na parte inferior mostra as entradas mais recentes do registro de auditoria legível do painel: logins, backups, exportações de blueprints, verificações de atualização, alterações de comandos de chat, inícios e paradas de servidores, e mais. Cada entrada é marcada com o servidor ao qual pertence (ou o próprio painel) e há quanto tempo aconteceu. **Ver Todos** abre o histórico completo na página [Atividade](/docs/activity/).
