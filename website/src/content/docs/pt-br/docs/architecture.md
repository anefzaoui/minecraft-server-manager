---
title: 'Arquitetura'
description: 'Minecraft Server Manager é uma aplicação Node.js renderizada no servidor, de processo único.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Voltar ao índice da documentação](/docs/)

Minecraft Server Manager é uma aplicação Node.js renderizada no servidor, de processo único. Ela gerencia
servidores Minecraft que rodam como contêineres Docker usando a imagem
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicando-se com o
daemon Docker através de sua API (nunca executando o comando `docker` via shell).

## Estrutura de tempo de execução

- **Express + Handlebars** renderizam páginas no lado do servidor. Não há SPA; o JavaScript do navegador em `public/js/`
  é aprimoramento progressivo escrito manualmente. Um passo de esbuild (`pnpm run build:js`) o empacota e minifica em `public/dist/js/`; o aplicativo serve esse pacote quando ele está presente e o código fonte bruto caso contrário, então uma execução de desenvolvimento sem build ainda funciona.
- **`node:sqlite`** (embutido no Node; o painel requer Node ≥ 24) é o banco de dados - síncrono,
  zero módulos nativos, modo WAL. Um pequeno executor de migrações versionadas aplica `src/db/migrations/*` na inicialização. Declarações preparadas são cacheadas em `src/db/index.js` com chave baseada no texto SQL.
- **`ws`** carrega os fluxos de console e estatísticas ao vivo. Ambos são **intermediados**: um upstream
  `docker logs --follow` (ou `docker stats`) por servidor, desmultiplexado uma vez e distribuído para cada
  aba conectada, em vez de um upstream por visualizador. O intermediador de console mantém um pequeno buffer de repetição
  para abas que entram atrasadas e descarta um assinante cujo socket fica muito para trás em vez de
  atrasar o fluxo compartilhado.
- **dockerode** é a única forma como o aplicativo se comunica com o Docker. O endpoint é detectado automaticamente por plataforma
  (pipe nomeado do Windows vs. socket Unix).
- **Todo o estado persistente vive em um único diretório** (`$DATA_DIR`, padrão `./data`). Copiar esse
  diretório migra o painel inteiro.

## Camadas

As dependências fluem em uma única direção:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   analisa e valida a entrada, formata as respostas
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   lógica de domínio (as funcionalidades reais)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infraestrutura
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - um roteador por domínio (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), montado em `web/app.js`. Roteadores validam com zod, chamam um serviço e retornam JSON
  ou renderizam uma view. A lógica de negócios não pertence aqui. Dois roteadores são montados na **zona pública
  **, antes de `requireAuth`: `routes/status.js` (páginas de status HTML por servidor, opcionais) e
  `routes/apiV1.js` (`/api/v1`, uma API JSON somente leitura autenticada por um token Bearer emitido pelo admin
  de `services/apiTokens.js`, desativada a menos que habilitada em Configurações; veja `docs/public-api.md`).
- **`services/`** - o coração do aplicativo. Cada serviço possui um domínio e pode depender de
  infraestrutura e de outros serviços.
- **`docker/`** - wrappers do dockerode: `connect` (detecção de endpoint + saúde do daemon), `containers`
  (criar/iniciar/parar/recriar com bind mounts, limites de memória/CPU e rótulos), `logs`, `stats`,
  `images`, e um `watcher` que transforma eventos do Docker em histórico + detecção de falhas.
- **`db/`** - o wrapper SQLite e o executor de migrações.
- **`storage/`** - a inicialização de `./data`, o **guardião de caminhos** (`safeJoin`, a espinha dorsal de segurança de arquivos), e o indexador de tamanho em segundo plano + aplicação de cotas.

Transversal:

- **`config/`** - configuração de ambiente mais o **catálogo de campos**: a única fonte de verdade para
  configurações do servidor. Cada variável de ambiente itzg é catalogada (rótulo, ajuda, tipo, unidade, padrão,
  validação, seção, flags de perigo). O assistente, os formulários de configurações e a validação zod são todos derivados
  dele, então expor uma nova configuração é uma mudança de dados, não uma nova infraestrutura de UI.
- **`events/`** - `recordEvent()` é o único ponto de entrada para o log de histórico; eventos de ciclo de vida também
  capturam trechos de logs de contêineres para `data/logs/<id>/events/`.
- **`ws/`** - WebSockets de console + estatísticas autenticados (cookie de sessão verificado no upgrade, `Origin`
  verificado para bloquear sequestro entre sites), intermediados por servidor (veja "Estrutura de tempo de execução").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` retorna um logger [Pino](https://getpino.io) por módulo; nível de `LOG_LEVEL`,
  `makeFailureThrottle()` mantém um loop em segundo plano com falha persistente em uma linha de log mais uma linha de "recuperado".
  `src/utils/logSanitize.js` reda os metadados estruturados com chaves em formato de credenciais e tokens de webhook; `src/config/logLevel.js` é a lista de permissões de nível compartilhada (mantida separada para evitar um ciclo de require com `config`). `src/instrument.js` é uma porta Sentry dormente, carregada primeiro em
  `src/server.js`. `src/web/middleware/requestLog.js` escreve uma linha de log de acesso por solicitação
  (pulando `/healthz` e ativos estáticos). ESLint impõe `no-console` em `src/**`, com
  `preflight.js`, `instrument.js`, e `config/index.js` isentos (eles rodam antes que o logger exista).
- **Limitação de taxa** - `src/web/middleware/rateLimit.js` coloca `express-rate-limit` na frente de `/api`
  (`RATE_LIMIT_API_PER_MIN`, padrão 1200) e os POSTs de login / 2FA / configuração
  (`RATE_LIMIT_AUTH_PER_15MIN`, padrão 100); `0` desabilita um limitador. Ele usa `req.ip` como chave, então
  `TRUST_PROXY` é importante atrás de um proxy. `/api/v1` tem seu próprio limitador por token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, padrão 120), com chave baseada em um hash do token Bearer com fallback de IP. Um contador suave separado por conta em
  `src/web/middleware/auth.js` lida com o bloqueio de login (por IP e global por conta, decaindo).

## Comportamentos chave de domínio

- **Modpacks são sempre fixados.** A imagem atualiza automaticamente pacotes não fixados a cada reinicialização, então o painel resolve "latest" para um ID de versão concreto no momento da instalação e o fixa. Atualizações são um fluxo orquestrado explícito (`updates/`): pré-visualização → backup pré-atualização → parada graciosa → re-fixação → recriação → monitor de saúde → rollback com um clique.
- **A sobreposição de mods personalizados** é gerenciada pelo painel: mods adicionados pelo usuário vão para a biblioteca deduplicada e são hard-linked no servidor para que sobrevivam às atualizações do pack. A desativação é consciente da classe.
- **Portas** são alocadas a partir de um esquema base (jogo a partir de `PORT_GAME_START` para cima, RCON = jogo +
  `PORT_RCON_OFFSET`, Bedrock a partir de `PORT_BEDROCK_START`), sondadas quanto à disponibilidade e reservadas no
  DB.
- **Cotas de disco** são aplicadas pelo painel porque o Docker não pode limitar o uso de bind-mount: o indexador
  armazena em cache os tamanhos por diretório e as operações de crescimento de disco são limitadas por eles.
- **Segredos** (senhas RCON, chaves de API, segredos TOTP, URL do webhook Discord) são criptografados em repouso
  com AES-256-GCM usando uma chave aleatória dedicada em `$DATA_DIR/.secret-key` (modo `0600`,
  gerada automaticamente). É independente de `SESSION_SECRET`; uma chave derivada de `SESSION_SECRET` é mantida como
  fallback somente para descriptografia para valores escritos antes que a chave dedicada existisse, e
  `src/services/secretsMigration.js` os recriptografa sob a chave dedicada uma vez na inicialização.
  Um `.secret-key` que existe mas não pode ser analisado é um erro grave de inicialização (nunca é regenerado silenciosamente
  por cima). Blueprints removem todos os segredos na exportação.

## Formatos de dados e de comunicação

- **`data/panel.db`** - o banco de dados SQLite. Snapshotted diariamente via `VACUUM INTO` para
  `data/backups/_panel/` (os 14 mais recentes mantidos); `PRAGMA integrity_check` roda na inicialização.
- **`data/.session-secret`** - o segredo de assinatura de cookie gerado automaticamente, criado na primeira execução se
  `SESSION_SECRET` não estiver definido. Excluí-lo rotaciona o segredo (o que invalida as sessões).
- **`data/.secret-key`** - a chave de criptografia dedicada de 32 bytes em repouso (modo `0600`), criada automaticamente
  na primeira execução. Independente de `SESSION_SECRET`; excluí-la torna todas as credenciais armazenadas
  indecriptáveis, então pertence aos seus backups.
- **Blueprints (`.mcserver.zip`)** - um zip com um `manifest.json` descrevendo a configuração, recursos, a
  referência do pack fixado, o manifesto da sobreposição (URLs de origem + sha256), arquivos de configuração escolhidos e
  opcionalmente um mundo. A importação re-baixa e verifica o hash de cada mod e atribui novas portas.
- **Contêineres Docker** criados pelo painel são nomeados e rotulados para que o watcher possa encontrá-los;
  o painel é dono de seu ciclo de vida completo.

## Sequência de inicialização

1. `require('./instrument')` (a porta Sentry) antes de qualquer outra coisa, depois `require('./preflight')`
   para falhar claramente em uma versão não suportada do Node.
2. Carrega a configuração; garante/gera `.session-secret` **e** `.secret-key`.
3. `ensureDataRoot()` - cria a estrutura `./data`, limpa `tmp/`.
4. Executa as migrações do DB, depois `PRAGMA integrity_check` (loga ruidosamente, aponta para `data/backups/_panel`
   em caso de falha).
5. Recriptografa quaisquer segredos legados com chave `SESSION_SECRET` sob `.secret-key` (`secretsMigration`).
6. Semeia blueprints iniciais (protegidos).
7. Inicia o servidor HTTP + WS. Em um bind exposto, imprime o PIN de `/setup` da primeira execução.
8. Instala o guardião de tempo de execução pós-inicialização (captura falhas não tratadas; `MSM_EXIT_ON_FATAL=1` faz com que ele saia abruptamente para implantações supervisionadas).
9. Inicia serviços em segundo plano: intermediador WS, indexador de armazenamento, watchers de falhas + inventário, agendador,
   ponte de eventos Discord e o **temporizador de manutenção diária** (poda linhas de análise antigas + snapshot
   de `panel.db`).
10. Inicializa o Docker **em segundo plano**. A UI é totalmente utilizável enquanto o daemon está inativo;
    as funcionalidades do Docker aparecem quando ele se torna alcançável. Uma vez conectado, `refreshStatuses({ boot })`
    reconcilia os status em cache, emite um evento único `offline-after-restart` para um servidor que estava
    ativo antes da reinicialização do painel e não será reiniciado, e o loop de inicialização inicia
    servidores `auto_start` mais recupera servidores `auto_restart` encontrados com falha durante a interrupção
    (respeitando o backoff de loop de falha).

> A ordem instrument-antes-de-preflight é um trade-off deliberado: permite que uma futura fiação Sentry
> corrija o tempo de execução primeiro, ao custo de uma mensagem ligeiramente menos amigável em um Node verdadeiramente antigo.

## Pipeline de build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM com code-splitting). `postinstall` executa **apenas CSS**. `public/css/app.css`
e `public/dist/` são artefatos de build ignorados pelo git; o estágio de build do Dockerfile executa o `pnpm run build` completo
e copia `public/` para a imagem de tempo de execução. Ativos estáticos são servidos com cache
`immutable`/longo para arquivos com hash de nome, cache curto para CSS/JS e `no-cache` para HTML e
`/api`.
