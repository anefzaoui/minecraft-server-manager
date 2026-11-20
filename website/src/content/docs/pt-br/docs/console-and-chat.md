---
title: 'Comandos do console e chat'
description: 'A aba Console exibe o log do servidor em tempo real e fornece uma caixa de comandos para enviar qualquer comando do servidor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Voltar ao índice de documentação](/docs/)

## O console ao vivo

A aba **Console** transmite o log do servidor em tempo real e oferece uma caixa de comandos para enviar qualquer comando do servidor. Sem `docker exec`, sem SSH. A saída retorna em linha, com cores e tudo. Enviar comandos requer a permissão Console para aquele servidor; sem ela, você ainda pode assistir ao log.

Acima do log, você pode filtrar linhas por texto (ou por `/regex/`) e por nível (INFO, WARN, ERROR), e **Download** oferece a saída recente, o `latest.log` completo, ou todos os arquivos de log como um zip.

![Console](/docs/images/server-console.png)

O console é também onde o painel lê o estado do servidor: ele observa o log para classificar a fase de inicialização ("Carregando mods", "Gerando mundo", "Finalizando inicialização") e executa `list` para rastrear quem está online, para que o painel e os cartões do servidor sempre reflitam a realidade.

Essa verificação abre uma conexão RCON de curta duração a cada ciclo, que o servidor registra como um par `Thread RCON Client … started` / `shutting down` a cada ~20 segundos, e (em servidores cujo core ou plugins ecoam isso) uma linha `Rcon issued server command: …` para cada consulta somente leitura (`list` para contagem de jogadores, mais leituras de `time query …` e `gamerule <name>` enquanto os Controles do Mundo estão abertos). A opção **Ocultar Ruído do Console** acima do log filtra essas linhas (junto com as linhas de inicialização do listener RCON). Ela está ativada por padrão e é lembrada por navegador; desative-a para ver o fluxo bruto.

Comandos enviados do painel podem ser anunciados no jogo sob um rótulo por servidor (a caixa **Anunciar como…**), para que os jogadores saibam que um operador agiu em vez de um console misterioso.

## Chat

**Console → Chat** envia mensagens para o jogo enquanto o servidor está em execução: mensagens **Estilizadas** recebem cores e formatação e podem ir para todos ou para um jogador online, e **Simples** envia um broadcast simples `[Server]` para todos.

![Console → Chat](/docs/screenshots/04-chat.png)

## Comandos de chat

Comandos de chat (**Console → Comandos**) permitem que os jogadores acionem ações do painel digitando um comando de prefixo no chat do jogo, por exemplo `!spawn` para teletransporte aleatório. A detecção é baseada em log e a execução passa pelo servidor, então **nenhum mod é necessário**.

![Chat commands](/docs/images/chat-commands.png)

Cada comando tem:

- Um **gatilho** (ex: `spawn`), digitado após o **prefixo** do servidor (`!` por padrão, um ou dois caracteres, nunca `/`).
- Uma **ação**: teletransporte aleatório, teletransporte para uma estrutura, teletransporte para um bioma, ou execução de comandos brutos do console.
- Um **nível de permissão**: todos, jogadores na whitelist, ou apenas operadores.
- Um **cooldown** por jogador (30 segundos por padrão), e mensagens pendentes/de sucesso/falha personalizáveis com placeholders como `{distance}`.

### Uma nota sobre segurança

Comandos que podem destruir um servidor (`stop`, `op`, `ban`, `whitelist`, e similares) só são permitidos em gatilhos **apenas para operadores**. O painel verifica isso mesmo quando estão aninhados dentro de uma cadeia `execute … run …`, para que um gatilho de baixa permissão não possa contrabandear um comando perigoso. Texto de chat comum que apenas menciona essas palavras (como uma mensagem `say`) é deixado em paz.
