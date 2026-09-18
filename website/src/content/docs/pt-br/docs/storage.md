---
title: 'Armazenamento'
description: 'A página de Armazenamento mostra para onde seu disco está indo: uso por servidor e como ele está evoluindo ao longo do tempo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Voltar ao índice de docs](/docs/)

A página **Armazenamento** mostra para onde seu disco está indo: uso por servidor e como ele está evoluindo ao longo do tempo.

![Armazenamento](/docs/images/storage.png)

## Quotas de disco são aplicadas pelo painel

O Docker não consegue limitar o uso de disco de um bind mount, então o painel faz isso. Um indexador de tamanho em segundo plano percorre o diretório de dados, armazena em cache a pegada de cada servidor e aplica a quota de disco que você define por servidor. Quando os dados de um servidor (mundo + backups + todo o resto) se aproximam de sua quota, o painel interrompe o crescimento descontrolado em vez de deixar um servidor encher seu host.

Defina a quota de um servidor em suas [configurações](/docs/servers/). Servidores com mods e seus [backups](/docs/backups/) podem ser grandes, então dê espaço a eles.

## Limpeza

A visualização de Armazenamento ajuda você a encontrar o que podar (backups antigos, mundos não utilizados ou um servidor que cresceu muito além do esperado) antes que você fique sem espaço.
