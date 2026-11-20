---
title: 'Convites e página de status'
description: 'Convide amigos para um servidor com o endereço, versão e um modpack de cliente, e compartilhe uma página de status pública que mostra apenas o que você escolher.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Voltar ao índice da documentação](/docs/)

Duas abas no grupo **Configurações** de um servidor ajudam os jogadores a encontrá-lo e a se conectar: **Convites** exibe tudo o que um amigo precisa para se conectar, e **Página de Status** publica uma pequena página pública que mostra se o servidor está online. Ambas exigem a permissão de **Configurações** do servidor ([usuários e funções](/docs/users-and-roles/#per-server-permissions)).

## Convites

**Configurações → Convites** tem um card **Convidar Amigos**:

- **Endereço para compartilhar** lista os endereços da máquina em sua rede local com a porta do jogo do servidor, seu endereço público quando o painel consegue detectá-lo (jogadores fora de sua rede só o alcançam através de encaminhamento de porta), e **Endereço personalizado…** para um domínio ou endereço que você configurou, como `play.example.com:25565`.
- **Texto do convite** é uma mensagem pronta para colar com o nome do servidor, o endereço que você escolheu, e sua versão e tipo de Minecraft. **Copiar Texto do Convite** o coloca na área de transferência. Quando a whitelist está ativa, o texto pede aos amigos o nome de usuário do Minecraft deles, e o card lembra você de adicionar cada amigo na aba **Jogadores** antes que eles entrem.
- **O que os amigos precisam** diz o que vai do lado do jogador: nada além da versão correta do Minecraft para um servidor vanilla ou com plugins (Paper e similares), ou os mods do servidor para um servidor modificado.

### O modpack do cliente

Em um servidor modificado, o card também oferece **Baixar Modpack do Cliente (.mrpack)**. Amigos o importam no Prism Launcher ou no Modrinth App, que instala a versão do Minecraft e o carregador de mods do servidor, baixa os mods e adiciona o servidor à lista multijogador deles com o endereço que você escolheu.

O arquivo é construído a partir dos mods que você adicionou ao servidor (o overlay de mods personalizados) que vêm do Modrinth. Mods de outros lugares são listados no card em vez disso, para que os amigos possam adicionar esses arquivos à pasta `mods` deles manualmente. Em um servidor criado a partir de um modpack, os amigos devem instalar esse pack, na versão que o servidor executa, em seu launcher; a aba **Visão Geral** mostra a versão.

### Jogando pela internet

**Jogando pela internet (encaminhamento de porta)** na parte inferior do card explica o lado do roteador: encaminhe a porta do jogo do servidor (TCP e UDP) para a máquina que executa o painel, então compartilhe seu endereço público com a porta. Se seu provedor de internet usa CGNAT, o encaminhamento de porta não pode funcionar, e um serviço de túnel (por exemplo, playit.gg) é a solução. O painel não abre portas do roteador por si só. Apenas as portas de jogo pertencem à internet; mantenha a porta do próprio painel e as portas RCON fechadas ([portas em um relance](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Página de Status

**Configurações → Página de Status** ativa uma página pública para um servidor, desativada por padrão:

1. Ative o card.
2. Escolha o **Endereço da Página**: a página fica em `/status/<endereço>` no seu painel, e o endereço é de 3 a 40 letras minúsculas, números ou hifens, único entre seus servidores.
3. Pressione **Salvar**. **Abrir Página** e **Copiar Link** então fornecem o link para compartilhar.

Qualquer pessoa com o link vê o nome do servidor, seu MOTD, versão, se está em execução, a contagem de jogadores e seu tempo de atividade, e nada mais. A página não tem link para o painel e não precisa de login. Ela lê o status em memória do painel, então os visitantes nunca causam trabalho no daemon Docker.

Desativar a página mantém seu endereço, então ativá-la novamente restaura o mesmo link. Para uma página ou um bot próprio, a [API pública](/docs/public-api/) retorna o mesmo tipo de status em JSON.

Relacionado: [Notificações do Discord](/docs/integrations/), [o mapa ao vivo](/docs/live-map/), [criando e gerenciando servidores](/docs/servers/).
