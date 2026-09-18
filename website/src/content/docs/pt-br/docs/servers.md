---
title: 'Criando e gerenciando servidores'
description: 'Clique em Criar um Servidor (barra superior) ou no card Criar um servidor para abrir o assistente.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Voltar ao índice da documentação](/docs/)

## Criando um servidor

Clique em **Criar um Servidor** (barra superior) ou no card **Criar um servidor** para abrir o assistente.

![Criar um servidor](/docs/images/create-wizard.png)

O assistente preenche os campos de memória, CPU e cota de disco com os **Padrões para novos servidores** na página Configurações, que um administrador pode alterar a qualquer momento.

![Padrões para novos servidores](/docs/images/settings-defaults.png)

Você escolhe:

- Um **nome** (e ícone opcional, cor de destaque e tags para organizar sua frota).
- Um **tipo de servidor** - vanilla, Paper, Fabric, Forge, NeoForge e mais, cada um mapeado para a imagem itzg correta nos bastidores.
- Uma **versão do Minecraft** - `LATEST`, um snapshot ou uma versão específica.
- **Recursos** - RAM (heap), limite de memória do contêiner, CPU e uma cota de disco.

Prefere um modpack? A aba **Do modpack** instala um pack CurseForge, Modrinth, FTB ou GT New Horizons em vez disso (veja [Modpacks](/docs/modpacks/)), ou aceita um **zip personalizado que você envia**: uma exportação de modpack CurseForge (`manifest.json`) ou qualquer zip de arquivos jar de mods. O manifest (ou um voto majoritário entre os jars identificados) preenche o loader e a versão do Minecraft, e cada mod é instalado em uma única tarefa. Você também pode começar a partir de um [Blueprint](/docs/blueprints/) salvo.

O painel seleciona um runtime Java sensato para sua versão automaticamente, baixa a imagem, cria o contêiner e (opcionalmente) o inicia, tudo a partir de um único formulário.

## A lista de servidores

A página **Servidores** lista toda a sua frota com status e estatísticas rápidas.

![Lista de servidores](/docs/images/servers-list.png)

## Um único servidor

![Jogadores](/docs/images/players.png)

Abrir um servidor lhe dá um espaço de trabalho com abas:

- **Visão Geral** - status, estatísticas ao vivo, tempo de atividade e os controles primários de iniciar / parar / reiniciar.
- **Console** - o fluxo de log ao vivo e a entrada de comandos, além do chat do jogo ([detalhes](/docs/console-and-chat/)).
- **Jogadores** - quem está online, além de inventário, estatísticas e [comandos de chat](/docs/console-and-chat/).
- **Mods** - a lista de mods instalados, o [navegador de mods](/docs/modpacks/) e atualizações de conteúdo.
- **Mundo** - [mundos, o mapa ao vivo e o gerenciador de arquivos](/docs/worlds-and-files/).
- **Backups** - [snapshots e restauração](/docs/backups/) para este servidor.
- **Monitoramento** - histórico por servidor e métricas ao vivo, incluindo relatórios de falha (veja abaixo).
- **Configurações** - tudo sobre como o servidor é executado, além das [integrações](/docs/integrations/) (Discord, página de status, convites, chatbot).

![Visão geral do servidor](/docs/images/server-overview.png)

A barra **Controles do Mundo** acompanha em todas as abas: o relógio do jogo, o clima, as regras comuns do jogo como chips de alternância e "Mostrar todas as regras do mundo" para o restante.

![Controles do mundo](/docs/images/world-controls.png)

**Monitoramento → Ao Vivo** mostra TPS e milissegundos por tick, um card de saúde e estabilidade com os últimos 24h / 7d de falhas e reinícios, e tamanhos por mundo.

![Monitoramento ao vivo](/docs/images/monitoring-live.png)

## Configurações do servidor

A aba **Configurações** é a superfície completa de configuração: renomear, recursos, política de atualização, inicialização / reinício automático, variáveis de ambiente e substituições avançadas do Docker. Campos que alteram como o contêiner é executado são claramente marcados como necessitando de reinício.

![Configurações do servidor](/docs/images/server-settings.png)

**Sobre o medidor de memória.** "RAM (Java heap)" é passada para o Java como seu heap inicial e máximo, e o Java preenche um heap que lhe foi dado antecipadamente dentro do primeiro minuto, com ou sem os presets de flags Aikar / MeowIce. Assim, o medidor de memória se estabiliza em cerca de metade do tamanho do heap e permanece lá mesmo quando ninguém está jogando; o traço no medidor marca onde o heap se situa abaixo do limite do contêiner, e a nota abaixo dele diz isso. Se você preferir ver a memória seguir o uso real, defina um **Heap inicial** menor (avançado): em um heap de 2 GB isso reduziu o uso ocioso de 2,6 GB para cerca de 1,3 GB em nossas medições. O Java também precisa de memória fora do heap (cerca de 0,5 GB em vanilla, 1,5 a 2 GB em um modpack grande), que é para onde o espaço livre do limite do contêiner se destina. Veja "Dois limites de memória" no README para os números.

> Campos avançados de substituição do Docker (nome personalizado do contêiner, porta extra e montagens de bind, e substituições brutas) são **apenas para administradores**, pois uma montagem de bind mais o acesso Docker do painel é efetivamente root no host. Veja [Usuários e funções](/docs/users-and-roles/).

## Relatórios de falha e análise de mclo.gs

Relatórios de falha (`crash-reports/*.txt` e arquivos JVM `hs_err_pid*.log`) são capturados automaticamente, analisados em um resumo de uma linha com a exceção e os mods suspeitos, e listados em **Monitoramento → Histórico**:

![Card de relatório de falha](/docs/images/crash-mclogs-card.png)

Cada card de relatório oferece um visualizador integrado (com seções colapsáveis e exceções destacadas), cópia da stack trace e download, além de duas ações [mclo.gs](https://mclo.gs):

- **Compartilhar para mclo.gs** publica o relatório como um paste público e copia o link - a coisa exata que autores de mods e Discords de suporte pedem. O link é lembrado no relatório, então nada é enviado duas vezes.
- **Analisar** executa os insights automatizados do mclo.gs sobre o paste: problemas conhecidos com correções sugeridas (dependências ausentes, incompatibilidades de versão, conflitos comuns de mods), renderizados diretamente no painel.

![Insights do mclo.gs](/docs/images/crash-insights.png)

Ambas as ações ficam atrás de uma confirmação explícita, pois um paste é público: relatórios de falha podem incluir nomes de jogadores e sua lista completa de mods. O painel nunca envia nada por conta própria.
