---
title: 'Criando e gerenciando servidores'
description: 'Crie, inicie, pare, reconstrua e configure servidores Minecraft no painel: o assistente de criação, configurações, memória e a porta do jogo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Voltar ao índice da documentação](/docs/)

## Criando um servidor

Clique em **Criar um Servidor** (barra superior) ou no card **Criar um Servidor** para abrir o assistente.

![Criar um servidor](/docs/images/create-wizard.png)

O assistente preenche a heap Java e a cota de disco dos **Padrões para novos servidores** na página Configurações, que um administrador pode alterar a qualquer momento. Um novo servidor também pega o limite de CPU de lá.

![Padrões para novos servidores](/docs/images/settings-defaults.png)

Você escolhe:

- Um **nome** (e uma descrição opcional, ícone e cor de destaque). Tags para organizar sua frota são adicionadas depois, nas configurações do servidor.
- Um **tipo de servidor**: Vanilla, Paper ou Purpur na aba **Vanilla**. Para um servidor modificado, a aba **De Mods** escolhe o loader (Fabric, Forge, NeoForge ou Quilt), a versão do Minecraft e uma build do loader (a mais recente ou uma específica), e então permite que você pesquise por mods.
- Uma **versão do Minecraft**: `LATEST`, um snapshot ou uma versão específica (betas e alphas incluídos).
- Uma **porta do jogo**: uma porta livre é sugerida. O console remoto (RCON) usa a porta 1000 a mais (por padrão). Você pode alterá-la depois (veja [Alterando a porta do jogo](#changing-the-game-port)).
- **Recursos**: a heap Java (o limite de memória do contêiner é definido 50% acima dela) e uma cota de disco.

**Opções Avançadas** abre todas as outras configurações que a imagem do servidor suporta, além de variáveis de ambiente extras e (para administradores) as configurações avançadas do Docker.

Prefere um modpack? A aba **De Modpack** instala um pack do CurseForge, Modrinth ou GT New Horizons em vez disso (veja [Modpacks](/docs/modpacks/)), ou pega um **zip customizado que você envia**: um `.mrpack` do Modrinth, um export de modpack do CurseForge (`manifest.json`), ou qualquer zip de jars de mods. O manifest (ou uma votação majoritária entre os jars identificados) preenche o loader e a versão do Minecraft, e cada mod é instalado em uma tarefa. Você também pode começar a partir de um [Blueprint](/docs/blueprints/) salvo na aba **De Blueprint**.

O painel escolhe um runtime Java sensato para sua versão automaticamente, baixa a imagem, cria o contêiner e o inicia, tudo a partir de um único formulário.

## A lista de servidores

A página **Servidores** lista toda a sua frota com status e estatísticas rápidas.

![Lista de servidores](/docs/images/servers-list.png)

## Um único servidor

![Jogadores](/docs/images/players.png)

Abrir um servidor te dá um espaço de trabalho com abas:

- **Visão Geral**: o endereço para compartilhar com os jogadores, a descrição, uso ao vivo e quem está online.
- **Console**: o stream de log ao vivo e a entrada de comandos, chat do jogo e [comandos de chat](/docs/console-and-chat/).
- **Jogadores**: a lista de jogadores, além de inventário e estatísticas.
- **Mods**: a lista de mods instalados, o [navegador de mods](/docs/modpacks/) e atualizações de conteúdo. Em um servidor modificado, sua sub-aba **Versões** verifica para quais versões futuras do Minecraft seus mods têm builds ([atualizações](/docs/updates/#minecraft-version-compatibility)).
- **Mundo**: [mundos, o mapa ao vivo e o gerenciador de arquivos](/docs/worlds-and-files/).
- **Backups**: [snapshots e restauração](/docs/backups/) para este servidor.
- **Monitoramento**: histórico por servidor e métricas ao vivo, incluindo relatórios de crash (veja abaixo).
- **Configurações**: **Configuração** (tudo sobre como o servidor roda), além das [integrações](/docs/integrations/) (Discord, Página de Status, Convites e, para administradores, Chatbot).

Os controles de iniciar, parar e reiniciar ficam no cabeçalho acima de cada aba. O que você pode fazer em cada aba depende das suas [permissões nesse servidor](/docs/users-and-roles/#per-server-permissions): por exemplo, a sub-aba **Arquivos** precisa da permissão de Arquivos, e enviar comandos de console precisa de Console.

![Visão geral do servidor](/docs/images/server-overview.png)

A barra **Controles do Mundo** acompanha em todas as abas: o relógio do jogo, o clima, as `gamerules` comuns como chips de alternância, e "Mostrar todas as regras do mundo" para as demais.

![Controles do mundo](/docs/images/world-controls.png)

**Monitoramento → Ao Vivo** mostra TPS e milissegundos por tick, um card de saúde e estabilidade com crashes (últimas 24h e 7d), mortes por falta de memória, e reinícios automáticos, e tamanhos por mundo.

![Monitoramento ao vivo](/docs/images/monitoring-live.png)

## Configurações do servidor

**Configurações → Configuração** é a superfície completa de configuração: nome, descrição, MOTD, ícone, cor e tags, recursos, a porta do jogo, política de atualização, iniciar ao boot do painel e reiniciar automaticamente em caso de crash, todas as variáveis de ambiente que a imagem do servidor suporta, as configurações avançadas do Docker, e exportação, clonagem, reconstrução e exclusão de blueprints. Mudanças que só têm efeito após a reconstrução do servidor são salvas imediatamente e aguardam: um botão **Aplicar Mudanças** aparece no cabeçalho do servidor, e elas também são aplicadas na próxima vez que o servidor iniciar.

**Reiniciar automaticamente em caso de crash** inicia um servidor que travou novamente, esperando mais tempo entre cada tentativa (5, 10, depois 20 segundos) e parando após 3 tentativas em 10 minutos. Ele ignora crashes que o painel reconhece como um problema de configuração (o EULA, o Java errado, um mundo de uma versão mais nova, uma porta em uso, falta de memória, uma chave do CurseForge ausente), pois esses precisam de um conserto primeiro. Se outra ação estiver ocupada com o servidor (um backup, uma restauração, uma mudança de porta), ele espera por até 30 minutos e desiste assim que alguém para ou inicia o servidor por conta própria.

Mudanças diretas de configuração sempre persistem entre reinícios. Uma mudança de PvP ou dificuldade feita com a barra **Controles do Mundo**, um toggle de whitelist na aba **Jogadores**, ou uma edição de `server.properties` no editor **Arquivos** remove a variável de ambiente correspondente (se uma foi definida) e marca o servidor para ser reconstruído, para que o valor no disco prevaleça em vez de ser reafirmado pela imagem do contêiner na próxima inicialização.

![Configurações do servidor](/docs/images/server-settings.png)

**Sobre o medidor de memória.** "RAM (heap Java)" é entregue ao Java como seu limite inicial e máximo de heap, e o Java preenche uma heap que lhe foi dada antecipadamente no primeiro minuto, com ou sem os presets de flag Aikar / MeowIce. Assim, o medidor de memória se estabiliza em cerca de metade do tamanho da heap e permanece lá mesmo quando ninguém está jogando; o traço no medidor marca onde a heap se situa sob o limite do contêiner, e a nota abaixo diz isso. Se você preferir ver a memória seguir o uso real, dê ao servidor uma heap inicial menor com **Heap inicial** no card Recursos em **Configurações → Configuração** (ou em **Opções Avançadas** no assistente), por exemplo, 512 MB: em uma heap de 2 GB isso reduziu o uso ocioso de 2,6 GB para cerca de 1,3 GB em nossas medições. O Java também precisa de memória fora da heap (cerca de 0,5 GB no vanilla, 1,5 a 2 GB em um modpack grande), que é para onde o espaço livre do limite do contêiner serve. Veja o README "Dois limites de memória" para os números.

> As **Configurações Avançadas do Docker** (nome do contêiner, rede Docker, mapeamentos de porta extras e binds de volume extras) são **apenas para administradores**, pois um bind mount mais o acesso Docker do painel é efetivamente root no host. Veja [Usuários e papéis](/docs/users-and-roles/).

### Alterando a porta do jogo

O card **Porta do Jogo** em **Configurações → Configuração** move um servidor para outra porta a qualquer momento, com seu próprio botão **Salvar Porta**. **Usar Próxima Porta Livre** escolhe a menor porta livre, e o card verifica qualquer porta que você insira antes de salvá-la. RCON sempre segue 1000 acima da porta do jogo (o deslocamento padrão). Administradores podem escolher qualquer porta de 1024 para cima; todos os outros escolhem a partir da primeira porta do jogo (25565 por padrão) para cima. Salvar aplica a mudança imediatamente: um servidor parado apenas se move, e um em execução pergunta primeiro, depois reinicia na nova porta (o mundo é salvo primeiro, e os jogadores se reconectam na nova porta). Se o servidor não puder iniciar na nova porta, ele volta para a antiga. A mudança é recusada enquanto outras mudanças aguardam **Aplicar Mudanças**, então aplique essas primeiro. Alterar a porta requer a permissão de Configurações nesse servidor.

![O card Porta do Jogo](/docs/images/server-port.png)

![O prompt antes de um servidor em execução reiniciar em sua nova porta](/docs/images/port-restart.png)

## Relatórios de crash e análise mclo.gs

Relatórios de crash (`crash-reports/*.txt` e arquivos JVM `hs_err_pid*.log`) são capturados automaticamente, analisados em um resumo de uma linha com a exceção e mods suspeitos, e listados em **Monitoramento → Histórico**:

![Card de relatório de crash](/docs/images/crash-mclogs-card.png)

Cada card de relatório oferece um visualizador embutido (com seções colapsáveis e exceções destacadas), copiar stack trace e download, além de duas ações [mclo.gs](https://mclo.gs):

- **Compartilhar para mclo.gs** publica o relatório como um paste público e copia o link: a coisa exata que autores de mods e Discords de suporte pedem. O link é lembrado no relatório, então nada é enviado duas vezes.
- **Analisar** executa as percepções automatizadas do mclo.gs sobre o paste: problemas conhecidos com correções sugeridas (dependências ausentes, incompatibilidades de versão, conflitos comuns de mods), renderizados diretamente no painel.

![Percepções do mclo.gs](/docs/images/crash-insights.png)

Ambas as ações ficam atrás de uma confirmação explícita, pois um paste é público: relatórios de crash podem incluir nomes de jogadores e sua lista completa de mods. O painel nunca envia nada por conta própria.
