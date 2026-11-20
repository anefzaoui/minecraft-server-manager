---
title: 'Modpacks'
description: 'Instale modpacks do CurseForge, Modrinth, FTB e GT New Horizons como servidores, sempre fixados em uma versão exata do pack.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Voltar ao índice de documentação](/docs/)

A página **Modpacks** (e a aba **De Modpack** no [assistente de criação](/docs/servers/)) instala um modpack como servidor, sempre **fixado a uma versão exata do pack** para que um reinício nunca possa atualizar o pack silenciosamente.

![Modpacks](/docs/images/modpacks.png)

## Plataformas suportadas

- **CurseForge**: busca por nome. Necessita de uma chave de API da CurseForge (adicione-a em **Configurações → Chaves de API**).
- **Modrinth**: busca por nome.
- **FTB**: Packs Feed The Beast, apenas via API (um ID numérico de pack mais um ID de versão explícito). O painel ainda não verifica atualizações para os packs FTB.
- **GT New Horizons**: o pack expert 1.7.10, instalado a partir do próprio índice de lançamentos do GTNH. O GTNH escolhe seu runtime Java por versão do pack (2.8.0+ roda em **Java 25** via patches lwjgl3ify incluídos, versões mais antigas em Java 21 ou 17), e o assistente aumenta a RAM e o disco do servidor para mínimos sensatos.
- **Zip personalizado**: nenhum pack publicado. Envie um **export de modpack da CurseForge** (o zip com `manifest.json` que o aplicativo da CurseForge produz para um conjunto de mods escolhido manualmente), um **`.mrpack` da Modrinth**, ou **qualquer zip de jars de mods**. O painel resolve o manifesto em massa (ou identifica cada jar por hash/impressão digital/metadados), pré-visualiza o que se encaixa e instala tudo em uma única tarefa, incluindo as configurações `overrides/` do pack se você optar por isso. Mods cujos autores não permitem downloads automatizados são listados com um link para o navegador e um slot de upload manual em vez de falhar a instalação.

## Como funciona o "pinning" (fixação)

Quando você escolhe um pack, o painel resolve a versão exata, a registra e a instala. Na página **Atualizações**, você será informado quando uma nova versão estiver disponível (a menos que a [política de atualização](#update-policy) do servidor seja **Apenas Manual**); a atualização é uma ação deliberada e protegida com um backup pré-atualização e rollback. Servidores que rastreiam versões estáveis nunca recebem uma versão beta. A aba **Versões** do próprio servidor responde à outra metade da pergunta: quais versões futuras do Minecraft os mods que ele realmente possui podem seguir ([atualizações](/docs/updates/#minecraft-version-compatibility)).

A versão do mod loader vem com o pack também: o servidor instala a build Forge, NeoForge ou Fabric que o pack declara. Se um pack Forge ou Fabric da CurseForge declara uma versão muito antiga para seus próprios mods, a aba **Versões** pode substituí-la até que o pack seja corrigido; uma atualização do pack remove a substituição, pois a nova versão declara a sua própria ([mudando a versão do mod loader](/docs/updates/#changing-the-mod-loader-version)).

Servidores criados em versões muito antigas do painel (antes de 0.9.7) poderiam ficar _sem fixação_, significando que a imagem do contêiner instalaria silenciosamente a versão mais recente do pack a cada inicialização. O painel agora os repara na inicialização: ele fixa cada um à versão que está realmente instalada (lida dos próprios registros do painel ou do manifesto de instalação da imagem, nunca um "latest" recém-resolvido) e registra um evento. Se não conseguir determinar o que está instalado, a página de Configurações do servidor exibe um aviso com um botão **Escolher uma Versão…** (packs CurseForge, Modrinth e GTNH) que abre o [seletor de versão](#changing-the-pack-version), e qualquer tentativa de salvar uma configuração de modpack sem fixação é rejeitada imediatamente.

## Política de atualização

Cada servidor tem um card **Política de Atualização** em sua aba **Configurações → Configuração**, e todas as três opções significam o que dizem:

- **Apenas Manual** (padrão): nada muda por conta própria, e o servidor é deixado completamente de fora do selo de atualização e da página de Atualizações. O modo "deixe-me em paz": ideal para um pack ajustado manualmente ou importado que você nunca quer que seja alterado. Não fixa a versão: [**Alterar Versão…**](#changing-the-pack-version) funciona sob todas as políticas. Para ser notificado sobre novas versões e aplicá-las com um clique, escolha **Notificar-me**.
- **Notificar-me**: a verificação diária exibe atualizações disponíveis como um selo e na página de Atualizações; aplicá-las é sempre um clique seu.
- **Atualização Automática**: após a verificação diária agendada, as atualizações de **pack** pendentes são aplicadas através do mesmo caminho protegido de uma atualização manual: backup pré-atualização, monitoramento de integridade e um rollback automático se a nova versão falhar ao iniciar. Atualizações que moveriam o servidor para uma versão diferente do Minecraft são sempre ignoradas com um evento em vez disso: converter um mundo permanentemente é uma decisão que o painel se recusa a tomar por você. Os botões manuais **Verificar Agora** apenas verificam; eles nunca acionam atualizações automáticas.

## Atualizando um pack

A partir de um servidor fixado, você pode atualizar para uma versão mais recente em uma única ação. O painel faz um backup primeiro, troca a versão fixada, reconstrói o servidor (resolvendo novamente o Java se a nova versão precisar de um runtime diferente) e monitora a primeira inicialização, com uma janela generosa para packs grandes como GTNH que baixam alguns gigabytes e constroem um mundo com centenas de mods na primeira inicialização.

## Alterando a versão do pack

Para executar uma versão específica, mais nova ou mais antiga, use **Alterar Versão…** no card do pack da aba **Visão Geral** do servidor. Na página **Modpacks**, abrir o card de um pack instalado oferece a mesma escolha: escolha uma versão no menu suspenso e clique em **Mudar para Esta Versão**. Ambos precisam da permissão **Conteúdo** do servidor, e ambos estão disponíveis para packs CurseForge, Modrinth e GTNH (packs FTB ainda não têm lista de versões). A lista mostra as 25 versões mais recentes para CurseForge e Modrinth, e todos os lançamentos do GTNH.

A troca passa pelo mesmo caminho protegido de uma atualização: um backup pré-atualização, a nova fixação, uma reconstrução e uma primeira inicialização monitorada, com um rollback de um clique se o servidor não iniciar corretamente. Seus mods personalizados são mantidos, assim como os mods do pack que você desabilitou, juntamente com as outras configurações de instalação do pack (mods forçados, arquivos a ignorar, projetos extras). Instalar um pack diferente reinicia essas configurações, pois elas só fazem sentido para o pack para o qual foram feitas.

Cada versão é listada com a versão do Minecraft que ela executa, comparada com a versão pela qual seu mundo foi salvo pela última vez:

- **Mesma versão do Minecraft**: muda após uma confirmação normal. Voltar para uma versão de pack mais antiga pode remover blocos e itens de mods que essa versão não possui, então o backup permanece na aba Backups de qualquer maneira.
- **Versão mais nova do Minecraft**: permitida após uma confirmação que avisa que o mundo é convertido permanentemente. O backup feito primeiro é a única maneira de voltar ao mundo antigo.
- **Versão mais antiga do Minecraft**: indisponível. O Minecraft não pode carregar um mundo em uma versão mais antiga do que a que o salvou pela última vez, então o painel recusa em vez de deixar um servidor que falha na inicialização.
