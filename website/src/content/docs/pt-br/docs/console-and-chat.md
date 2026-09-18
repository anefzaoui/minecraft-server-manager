---
title: 'Comandos do console e chat'
description: 'A aba Console exibe o log do servidor em tempo real e fornece uma caixa de comandos para enviar qualquer comando do servidor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Voltar ao índice de documentação](/docs/)

## O console ao vivo

A aba **Console** transmite o log do servidor em tempo real e oferece uma caixa de comandos para enviar qualquer comando do servidor. Sem `docker exec`, sem SSH. A saída retorna inline, com cores e tudo.

![Console](/docs/images/server-console.png)

O console é também onde o painel lê o estado do servidor: ele observa o log para classificar a fase de inicialização ("Carregando mods", "Gerando mundo", "Finalizando inicialização") e chama `list` para rastrear quem está online, para que o painel e os cartões do servidor sempre reflitam a realidade.

Essa verificação abre uma conexão RCON de curta duração a cada ciclo, que o servidor registra como um par `Thread RCON Client … started` / `shutting down` a cada ~20 segundos, e (em servidores cujo core ou plugins a ecoam) uma linha `Rcon issued server command: …` para cada leitura somente leitura - `list` para contagem de jogadores, mais leituras de `time query …` e `gamerule <name>` enquanto a página de Controles do Mundo está aberta. O seletor **Ocultar ruído RCON** acima do log filtra essas linhas (junto com as linhas de inicialização do listener RCON). Ele está ativado por padrão e é lembrado por navegador; desative-o para ver o fluxo bruto.

Comandos enviados do painel podem ser anunciados no jogo sob um rótulo por servidor, para que os jogadores saibam que um operador agiu em vez de um console misterioso.

## Comandos de chat

Comandos de chat permitem que os jogadores acionem ações do painel digitando um comando de prefixo no chat do jogo, por exemplo `!spawn` para teletransporte aleatório. A detecção é baseada em log e a execução passa pelo servidor, então **nenhum mod é necessário**.

![Comandos de chat](/docs/images/chat-commands.png)

Cada comando tem:

- Um **gatilho** (ex. `spawn`) e um **prefixo** (`!` por padrão).
- Uma **ação**: teletransporte aleatório, teletransporte para uma estrutura, teletransporte para um bioma ou execução de comandos brutos do console.
- Um **nível de permissão**: todos, jogadores na whitelist ou apenas operadores.
- Um **tempo de recarga** e mensagens personalizáveis de pendência / sucesso / falha com placeholders como `{distance}`.

### Uma nota sobre segurança

Comandos que podem destruir um servidor (`stop`, `op`, `ban`, `whitelist` e similares) só são permitidos em gatilhos **somente para operadores**. O painel verifica isso mesmo quando estão aninhados dentro de uma cadeia `execute … run …`, então um gatilho de baixa permissão não pode contrabandear um comando perigoso. Texto de chat comum que apenas menciona essas palavras (como uma mensagem `say`) é deixado em paz.
