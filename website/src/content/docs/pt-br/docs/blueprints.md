---
title: 'Blueprints'
description: 'Um blueprint captura toda a configuração de um servidor (tipo, versão, recursos, ambiente, pinagem do pack e, opcionalmente, sua configuração e mundo) em um único po'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Voltar ao índice de docs](/docs/)

Um **blueprint** captura toda a configuração de um servidor (tipo, versão, recursos, ambiente, pinagem de modpack e, opcionalmente, sua configuração e mundo) em um único arquivo portátil do qual você pode criar novos servidores.

![Blueprints](/docs/images/blueprints.png)

## Exportando

A partir de um servidor, exporte um blueprint e escolha o que incluir: configuração sempre, e opcionalmente arquivos incorporados e o mundo. O resultado é salvo em sua biblioteca de blueprints e pode ser baixado para compartilhamento.

## Importando e criando a partir de um blueprint

Importe um arquivo de blueprint (ou escolha um da biblioteca) para criar um novo servidor pré-configurado exatamente como o original. É a maneira mais rápida de:

- Criar servidores idênticos (uma rede de servidores de minijogos, cópias de staging da produção).
- Mover um servidor entre painéis.
- Manter um template conhecido e confiável ao qual você sempre pode retornar.

Como um blueprint registra a [pinagem exata do modpack](/docs/modpacks/), um servidor de modpack recriado a partir de um blueprint instala a mesma versão fixada, sem atualizações inesperadas.
