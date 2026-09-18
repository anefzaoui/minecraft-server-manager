---
title: 'O painel'
description: 'O painel é sua base principal: cada servidor, seu status em tempo real e um feed contínuo do que tem acontecido.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Voltar ao índice de docs](/docs/)

O painel é sua base: cada servidor, seu status em tempo real e um feed contínuo do que tem acontecido.

![Dashboard](/docs/images/dashboard.png)

## Os blocos de resumo

Na parte superior:

- **Servidores online** - quantos dos seus servidores estão rodando no momento.
- **Jogadores conectados** - o número total de jogadores em todos os servidores em execução.
- **Atualizações disponíveis** - quantos servidores, pacotes ou mods têm uma versão mais recente ([veja Atualizações](/docs/updates/)).
- **Docker** - se o painel consegue alcançar o daemon Docker e sua versão.

## Cartões de servidor

Cada servidor aparece como um cartão com seu status (Rodando, Iniciando, Parado, Travado), o tipo e a versão do Minecraft, e sua porta de jogo. Para servidores em execução, você também obtém o uso em tempo real de **jogadores**, **CPU**, **memória** e **disco**, atualizado continuamente.

Clique em um cartão para abrir aquele servidor. O cartão vazio **Criar um servidor** e o botão **Criar um Servidor** na barra superior iniciam o [assistente de criação](/docs/servers/).

Você pode pesquisar e ordenar seus servidores, e alternar entre os layouts de grade e lista com o seletor à direita.

## Atividade recente

O feed na parte inferior é um registro de auditoria em tempo real e legível por humanos: logins, backups, exportações de blueprint, verificações de atualização, alterações de comandos de chat, inícios e paradas de servidor, e mais. Cada entrada é marcada com o servidor ao qual pertence (ou o próprio painel) e há quanto tempo aconteceu. O histórico completo fica na página [Atividade](/docs/activity/).
