---
title: 'Registro de atividades'
description: 'A página de Atividades é o registro de auditoria completo: um registro cronológico e pesquisável de tudo o que aconteceu no painel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Voltar ao índice de docs](/docs/)

A página **Atividade** é o registro de auditoria completo: um registro cronológico e pesquisável de tudo o que aconteceu no painel.

![Atividade](/docs/images/activity.png)

## O que é registrado

- **Autenticação** - logins (incluindo se 2FA ou um código de backup foi usado), e 2FA sendo ativado, desativado ou redefinido.
- **Ciclo de vida do servidor** - criações, inícios, paradas, reinícios, falhas e eventos de falta de memória.
- **Alertas** - inicializações travadas, falhas de parada, agendamentos falhos, paradas por cota, contêineres não íntegros, offline-após-reinício.
- **Dados** - backups criados e restaurados, blueprints exportados, instalações e atualizações de pacotes.
- **Configuração** - alterações de comandos de chat, alterações de funções e edições de configurações.

Cada entrada registra quem a realizou (um nome de usuário ou o painel/agendador para ações automatizadas), a qual servidor ela se refere e quando. O [painel](/docs/dashboard/) mostra as entradas mais recentes; esta página é o histórico completo. Eventos de ciclo de vida e alertas também podem ser encaminhados para o Discord (veja [Integrações](/docs/integrations/)).

Como ele captura eventos relevantes de segurança (logins, alterações de 2FA, alterações de função), o log de atividade também é seu primeiro ponto de parada se algo parecer errado com uma conta.
