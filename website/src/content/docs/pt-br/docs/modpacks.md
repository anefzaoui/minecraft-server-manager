---
title: 'Modpacks'
description: 'A página Modpacks (e a aba De modpack no assistente de criação) instala um modpack como um servidor, sempre fixado a uma versão exata do pacote para que uma reinicialização possa'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Voltar ao índice de documentação](/docs/)

A página **Modpacks** (e a aba **De modpack** no [assistente de criação](/docs/servers/)) instala um modpack como servidor, sempre **fixado a uma versão exata do pack**, para que uma reinicialização nunca possa atualizar o pack silenciosamente sem que você perceba.

![Modpacks](/docs/images/modpacks.png)

## Plataformas suportadas

- **CurseForge** - pesquise ou cole um URL do pack. Requer uma chave de API do CurseForge para pesquisa e packs privados (adicione-a em Configurações → Chaves de API).
- **Modrinth** - pesquise por nome.
- **FTB** - packs Feed The Beast.
- **GT New Horizons** - o pack expert 1.7.10, instalado a partir do próprio índice de lançamentos do GTNH. O GTNH escolhe seu runtime Java por versão do pack (2.8.0+ roda em **Java 25** via patches lwjgl3ify incluídos, versões mais antigas em Java 21 ou 17), e o assistente aumenta a RAM e o disco do servidor para mínimos sensatos para ele.
- **Zip personalizado** - não é um pack publicado: envie um **export de modpack do CurseForge** (o zip com `manifest.json` que o aplicativo do CurseForge produz para um conjunto de mods escolhido a dedo) ou **qualquer zip de arquivos .jar de mods**. O painel resolve o manifest em massa via API do CurseForge (ou identifica cada .jar por hash/impressão digital/metadados), pré-visualiza o que se encaixa e instala tudo em uma única tarefa - incluindo as configurações `overrides/` do pack se você optar por isso. Mods cujos autores não permitem downloads automatizados são listados com um link para o navegador e um slot de upload manual em vez de falhar a instalação.

## Como funciona a fixação

Quando você escolhe um pack, o painel resolve a versão exata, a registra e a instala. Na página **Atualizações**, você será informado quando uma versão mais nova estiver disponível; a atualização é uma ação deliberada e protegida com um backup pré-atualização e rollback. Servidores que rastreiam versões estáveis nunca recebem uma versão beta.

Servidores criados em versões muito antigas do painel (antes de 0.9.7) poderiam ficar _sem fixação_, significando que a imagem do contêiner instalaria silenciosamente a versão mais recente do pack a cada inicialização. O painel agora os repara na inicialização: ele fixa cada um à versão que está realmente instalada (lida dos próprios registros do painel ou do manifest de instalação da imagem, nunca um "latest" recém-resolvido) e registra um evento. Se não conseguir determinar o que está instalado, a página de Configurações do servidor exibe um aviso pedindo para você escolher a versão manualmente, e qualquer tentativa de salvar uma configuração de modpack sem fixação é rejeitada imediatamente.

## Política de atualização

Cada servidor tem uma política de atualização em **Configurações**, e todas as três opções significam o que dizem:

- **Apenas manual** - nada muda por conta própria, e o servidor é deixado de fora do selo de atualização e da página de Atualizações completamente. O modo "deixe-me em paz": ideal para um pack ajustado manualmente ou importado que você nunca quer que seja alterado.
- **Notifique-me** (padrão) - a verificação diária exibe atualizações disponíveis como um selo e na página de Atualizações; aplicá-las é sempre um clique seu.
- **Atualização automática** - após a verificação diária agendada, as atualizações **pendentes do pack** são aplicadas através do mesmo caminho protegido de uma atualização manual: backup pré-atualização, monitoramento de integridade e um rollback automático se a nova versão falhar ao iniciar. Atualizações que moveriam o servidor para uma versão diferente do Minecraft são sempre puladas com um evento em vez disso - converter um mundo permanentemente é uma decisão que o painel se recusa a tomar por você. Os botões manuais "verificar agora" apenas verificam; eles nunca acionam atualizações automáticas.

## Atualizando um pack

A partir de um servidor fixado, você pode atualizar para uma versão mais nova em uma única ação. O painel faz um backup primeiro, troca a versão fixada, recria o contêiner (resolvendo novamente o Java se a nova versão precisar de um runtime diferente) e monitora a primeira inicialização, com uma janela generosa para packs grandes como o GTNH que baixam alguns gigabytes e constroem um mundo com centenas de mods na primeira inicialização.
