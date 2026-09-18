---
title: 'Agendamentos'
description: 'A página Agendamentos automatiza tarefas recorrentes com expressões cron.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Voltar ao índice de documentação](/docs/)

A página **Agendamentos** automatiza tarefas recorrentes com expressões cron. Sem cron externo, sem scripts.

![Agendamentos](/docs/images/schedules.png)

## O que você pode agendar

- **Reinicializações** - uma reinicialização noturna para manter um servidor em execução por muito tempo saudável.
- **Backups** - snapshots regulares (marcados como `scheduled` na página [Backups](/docs/backups/)).
- **Comandos** - executar qualquer comando do servidor em um agendamento.
- **Verificações de atualização** - atualizar periodicamente o que está desatualizado.

Cada agendamento tem como alvo um servidor específico (ou o painel globalmente), é executado em sua própria expressão cron e pode ser ativado ou desativado sem ser excluído. A hora da última execução é exibida para que você possa confirmar que está funcionando.
