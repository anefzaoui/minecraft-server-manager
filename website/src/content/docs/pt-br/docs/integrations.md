---
title: 'Integrações'
description: 'Cada servidor carrega suas integrações sob o grupo Configurações: Discord, uma Página de Status pública, Convites de um clique e a aba opcional Chatbot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Voltar ao índice de documentação](/docs/)

Cada servidor carrega suas integrações sob o grupo **Configurações**: **Discord**, uma **Página de Status** pública, **Convites** com um clique e a aba opcional **Chatbot**. Esta página cobre o Discord (os outros têm sua própria documentação e ajudantes de configuração no painel).

## Notificações do Discord

O painel encaminha eventos do servidor para um canal do Discord através de um webhook. Sem bot, sem OAuth.

### Configuração

1. No Discord: **Configurações do Servidor → Integrações → Webhooks → Novo Webhook**. Escolha o canal e copie a URL do webhook.
2. No painel, abra a aba **Configurações → Discord** do servidor, cole a URL em **URL do Webhook**, ative o card **ligar** e **Salvar**. A URL é armazenada criptografada (no mesmo armazenamento em repouso das suas chaves de API).
3. Use **Enviar teste** para confirmar que funciona.

![Integração Discord](/docs/images/integrations-discord.png)

Para substituir uma URL armazenada, cole uma nova e salve; deixe o campo em branco para manter o atual. A URL armazenada é exibida mascarada (o token é oculto).

### O que é enviado

As notificações são agrupadas em categorias que podem ser ativadas/desativadas. Todas estão ativadas por padrão.

| Categoria                  | Eventos                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| **Iniciar / parar**        | Servidor iniciado, servidor parado                                      |
| **Falhas**                 | Falha, loop de falha detectado, novo relatório de falha                 |
| **Backups**                | Backup criado, backup restaurado                                        |
| **Atualizações**           | Atualização aplicada, atualização revertida, falha na atualização       |
| **Expulsões / banimentos** | Jogador expulso, jogador banido                                         |
| **Alertas**                | As coisas que deixam um servidor quebrado silenciosamente (veja abaixo) |

### A categoria Alertas

`Alertas` é o canal "algo precisa de um humano", para condições que costumavam ser visíveis apenas no painel:

| Evento                  | Significado                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `oom`                   | O contêiner foi parado por ficar sem memória.                                                            |
| `unhealthy`             | O processo está ativo, mas a sonda `mc-health` está falhando: um servidor vivo, mas morto.               |
| `startup-stalled`       | Ainda iniciando após ~10 min sem "Done" nos logs (com um diagnóstico do que corrigir, quando conhecido). |
| `stop-failed`           | Uma parada graciosa não surtiu efeito e o contêiner ainda está em execução.                              |
| `schedule-failed`       | Uma reinicialização / backup / comando agendado falhou.                                                  |
| `quota-exceeded`        | A cota de disco no modo estrito foi atingida e o servidor foi parado.                                    |
| `offline-after-restart` | O servidor estava ativo antes do painel reiniciar, não está agora e não será iniciado automaticamente.   |
| `crash-report`          | Um novo relatório de falha foi capturado e analisado.                                                    |
| `update-failed`         | Uma atualização protegida não iniciou de forma saudável.                                                 |

### Como a entrega funciona

Uma ponte em segundo plano verifica o [log de atividades](/docs/activity/) a cada 15 segundos e encaminha as linhas mapeadas. Se um POST de webhook falhar transitoriamente, essa linha é retentada em verificações posteriores em vez de ser descartada; um webhook permanentemente inacessível é silenciado (uma linha de log por hora) após algumas tentativas. A ponte nunca reproduz eventos de antes do painel iniciar.
