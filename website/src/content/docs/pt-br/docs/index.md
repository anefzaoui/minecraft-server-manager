---
title: 'Documentação'
description: 'Um painel de controle completo e auto-hospedado para itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Um painel de controle completo e auto-hospedado para [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Crie, execute e gerencie servidores Minecraft do seu navegador. Sem linha de comando, sem edição manual de YAML.

![Dashboard](/docs/images/dashboard.png)

## Comece aqui

- **[Primeiros passos](/docs/getting-started/)** - configuração inicial, login e como se familiarizar com o painel.
- **[O painel](/docs/dashboard/)** - a visão geral de todos os servidores, jogadores e atividades.

## Executando servidores

- **[Criando e gerenciando servidores](/docs/servers/)** - o assistente de criação, tipos de servidor, versões e configurações por servidor.
- **[Console e comandos de chat](/docs/console-and-chat/)** - o console ao vivo e comandos de chat personalizados no jogo que rodam como o jogador.
- **[Modpacks](/docs/modpacks/)** - instale pacotes CurseForge, Modrinth, FTB e GT New Horizons, sempre fixados em uma versão exata.
- **[Mundos e arquivos](/docs/worlds-and-files/)** - troque mundos, gerencie mods e edite arquivos diretamente no navegador.
- **[Reduzindo o tamanho de um mundo](/docs/world-shrink/)** - recupere espaço em disco removendo chunks que ninguém visita, por conta própria ou como parte de um backup.
- **[Mapa ao vivo](/docs/live-map/)** - um mapa 3D BlueMap do mundo com um clique, protegido pelo login do painel.
- **[Convites e página de status](/docs/invites-and-status-page/)** - o endereço, texto do convite e modpack do cliente para amigos, e uma página de status pública.

## Dados e automação

- **[Chatbot por servidor](/docs/chatbot/)** - conversação local/compatível com OpenAI, alcance, transcrições retidas e poderes de jogabilidade restritos.
- **[Backups](/docs/backups/)** - snapshots com um clique, backups agendados, quantos manter (para todo o painel ou por servidor) e restauração.
- **[Blueprints](/docs/blueprints/)** - capture a configuração inteira de um servidor e crie novos a partir dela.
- **[Agendamentos](/docs/schedules/)** - reinicializações, backups e comandos baseados em cron.
- **[Armazenamento](/docs/storage/)** - uso de disco por servidor e cotas impostas pelo painel.
- **[Atualizações](/docs/updates/)** - acompanhe novas versões de servidor, pacotes, imagens e mods, verifique quais versões do Minecraft seus mods suportam e desfaça uma atualização de mod.
- **[Log de atividades](/docs/activity/)** - um rastro de auditoria de tudo o que aconteceu.
- **[Integrações](/docs/integrations/)** - notificações de webhook do Discord e a categoria de Alertas.
- **[API pública](/docs/public-api/)** - uma API HTTP somente leitura, autenticada por token, para buscar o status do servidor de fora do painel.

## Contas e segurança

- **[Usuários e funções](/docs/users-and-roles/)** - administrador, operador e visualizador, o que cada um pode fazer e permissões por servidor que os refinam.
- **[Autenticação de dois fatores](/docs/two-factor-authentication/)** - proteja seu login com um aplicativo autenticador.

## Guias

Não específicos deste painel: as perguntas que todo proprietário de servidor Minecraft encontra.

- **[Quanta RAM um servidor precisa?](/docs/guide-server-memory/)** - os dois números a definir e por que um servidor ocioso é lido como 12 GB.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - qual usar e a diferença de plugins/mods por trás da escolha.
- **[Seu servidor não inicia](/docs/guide-server-wont-start/)** - lendo o log e as poucas causas por trás da maioria das falhas.
- **[Backups que realmente restauram](/docs/guide-backups/)** - cópias consistentes, o que mais manter e testar uma antes que você precise dela.
- **[Movendo um servidor para outro host](/docs/guide-moving-a-server/)** - a ordem que mantém o tempo de inatividade baixo e os inventários intactos.

## Por baixo do capô

- **[Arquitetura](/docs/architecture/)** - como o painel é montado.
- **[O site](/docs/website/)** - como minecraft-server-manager.com é construído, traduzido e implantado a partir deste repositório.

---

> As capturas de tela nestes documentos são tiradas no tema escuro do painel. O painel inicia em modo escuro, a menos que seu sistema operacional prefira o claro; use o alternador de tema na barra superior para mudar.
