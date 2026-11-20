---
title: 'Backups de servidor Minecraft que realmente restauram'
description: 'Como fazer backups de servidor Minecraft que realmente restauram: cópias consistentes, guardadas em outro lugar e testadas pelo menos uma vez.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Voltar ao índice da documentação](/docs/)

A maioria dos servidores tem backups. Menos ainda têm backups que funcionam, e a diferença só é descoberta no pior dia. Três coisas os separam: a cópia é consistente, ela reside em outro lugar e alguém já a restaurou pelo menos uma vez.

## Copie o mundo enquanto ele não está sendo gravado

Um servidor em execução grava arquivos de região continuamente. Copie-os no meio da gravação e você obterá um arquivo que é metade antigo e metade novo, que falhará ao carregar ou carregará com um buraco no chão onde a base de alguém costumava estar. Nada o avisará, porque a cópia foi bem-sucedida.

Existem duas maneiras corretas de fazer uma cópia:

1. **Pare o servidor**, copie, inicie-o novamente. Simples, honesto e impopular devido ao tempo de inatividade.
2. **Diga ao jogo para parar de gravar primeiro.** Execute `save-off`, depois `save-all flush`, espere terminar, copie, então `save-on`. O mundo fica completo e quieto durante a cópia.

Nunca pule direto para a cópia. Um snapshot no nível do sistema de arquivos ou do volume só é bom se for genuinamente atômico, e um `cp -r` enquanto os jogadores estão colocando blocos não é.

## Faça backup de mais do que apenas o mundo

Restaurar apenas o mundo traz o terreno e perde o servidor. Você também quer:

- `server.properties`, e qualquer outra coisa que defina as regras.
- Os arquivos JAR de mods ou plugins, nas versões exatas que estavam em execução. Um mundo não carregará sem os mods que criaram seus blocos.
- Dados do jogador, incluindo `whitelist.json`, `ops.json` e as pastas de estatísticas e avanços.
- A versão do pack, se veio de um pack. Anotá-la conta.

O teste de sanidade mais rápido para qualquer backup: você conseguiria reconstruir este servidor em uma máquina nova apenas a partir do arquivo compactado? Se a resposta precisar de uma frase começando com "e então eu reinstalaria", não é um backup completo.

## Uma cópia no mesmo disco não é um backup

Um backup que reside na máquina que ele protege cobre exatamente uma falha: você excluiu algo. Ele não cobre a falha do disco, a suspensão da conta pelo provedor ou um erro que exclui todo o diretório.

Mantenha a simplicidade em vez da perfeição:

- Uma cópia local, para o caso comum, que é alguém causando grief ou uma atualização ruim.
- Uma cópia em outro lugar. Outra máquina, um armazenamento de objetos ou um NAS doméstico puxando via SSH durante a noite.
- Histórico suficiente para sobreviver a um problema que você não percebeu imediatamente. Corrupção é frequentemente encontrada dias depois, e se você mantiver três dias de backups, já terá sobrescrito o bom.

Sete cópias diárias mais quatro semanais cobrem quase todos os incidentes reais e custam muito pouco espaço.

## Teste uma restauração antes de precisar dela

Escolha um backup, restaure-o em um servidor reserva e conecte-se. Esse é o teste completo, leva quinze minutos e detecta todas as falhas clássicas: o arquivo compactado faltando a pasta de mods, um mundo que precisa de uma versão que você não executa mais, permissões que tornam os arquivos ilegíveis, um upload truncado.

Faça isso uma vez ao configurar os backups e mais uma vez após qualquer grande alteração no servidor.

## Tamanho e como mantê-lo sob controle

Mundos crescem porque os jogadores exploram. Um mundo onde alguém voou dez mil blocos em linha reta carrega todos os chunks ao longo dessa linha para sempre, e a maioria desses chunks nunca será visitada novamente.

Três alavancas, em ordem de quanto retorno elas oferecem:

1. **Remova chunks não visitados.** Ferramentas que podam por tempo de última modificação geralmente removem uma grande fração de um mundo bem viajado sem efeito visível no jogo.
2. **Comprima adequadamente.** Arquivos de região comprimem bem; arquivos compactados deles não se beneficiam de nada exótico.
3. **Não guarde todas as cópias horárias por um ano.** A retenção supera a compressão.

## No Minecraft Server Manager

Backups seguem o caminho `save-off`, flush, copy, `save-on`, e uma parada ou reinicialização solicitada no meio de um backup é recusada até que a cópia termine, em vez de competir com ela. O arquivo compactado cobre todo o diretório do servidor, então mods, configuração e dados do jogador viajam com o mundo.

Backups podem ser executados em uma programação junto com reinicializações e comandos, e cada novo servidor começa com uma programação de backup diário. A retenção conta cada tipo separadamente, então as dez cópias agendadas que se acumulam por conta própria não podem substituir aquela que você fez manualmente antes de uma alteração arriscada, e limites de idade e tamanho se aplicam em cima disso. Os administradores alteram tudo isso na página de Configurações, ou por servidor em sua aba de Backups. Restaurar primeiro pega um backup novo, então uma restauração para o ponto errado no tempo é em si reversível. Um mundo pode ser encolhido sozinho ou como parte de um backup, que é a alavanca que mais importa para o tamanho.

Todo o painel, incluindo cada backup, vive sob um único diretório. Copiar esse diretório para outro lugar é a metade da história fora da máquina, e é deliberadamente a única coisa que você precisa copiar.

Relacionado: [backups no painel](/docs/backups/), [agendamentos](/docs/schedules/),
[encolhendo um mundo](/docs/world-shrink/), [movendo um servidor para outro host](/docs/guide-moving-a-server/).
