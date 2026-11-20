---
title: 'Registro de atividades'
description: 'A página de Atividades é o registro de auditoria completo: um registro cronológico e pesquisável de tudo o que aconteceu no painel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Voltar ao índice da documentação](/docs/)

A página **Atividade** é o registro de auditoria completo: um registro cronológico e pesquisável de tudo o que aconteceu no painel. Filtre por servidor ou por tipo de evento, pesquise os resumos e exporte o que você filtrou como CSV ou JSON. As entradas que capturaram um log (uma falha, por exemplo) o abrem no local.

![Atividade](/docs/images/activity.png)

## O que é registrado

- **Autenticação**: logins (incluindo se 2FA ou um código de backup foi usado), bloqueios de conta, alterações de senha e 2FA sendo ativado, desativado ou redefinido.
- **Ciclo de vida do servidor**: criações, inícios, paradas, reinícios, falhas, reinícios automáticos e eventos de falta de memória.
- **Alertas**: inicializações travadas, falhas de parada, agendamentos falhos, paradas por cota, contêineres não saudáveis, offline-após-reinício.
- **Dados**: backups criados e restaurados, blueprints exportados, instalações e atualizações de pacotes, alterações de mods e mundos, e edições de arquivos.
- **Jogadores**: expulsões, banimentos, alterações de whitelist e op, e notas de jogadores.
- **Configuração**: alterações de comandos de chat, alterações de usuários e funções, alterações de permissões por servidor, alterações de porta do jogo e edições de configurações.

Cada entrada registra quem a fez (um nome de usuário, ou o painel/agendador para ações automatizadas), a qual servidor ela se refere e quando. O [painel](/docs/dashboard/) mostra as entradas mais recentes; esta página é o histórico completo. Operadores e visualizadores veem apenas as entradas dos servidores que podem visualizar (mais as gerais do painel), e as alterações de permissão por servidor são mostradas apenas para administradores. Eventos de ciclo de vida e alertas também podem ser encaminhados para o Discord (veja [Integrações](/docs/integrations/)).

Como ele captura eventos relevantes de segurança (logins, alterações de 2FA, alterações de função e permissão), o log de atividade também é sua primeira parada se algo parecer errado com uma conta.
