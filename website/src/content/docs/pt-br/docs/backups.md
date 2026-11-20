---
title: 'Backups'
description: 'A página de Backups exibe todos os snapshots da sua frota, com tamanho, motivo e idade, filtráveis por servidor e por motivo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Voltar ao índice da documentação](/docs/)

A página **Backups** exibe todos os snapshots do seu parque de servidores, com tamanho, motivo e idade, filtráveis por servidor e por motivo.

![Backups](/docs/images/backups.png)

## Criando um backup

A partir da aba **Backups** de um servidor (ou via um [agendamento](/docs/schedules/)), você pode tirar um snapshot de todo o diretório do servidor com um clique. O painel primeiro "acalma" o mundo (`save-off` → `save-all`), compacta os dados e, em seguida, reabilita o salvamento (`save-on`), garantindo que os backups sejam consistentes mesmo em um servidor em execução. A compressão é executada em uma thread de trabalho em segundo plano para não travar o painel. Um backup iniciado pela API pode conter uma nota.

Cada arquivo é **verificado quanto à integridade** no momento em que é gravado: o painel reabre o zip e lê seu diretório. Um arquivo corrompido ou que não pode ser aberto é excluído e a solicitação de backup falha imediatamente, em vez de o problema surgir meses depois, quando uma restauração é a única coisa entre você e a perda de dados. Um arquivo com zero entradas (um servidor que nunca foi iniciado) é permitido, mas sinalizado no evento.

Marque **"Também reduzir o mundo depois"** (na aba Backups ou em um agendamento de backup) para remover pedaços raramente visitados assim que o arquivo for gravado com segurança (veja **[Reduzindo um mundo](/docs/world-shrink/)**). A redução só é executada enquanto o servidor está parado; em um servidor em execução, o backup ainda acontece e a redução é ignorada.

![Backups de servidor](/docs/images/server-backups.png)

## Motivos de backup

Os backups são marcados pelo motivo pelo qual foram criados:

- **manual**: você clicou em **Fazer Backup Agora**. Substituir o mundo ativo de um servidor por um da biblioteca também faz um backup `manual` primeiro.
- **agendado**: criado por um [agendamento](/docs/schedules/). Cada novo servidor também recebe automaticamente um backup agendado diário (entre 02:00 e 05:59), para que um servidor tenha cobertura automática desde o primeiro dia, não apenas antes das atualizações.
- **pré-atualização**: feito automaticamente antes de uma atualização de pacote ou uma mudança de versão do Minecraft, para que uma atualização seja sempre reversível.
- **pré-restauração**: feito automaticamente logo antes de uma restauração ou redefinição de mundo, como uma rede de segurança caso a restauração não seja o que você desejava.

## Retenção

A retenção é limitada **por servidor, por motivo**: os mais recentes de cada grupo são mantidos, os mais antigos são podados automaticamente após cada backup bem-sucedido:

| Motivo          | Mantidos por padrão |
| --------------- | ------------------- |
| agendado        | 10                  |
| pré-atualização | 10                  |
| manual          | 20                  |
| pré-restauração | 5                   |

`pré-restauração` (chamados de backups de segurança no painel) tem seu próprio pequeno "balde" precisamente para que um backup de segurança automático nunca possa remover um backup `manual` que você manteve deliberadamente.

Dois limites opcionais se aplicam acima das contagens por motivo, ambos desativados por padrão: uma **idade máxima** (backups mais antigos que N dias são podados, independentemente do motivo) e um **tamanho total máximo** por servidor (os mais antigos são podados até que o total caiba: backups de segurança primeiro, depois os agendados, depois o restante). O backup mais recente de um servidor nunca é podado por nenhum desses limites.

### Alterando

Os administradores definem a política do painel no card **Retenção de Backup** na página **Configurações** (**Preencher Padrões** insere os padrões acima de volta no formulário, pronto para salvar). Um servidor pode diferir em qualquer um dos seis valores: abra sua aba **Backups** e expanda **Retenção para Este Servidor**. Cada campo lá está em branco, a menos que esse servidor o defina, e um campo em branco segue o valor do painel (mostrado dentro dele). Assim, um servidor pode, por exemplo, manter 3 backups agendados e usar os valores do painel para todo o resto; limpar um campo o retorna ao valor do painel.

![O card Retenção de Backup em Configurações](/docs/images/settings-retention.png)

![Retenção para Este Servidor na aba Backups de um servidor](/docs/images/server-retention.png)

Salvar nunca exclui nada por si só. Se os novos limites deixarem backups existentes acima do limite, o painel lista, por servidor, quantos backups de cada tipo seriam removidos, quanto espaço isso libera e qual a idade do mais antigo. Ele também informa quando um servidor já estava acima de seus limites antes dessa alteração (por exemplo, após um **A partir do Próximo Backup** anterior), pois a aplicação agora trunca tudo o que está acima do limite, não apenas o que esta edição adiciona. Em seguida, pergunta como aplicá-los:

- **Remover Agora** exclui exatamente os backups que acabou de listar, nada mais: um backup feito nesse ínterim espera pela próxima poda. Na página de Configurações, um servidor no meio de uma restauração, backup ou ação semelhante é ignorado e a poda ocorre após o próximo backup; na aba Backups de um servidor, você é solicitado a tentar novamente assim que essa ação terminar. Enquanto os backups antigos de um servidor estão sendo excluídos (geralmente segundos), outras ações nesse servidor precisam esperar: um backup ou início agendado que ocorra nesse momento tenta novamente a cada minuto até conseguir (por até 30 minutos), um servidor travado é reiniciado cerca de 20 segundos após terminar (por até 30 minutos), e uma reinicialização ou parada agendada que colida com isso é ignorada até seu próximo horário.
- **A Partir do Próximo Backup** os mantém por enquanto; cada servidor poda seus backups na próxima vez que fizer um, como sempre fez.

![O diálogo listando o que os novos limites removeriam](/docs/images/retention-preview.png)

Um backup que está sendo restaurado nunca é removido enquanto a restauração é executada: a retenção o ignora (e não exclui outros backups para abrir espaço para ele), e excluí-lo manualmente é recusado até que a restauração termine.

As mesmas configurações estão disponíveis para scripts como endpoints de API de administrador: `GET`/`POST /api/backups/retention` e `/api/servers/:id/backups/retention`. Valores do painel inteiro não podem ser `null`. Para um servidor, um valor de `null` (ou `""`) remove essa chave específica, fazendo com que ele siga o valor do painel novamente, e `{ "reset": true }` remove todas elas. Sob cada um desses dois caminhos, `POST …/preview` relata o que uma alteração removeria sem removê-la (`backups`, `bytes`, `servers`, `ids` e um detalhamento `byServer` por servidor), e `POST …/apply` aplica a política salva agora e responde `{ deleted, skipped }` para o painel inteiro (`skipped` conta servidores ocupados) ou `{ deleted }` para um servidor. Envie o `{ "token": "..." }` da prévia (mantido por 10 minutos) ou seu `{ "ids": [...] }` para excluir apenas esses; sem nenhum deles, tudo o que estiver acima do limite será removido. Uma aplicação por servidor em um servidor ocupado responde com 409.

Backups podem ser **renomeados** a partir da lista de backups (o botão de renomear em cada linha). O arquivo no disco e o registro do painel se movem juntos, para que download, restauração e retenção continuem funcionando com o novo nome.

![Renomear um backup](/docs/images/backup-rename.png)

> A retenção é limitada automaticamente, mas arquivos grandes de mods ainda contam para a [cota de disco](/docs/storage/) de um servidor, então fique de olho no total para pacotes grandes.

## Restaurando

Restaurar um backup para o servidor (verificando se o contêiner realmente parou antes de tocar em qualquer arquivo), faz um backup de segurança `pre-restore`, substitui **todo o diretório do servidor** pelo snapshot e o deixa parado para você iniciar novamente. O arquivo é descompactado ao lado primeiro e só é trocado quando a extração estiver completa, então uma restauração que falha no meio deixa os arquivos atuais intocados. Como as atualizações de pacotes sempre fazem um backup `pre-update` primeiro, você sempre pode reverter uma atualização ruim.

## O próprio banco de dados do painel

Os backups de servidor cobrem apenas a pasta de cada servidor. O próprio banco de dados do painel (`panel.db`, contendo usuários, funções, segredos de 2FA, agendamentos, pins de pacotes e histórico) é copiado separadamente no timer de manutenção diária:

- `VACUUM INTO` grava uma cópia consistente e desfragmentada em `backups/_panel/` na pasta de dados; os **14** mais recentes são mantidos.
- Na inicialização, o painel executa `PRAGMA integrity_check` e registra ruidosamente se falhar, apontando você para `backups/_panel` para a cópia boa mais recente.

Faça backup de toda a pasta de dados (ela também contém `.secret-key`, a chave de criptografia em repouso) e você terá feito backup de tudo.
