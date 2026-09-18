---
title: 'Atualizações'
description: 'A página de Atualizações rastreia o que está desatualizado em toda a sua frota em um só lugar:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Voltar ao índice de docs](/docs/)

A página **Atualizações** rastreia o que está desatualizado em toda a sua frota em um só lugar:

- Versões de **Modpack** ([modpacks](/docs/modpacks/)) contra Modrinth / CurseForge / o índice de lançamentos do GTNH.
- **Conteúdo personalizado** que você adicionou - mods, datapacks, resource packs, plugins - cada um contra sua origem: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) ou GitHub Releases. As consultas ao GitHub usam revalidação ETag, então verificações diárias mal tocam em seu limite de taxa.
- Imagem do **Docker** desatualizada: ID da imagem de cada contêiner em execução contra uma tag recém-puxada (deduplicada entre servidores com a mesma tag), oferecida como uma atualização apenas para recriação.
- **Fixações de versão autônomas**: para um servidor sem um pack gerenciado, uma fixação explícita de `mc_version` contra o manifesto do Mojang e uma variável de ambiente explícita de build do loader (`PAPER_BUILD`, `FORGE_VERSION` e similares) contra o registro do loader. Builds do Paper vêm da **API Fill v3** atual do PaperMC (o endpoint legado v2 parou de receber novas versões do Minecraft).

![Atualizações](/docs/images/updates.png)

## Como funciona

O painel verifica as versões fixadas de cada servidor contra a origem upstream e lista qualquer coisa com um novo lançamento. Uma contagem correspondente também aparece no bloco "Atualizações disponíveis" do [dashboard](/docs/dashboard/).

As verificações são executadas sob demanda e podem ser agendadas ([Agendamentos](/docs/schedules/)). A **política** de atualização é por servidor: você decide se o painel apenas o notifica ou deixa tudo manual.

## Aplicando uma atualização

As atualizações nunca são silenciosas. Quando você escolhe atualizar um pack, o painel:

1. Faz um **backup pré-atualização** (para que seja reversível; os últimos 10 backups pré-atualização por servidor são mantidos).
2. Fixa a versão exata nova.
3. Recria o contêiner, resolvendo novamente o runtime do Java, se necessário.
4. Monitora a primeira inicialização, com um orçamento de tempo por plataforma.

Se ele não iniciar de forma saudável, você reverte para o backup pré-atualização. Um servidor com rastreamento estável nunca recebe uma versão beta, e o link do changelog aponta para a diferença real por versão onde a origem a fornece. Uma atualização falha também dispara um [alerta](/docs/integrations/) do Discord se a integração estiver configurada.
