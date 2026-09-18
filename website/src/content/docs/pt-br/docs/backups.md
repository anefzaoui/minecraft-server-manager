---
title: 'Backups'
description: 'A página de Backups exibe todos os snapshots em sua frota, com tamanho, motivo e idade.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Voltar ao índice de docs](/docs/)

A página **Backups** exibe todos os snapshots de sua frota, com tamanho, motivo e idade.

![Backups](/docs/images/backups.png)

## Criando um backup

A partir da aba **Backups** de um servidor (ou via um [agendamento](/docs/schedules/)), você pode tirar um snapshot de todo o diretório do servidor com um clique. O painel primeiro "acalma" o mundo (`save-off` → `save-all`), compacta os dados e, em seguida, reabilita o salvamento (`save-on`), garantindo que os backups sejam consistentes mesmo em um servidor em execução. A compressão é executada em uma thread de trabalho em segundo plano para não travar o painel. Cada backup pode conter uma nota.

Todo arquivo compactado é **verificado quanto à integridade** no momento em que é gravado: o painel reabre o zip e lê seu diretório. Um arquivo corrompido ou que não pode ser aberto é excluído e a solicitação de backup falha imediatamente, em vez de o problema surgir meses depois, quando uma restauração é a única coisa entre você e a perda de dados. Um arquivo com zero entradas (um servidor que nunca foi iniciado) é permitido, mas sinalizado no evento.

Marque **"Também reduzir o mundo depois"** (na aba Backups ou em um agendamento de backup) para remover chunks raramente visitados assim que o arquivo for gravado com segurança (veja **[Reduzindo um mundo](/docs/world-shrink/)**). A redução só é executada enquanto o servidor estiver parado; em um servidor em execução, o backup ainda acontece e a redução é ignorada.

![Backups de servidor](/docs/images/server-backups.png)

## Motivos de backup

Os backups são marcados pelo motivo pelo qual foram criados:

- **manual** - você clicou no botão.
- **agendado** - criado por um [agendamento](/docs/schedules/). Cada novo servidor também recebe automaticamente um backup agendado diário (entre 02:00 e 05:59), para que um servidor tenha cobertura automática desde o primeiro dia, não apenas antes de atualizações.
- **pré-atualização** - tirado automaticamente antes de uma atualização de pacote, para que uma atualização seja sempre reversível.
- **pré-restauração** - tirado automaticamente logo antes de uma restauração ou redefinição de mundo, como uma rede de segurança caso a restauração não seja o que você queria.

## Retenção

A retenção é limitada **por servidor, por motivo**: os mais recentes de cada grupo são mantidos, os mais antigos são automaticamente removidos após cada backup bem-sucedido:

| Motivo          | Mantidos |
| --------------- | -------- |
| agendado        | 10       |
| pré-atualização | 10       |
| manual          | 20       |
| pré-restauração | 5        |

`pré-restauração` tem seu próprio pequeno "balde" precisamente para que um backup de segurança automático nunca possa remover um backup `manual` que você manteve deliberadamente.

Dois limites opcionais se aplicam além das contagens por motivo, ambos desativados por padrão: uma **idade máxima** (backups mais antigos que N dias são removidos, qualquer que seja o motivo) e um **tamanho total máximo** por servidor (os backups mais antigos são removidos até que o total caiba, começando pelos de `pré-restauração`). O backup mais recente de um servidor nunca é removido por nenhum desses limites. Todos esses podem ser alterados globalmente na página Configurações e substituídos por servidor em sua aba Backups.

Os backups podem ser **renomeados** a partir da lista de backups (o botão de renomear em cada linha). O arquivo no disco e o registro do painel se movem juntos, para que download, restauração e retenção continuem funcionando com o novo nome.

![Renomear um backup](/docs/images/backup-rename.png)

> A retenção é limitada automaticamente, mas arquivos grandes de mods ainda contam para a [cota de disco](/docs/storage/) de um servidor, então fique de olho no total para pacotes grandes.

## Restaurando

Restaurar um backup para o servidor (verificando se o contêiner realmente parou antes de tocar em qualquer arquivo), tira um backup de segurança `pré-restauração`, substitui **todo o diretório do servidor** pelo snapshot e o deixa parado para você iniciar novamente. Como as atualizações de pacotes sempre tiram um backup `pré-atualização` primeiro, você sempre pode reverter uma atualização com problemas.

## O próprio banco de dados do painel

Os backups de servidor cobrem apenas os diretórios de mundo por servidor. O próprio banco de dados do painel (`panel.db`, contendo usuários, funções, segredos de 2FA, agendamentos, pins de pacotes e histórico) é copiado separadamente no timer de manutenção diário:

- `VACUUM INTO` grava uma cópia consistente e desfragmentada em `data/backups/_panel/`; os **14** mais recentes são mantidos.
- Na inicialização, o painel executa `PRAGMA integrity_check` e registra em log ruidosamente se falhar, apontando você para `data/backups/_panel` para a cópia boa mais recente.

Faça backup de toda a árvore `data/` (ela também contém `.secret-key`, a chave de criptografia em repouso) e você terá feito backup de tudo.
