---
title: 'Armazenamento'
description: 'Veja para onde vai o espaço em disco, defina um limite de cota de disco para cada pasta de servidor e limpe o que você não precisa mais.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Voltar ao índice da documentação](/docs/)

A página **Armazenamento** mostra para onde seu disco está indo: uso por categoria, cada servidor contra sua cota, os maiores arquivos e como o uso total está evoluindo em varreduras recentes. É apenas para administradores.

![Armazenamento](/docs/images/storage.png)

## Cotas de disco são aplicadas pelo painel

O Docker não consegue limitar o uso de disco de um bind mount, então o painel faz isso. Um indexador de tamanho em segundo plano percorre a pasta de dados (a cada 15 minutos, após alterações ou quando você pressiona **Re-escanear Agora**), armazena em cache o espaço ocupado por cada servidor e aplica a cota de disco que você define por servidor. Uma ação que levaria a pasta de um servidor (mundo, mods, configurações, logs e tudo mais dentro dela) além de sua cota, como instalar um mod, um mundo ou fazer upload de arquivos, é bloqueada até que o espaço seja liberado ou a cota seja aumentada, em vez de deixar um servidor encher seu host.

Defina a cota de um servidor em suas [configurações](/docs/servers/#server-settings). Ativar **Parar o Servidor Quando Acima da Cota** lá também para um servidor em execução assim que sua pasta crescer mais de 10% além da cota, e registra isso no histórico do servidor. Servidores com mods podem ser grandes, então dê espaço a eles. [Backups](/docs/backups/) são armazenados separadamente e não contam para a cota.

## Limpeza

O card **Limpeza com Um Clique** libera espaço que o painel pode recuperar com segurança: arquivos temporários com mais de uma hora, arquivos de biblioteca órfãos e logs arquivados e relatórios de falha com mais de 30 dias. Cada um mostra quanto libera e abre uma prévia antes que qualquer coisa seja excluída. As listas **Por Categoria** e **Maiores Arquivos** levam diretamente ao gerenciador de arquivos, para que você possa encontrar o que mais podar antes de ficar sem espaço.
