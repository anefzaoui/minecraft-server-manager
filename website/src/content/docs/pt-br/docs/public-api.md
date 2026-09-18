---
title: 'API Pública'
description: 'Uma API HTTP pequena e somente leitura para buscar o status do servidor de fora do painel: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Voltar ao índice da documentação](/docs/)

Uma API HTTP pequena e somente leitura para buscar o status do servidor de fora do painel: um
painel de status, um monitor de tempo de atividade, um bot do Discord, uma regra de automação residencial. Ela é
servida pelo próprio painel e retorna os mesmos dados ao vivo que as páginas do painel
mostram (do cache em memória), então consultá-la nunca toca no Docker.

Ela está **desativada até que um administrador a utilize** e é **controlada por administrador**. Nada é exposto
até que um token exista.

## Habilitando-a

**Configurações → API Pública → Nova Chave**. Dê um nome a ela, escolha o que ela pode ver (todos os
servidores ou um subconjunto específico) e, opcionalmente, uma data de expiração. A chave completa (um token
Bearer) é mostrada **uma vez**, em um diálogo; copie-a agora, pois apenas um pequeno prefixo
é mantido depois, para identificação na lista.

![Configurações da API Pública](/docs/images/settings-public-api.png)

Criar a primeira chave ativa a API automaticamente (o interruptor **Permitir que aplicativos externos
leiam o status** é um controle de pausa: desative-o para parar de servir sem cancelar nenhuma chave). Cancele uma chave
na mesma tabela a qualquer momento; clientes que a utilizam perdem o acesso imediatamente.

Tokens são armazenados como um hash SHA-256 (nunca em texto plano), sobrevivem a uma reinicialização do painel
e sobrevivem aos servidores aos quais estão vinculados (um servidor excluído simplesmente
sai dos resultados desse token).

## Autenticando

Envie o token como uma credencial Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Não há cookies e **sem CORS**: isso é para chamadores de servidor para servidor e de linha de comando,
não para aplicativos de navegador de outra origem. Se o painel estiver atrás de um proxy reverso,
certifique-se de que o proxy encaminhe o cabeçalho `Authorization`.

Falhas retornam `401` com `{ "ok": false, "error": "..." }`. Qualquer coisa diferente de `GET`
(ou `HEAD`) retorna `405`. Caminhos desconhecidos retornam `404`. Quando a API está desativada, todas as rotas
retornam `404`.

## Limite de taxa

Cada token recebe seu próprio orçamento, `RATE_LIMIT_PUBLIC_API_PER_MIN` (padrão `120`
requisições/minuto; `0` desativa o limitador). Exceder o limite retorna `429`. Requisições que
nunca apresentam um token válido (ausente, malformado, revogado ou expirado) são limitadas separadamente
por IP do cliente a cinco vezes esse número, para que a sondagem não possa contornar o orçamento rotacionando
tokens.

## Endpoints

### `GET /api/v1/servers`

Todos os servidores aos quais o token está vinculado.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

Um servidor, mesmo objeto sob uma chave `server`. Retorna `404` para um id desconhecido
**e** para um servidor ao qual o token não está vinculado (nenhum oráculo de existência), e `400`
para um id malformado.

## Campos de resposta

| Campo           | Significado                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `total`         | Quantos servidores são visíveis para este token (após seu filtro de escopo).                   |
| `online`        | Quantos deles estão no estado: `running`.                                                      |
| `id`            | ID estável do servidor (`srv_...`).                                                            |
| `name`          | Nome de exibição.                                                                              |
| `type`          | Tipo de servidor itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                             |
| `state`         | `running`, `starting`, `stopped` ou `crashed` - um resumo estável do status interno do painel. |
| `cpuPct`        | CPU % recente, ou `null` quando o servidor não está em execução.                               |
| `memoryMb`      | Memória residente em MB, ou `null`.                                                            |
| `memoryLimitMb` | Limite de memória do contêiner configurado em MB, ou `null`.                                   |
| `uptimeSeconds` | Segundos desde que o contêiner iniciou, ou `null`.                                             |
| `players`       | `{ online, max }`, ou `null` até que o servidor relate uma lista de jogadores.                 |

## Exemplo

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
