---
title: 'Agendamentos'
description: 'A página Agendamentos automatiza tarefas recorrentes com expressões cron. Sem cron externo, sem scripts.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Voltar ao índice da documentação](/docs/)

A página **Agendamentos** automatiza tarefas recorrentes com expressões cron. Sem cron externo, sem scripts.

![Agendamentos](/docs/images/schedules.png)

## O que você pode agendar

- **Reinícios**: um reinício noturno para manter um servidor em execução por muito tempo saudável.
- **Paradas e inícios**: derrubar um servidor durante a noite e colocá-lo de volta pela manhã.
- **Backups**: snapshots regulares (marcados como `scheduled` na página [Backups](/docs/backups/)). Um agendamento de backup também pode encolher o mundo após cada backup ([encolhendo um mundo](/docs/world-shrink/)). Cada novo servidor recebe um agendamento de backup diário automaticamente.
- **Comandos**: executar qualquer comando do servidor em um agendamento.
- **Verificações de atualização**: atualizar periodicamente o que está desatualizado. A verificação agendada é também o que aplica atualizações para servidores configurados para [Atualização Automática](/docs/modpacks/#update-policy).

Cada agendamento tem como alvo um servidor específico (ou o painel globalmente), executa em sua própria expressão cron e pode ser ativado ou desativado sem ser excluído. O editor visualiza os próximos horários de execução enquanto você digita, os horários cron seguem o fuso horário do painel (definido em **Configurações**), e a tabela mostra a próxima execução de cada agendamento. Cada disparo é registrado como um evento de histórico, assim como uma execução falha.

O painel também semeia seus próprios agendamentos de manutenção na primeira inicialização, que você pode redefinir ou desativar: uma verificação diária de atualização, uma nova varredura de armazenamento a cada seis horas, uma limpeza diária de arquivos temporários antigos, uma varredura de expiração de banimentos a cada 15 minutos (removendo banimentos temporários que expiraram) e um preenchimento noturno de metadados de conteúdo (preenchendo nomes e ícones de mods ausentes).

## Quando o servidor está ocupado

Um backup ou início agendado que encontra seu servidor no meio de outra ação (uma restauração, uma limpeza de backup, uma alteração de porta) espera e tenta novamente a cada minuto até que essa ação seja concluída, por até 30 minutos. Um início em espera é descartado se alguém iniciar ou parar o servidor nesse ínterim. Um reinício ou parada agendado não é retentado: ele é pulado e executado novamente em seu próximo horário.
