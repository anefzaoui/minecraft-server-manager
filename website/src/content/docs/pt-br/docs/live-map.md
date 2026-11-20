---
title: 'Mapa em tempo real'
description: 'Ative um mapa 3D em tempo real do mundo do servidor com BlueMap em um clique, servido apenas através do login do painel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Voltar ao índice da documentação](/docs/)

A aba **Mundo → Mapa** de um servidor exibe um mapa 3D interativo e amplizável do seu mundo, gerado pelo [BlueMap](https://bluemap.bluecolored.de/) (gratuito e de código aberto), com posições dos jogadores e todas as dimensões. O painel o instala, configura e o disponibiliza; você nunca precisa abrir uma porta ou editar um arquivo de configuração para ele.

## Ativando

1. Abra o servidor, então **Mundo → Mapa**.
2. Pressione **Ativar Mapa Vivo**. O painel instala a versão do BlueMap que corresponde ao loader e à versão do Minecraft do servidor a partir do Modrinth, aceita o download de recursos do BlueMap por você e escolhe uma porta livre para ele.
3. Reinicie o servidor (a alteração é aplicada na próxima inicialização, e o servidor é marcado como aguardando uma).

O BlueMap renderiza em segundo plano, então um novo mapa leva alguns minutos para desenhar seus primeiros blocos. Até lá, a aba informa que o mapa ainda não está pronto e verifica novamente sozinho. Quando estiver pronto, **Tela Cheia** abre o mapa em sua própria aba do navegador.

Funciona em servidores com um mod loader (Fabric, Quilt, Forge, NeoForge) e em servidores de plugins (Paper, Purpur e o restante da família Paper, Spigot), incluindo servidores de modpack. Servidores Vanilla não possuem uma versão do BlueMap, e a aba informa isso.

## Quem pode ver

O mapa é servido apenas através do painel, protegido por login: qualquer pessoa que possa visualizar o servidor no painel pode abrir seu mapa, e mais ninguém. A porta própria do BlueMap nunca deve ser aberta para a internet ([portas em um relance](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Ativar ou desativar o mapa requer a permissão **Configurações** do servidor ([usuários e funções](/docs/users-and-roles/#per-server-permissions)).

Quando o próprio painel é executado em Docker, ele acessa o BlueMap dentro do contêiner do servidor; o [README](https://github.com/anefzaoui/minecraft-server-manager#installation) explica os detalhes para configurações de proxy reverso.

## Desativando

**Desativar Mapa** remove o arquivo jar do BlueMap que o painel instalou e libera sua porta, novamente a partir da próxima reinicialização. O mundo em si não é tocado; os blocos de mapa renderizados permanecem na pasta do servidor até que você os exclua na aba **Arquivos**.

Relacionado: [mundos e arquivos](/docs/worlds-and-files/), [convites e página de status](/docs/invites-and-status-page/).
