---
title: 'Integrações'
description: 'Cada servidor carrega suas integrações no grupo de Configurações: Discord, uma Página de Status pública, Convites de um clique e a aba opcional de Chatbot (apenas para administradores).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Voltar ao índice da documentação](/docs/)

Cada servidor carrega suas integrações no grupo **Configurações**: **Discord**, uma **Página de Status** pública, **Convites** com um clique e a aba opcional **Chatbot** (apenas para administradores). Esta página cobre o Discord; [convites e página de status](/docs/invites-and-status-page/) cobre esses dois, e [o chatbot](/docs/chatbot/) tem sua própria página.

## Notificações do Discord

O painel encaminha eventos do servidor para um canal do Discord através de um webhook. Sem bot, sem OAuth.

### Configuração

1. No Discord: **Configurações do Servidor → Integrações → Webhooks → Novo Webhook**. Escolha o canal e copie a URL do webhook.
2. No painel, abra a aba **Configurações → Discord** do servidor, cole a URL em **URL do Webhook**, ative o card **ligado** e clique em **Salvar**. A URL é armazenada criptografada (no mesmo armazenamento em repouso das suas chaves de API).
3. Use **Enviar Teste** para confirmar que funciona.

![Integração com Discord](/docs/images/integrations-discord.png)

Para substituir uma URL armazenada, cole uma nova e salve; deixe o campo em branco para manter o atual. A URL armazenada é exibida mascarada (o token é oculto).

### O que é enviado

As notificações são agrupadas em categorias que podem ser ativadas/desativadas. Todas estão ativadas por padrão.

| Categoria         | Eventos                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| **Iniciar/parar** | Servidor iniciado, servidor parado                                      |
| **Falhas**        | Falha, loop de falha detectado, novo relatório de falha                 |
| **Backups**       | Backup criado, backup restaurado                                        |
| **Atualizações**  | Atualização aplicada, atualização revertida, falha na atualização       |
| **Expulsões/ban** | Jogador expulso, jogador banido                                         |
| **Alertas**       | As coisas que deixam um servidor quebrado silenciosamente (veja abaixo) |

### A categoria Alertas

`Alertas` é o canal "algo precisa de um humano", para condições que antes eram visíveis apenas no painel:

| Evento                  | Significado                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `oom`                   | O contêiner foi parado por ficar sem memória.                                                             |
| `unhealthy`             | O processo está ativo, mas a sonda `mc-health` está falhando: um servidor vivo, mas morto.                |
| `startup-stalled`       | Ainda iniciando após ~10 min sem "Done" nos logs (com um diagnóstico do que corrigir, quando conhecido).  |
| `stop-failed`           | Uma parada graciosa não surtiu efeito e o contêiner ainda está em execução.                               |
| `schedule-failed`       | Uma reinicialização / backup / comando agendado falhou.                                                   |
| `quota-exceeded`        | Cota de disco em modo estrito foi atingida e o servidor foi parado.                                       |
| `offline-after-restart` | O servidor estava ativo antes do painel reiniciar, não está agora e não será iniciado automaticamente.    |
| `port-change-failed`    | Uma mudança de porta falhou e o servidor não pôde ser recolocado em sua porta antiga, então está inativo. |
| `auto-restart-gave-up`  | Um servidor que falhou não foi reiniciado porque outra ação o manteve ocupado por muito tempo.            |

### Como a entrega funciona

Uma ponte em segundo plano verifica o [log de eventos](/docs/activity/) a cada 15 segundos e encaminha as linhas mapeadas. Se um POST de webhook falhar transitoriamente, essa linha é retentada em verificações posteriores em vez de ser descartada; após algumas tentativas falhas, a linha é ignorada e as falhas de entrega são registradas no máximo uma vez por hora por servidor. Após uma reinicialização do painel, a ponte envia os eventos que ainda não foram entregues, mas nunca com mais de duas horas de atraso; em sua primeira execução, ela começa do evento mais recente.
