---
title: 'Arquitetura'
description: 'Minecraft Server Manager é uma aplicação Node.js renderizada no servidor, de processo único.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Voltar ao índice da documentação](/docs/)

Minecraft Server Manager é uma aplicação Node.js renderizada no servidor, de processo único. Ela gerencia
servidores Minecraft que rodam como contêineres Docker usando a imagem
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicando-se com o
daemon Docker via sua API (nunca executando o CLI `docker` externamente).

## Estrutura de tempo de execução

- **Express + Handlebars** renderizam páginas no lado do servidor. Não há SPA; o JavaScript do navegador em `public/js/`
  é uma melhoria progressiva escrita manualmente. Um passo de esbuild (`pnpm run build:js`) o agrupa e
  minifica em `public/dist/js/`; o aplicativo serve esse bundle quando ele está presente e o código-fonte bruto caso contrário,
  então uma execução de desenvolvimento sem build ainda funciona.
- **`node:sqlite`** (embutido no Node; o painel requer Node ≥ 24) é o banco de dados - síncrono,
  zero módulos nativos, modo WAL. Um pequeno executor de migrações versionadas aplica `src/db/migrations/*` na
  inicialização. Declarações preparadas são cacheadas em `src/db/index.js` com chave pelo texto SQL.
- **`ws`** carrega os fluxos de console e estatísticas ao vivo. Ambos são **intermediados**: um upstream
  `docker logs --follow` (ou `docker stats`) por servidor, desmultiplexado uma vez e distribuído para cada
  aba conectada, em vez de um upstream por visualizador. O intermediador de console mantém um pequeno buffer de repetição
  para abas que entram atrasadas e descarta um assinante cujo socket fica muito para trás em vez de
  atrasar o fluxo compartilhado.
- **`dockerode`** é a única forma como o aplicativo se comunica com o Docker. O endpoint é detectado automaticamente por plataforma
  (pipe nomeado do Windows vs. socket Unix).
- **Todo o estado persistente vive em um único diretório** (`$DATA_DIR`, padrão `./data`). Copiar esse
  diretório migra o painel inteiro.

## Camadas

As dependências fluem em uma única direção:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   analisa e valida a entrada, molda as respostas
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

- **`web/routes/`** - um roteador por domínio (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` monta os de nível superior (`api.js`, a API JSON de sessão que também contém as rotas principais do servidor
  e monta os roteadores de domínio por servidor; `index.js`, as páginas; `auth`, `account`,
  `tasks`, …). Os roteadores validam com zod, chamam um serviço e retornam JSON
  ou renderizam uma visualização. A lógica de negócios não pertence aqui. Dois roteadores são montados na **zona pública
  **, antes de `requireAuth`: `routes/status.js` (páginas de status por servidor opcionais) e
  `routes/apiV1.js` (`/api/v1`, uma API JSON somente leitura autenticada por um token Bearer emitido pelo admin
  de `services/apiTokens.js`, desativada a menos que habilitada em Configurações; veja `docs/public-api.md`).
- **`services/`** - o coração do aplicativo. Cada serviço possui um domínio e pode depender de
  infraestrutura e de outros serviços.
- **`docker/`** - wrappers do dockerode: `connect` (detecção de endpoint + saúde do daemon), `containers`
  (criar/iniciar/parar/recriar com bind mounts, limites de memória/CPU e rótulos), `logs`, `stats`,
  `images`, `networks` (descoberta de rede do host), `hostPath` (re-raiz de caminhos de bind sob
  `DATA_DIR_HOST`), e um `watcher` que transforma eventos Docker em histórico + detecção de falhas.
- **`db/`** - o wrapper SQLite e o executor de migrações.
- **`storage/`** - o bootstrap `./data`, o **guardião de caminhos** (`safeJoin`, a espinha dorsal de segurança de arquivos),
  e o indexador de tamanho em segundo plano + aplicação de cotas.

Transversal:

- **`config/`** - configuração de ambiente mais o **catálogo de campos**: a única fonte de verdade para
  configurações do servidor. Cada variável de ambiente itzg é catalogada (rótulo, ajuda, tipo, unidade, padrão,
  validação, seção, flags de perigo). O assistente, os formulários de configurações e a validação zod são todos derivados
  dele, então expor uma nova configuração é uma mudança de dados, não uma nova infraestrutura de UI.
- **`events/`** - `recordEvent()` é o único ponto de entrada para o log de histórico; eventos de ciclo de vida também
  capturam trechos de logs de contêineres para `data/logs/<id>/events/`.
- **`ws/`** - WebSockets de console + estatísticas autenticados (cookie de sessão verificado no upgrade, `Origin`
  verificado para bloquear sequestro entre sites), intermediados por servidor (veja "Estrutura de tempo de execução").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` retorna um logger [Pino](https://getpino.io) por módulo;
  nível de `LOG_LEVEL`, `makeFailureThrottle()` mantém um loop em segundo plano persistentemente falhando em uma linha de log
  mais uma linha "recuperada".
  `src/utils/logSanitize.js` reda a chave com formato de credenciais e tokens de webhook dos metadados estruturados;
  `src/config/logLevel.js` é a lista de permissões de nível compartilhada (mantida separada para evitar um ciclo de require com
  `config`). `src/instrument.js` é uma costura Sentry dormente, carregada primeiro em
  `src/server.js`. `src/web/middleware/requestLog.js` escreve uma linha de log de acesso por requisição
  (pulando `/healthz` e ativos estáticos). ESLint impõe `no-console` em `src/**`, com
  `preflight.js`, `instrument.js`, e `config/index.js` isentos (eles rodam antes do logger existir).
- **Limitação de taxa** - `src/web/middleware/rateLimit.js` coloca `express-rate-limit` na frente de `/api`
  (`RATE_LIMIT_API_PER_MIN`, padrão 1200) e os POSTs de login / 2FA / configuração
  (`RATE_LIMIT_AUTH_PER_15MIN`, padrão 100); `0` desativa um limitador. Ele usa `req.ip` como chave, então
  `TRUST_PROXY` importa atrás de um proxy. `/api/v1` tem seus próprios limitadores: um limite por IP de cliente
  (cinco vezes o orçamento por token) que roda antes que o token seja verificado, depois um orçamento por token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, padrão 120) com chave no ID do token verificado. Um
  contador suave separado por conta em
  `src/web/middleware/auth.js` lida com o bloqueio de login (por IP e global da conta, decaindo).
- **Autorização**: duas camadas. A função global (`requireAuth` → `requireRole` / `requireWrite` em
  `src/web/middleware/auth.js`) controla ações em todo o painel e é o padrão em todos os servidores. Permissões por servidor
  (`src/services/permissions.js`, nove capacidades armazenadas como uma lista JSON por
  `(usuário, servidor)` em `user_server_permissions`) refinam esse padrão para um servidor; cada
  rota `/api/servers/:id`, montagem de sub-roteador, página, WebSocket e listagem em toda a frota passam por
  `src/web/middleware/serverAccess.js` (`serverScope`, montado no prefixo `/servers/:id` da API e do roteador de páginas,
  esconde um servidor sem `view` como um 404; `requireCap(cap)` nomeia a capacidade que uma rota precisa). Escritas que nomeiam
  seu servidor no corpo (agendamentos, extração e instalação de mundo, exportação de blueprint) são abertas para visualizadores por
  `requireWrite` apenas para aquele servidor, e cada rota dessas verifica a capacidade em si.
  `test/permissions-routes.test.js` percorre as pilhas de roteadores ao vivo e falha se uma rota de escrita com escopo de servidor,
  montagem ou página não tiver um portão.

## Comportamentos chave de domínio

- **Modpacks são sempre fixados.** A imagem atualiza automaticamente packs não fixados a cada reinicialização, então o
  painel resolve "latest" para um ID de versão concreto no momento da instalação e o fixa. Atualizações são um
  fluxo orquestrado explícito (`updates/`): pré-visualização → backup pré-atualização → parada graciosa → re-fixação →
  recriação → monitor de saúde → rollback com um clique.
- **A sobreposição de mods personalizados** é gerenciada pelo painel: mods adicionados pelo usuário vão para a biblioteca deduplicada
  e são hard-linked no servidor para que sobrevivam às atualizações do pack. Desabilitar é ciente da classe. Como
  a biblioteca mantém cada build que baixou, uma atualização registra o build que substituiu
  (`server_content.previous_*`) e pode ser revertida apenas a partir de arquivos locais. Desabilitar um mod do pack
  escreve a variável de ambiente de exclusão do pack em vez disso; `packs.applyPack` carrega isso e o restante do
  ajuste do pack (`PACK_TUNING_KEYS`) durante uma mudança de versão do mesmo pack, e o descarta quando o pack muda.
- **Uma atualização de versão do Minecraft tem que ser conquistada.** `services/compat.js` escaneia os mods de um servidor -
  resolvidos a partir de linhas instaladas pelo painel, depois do manifesto do pack CurseForge, depois por hash de conteúdo
  contra Modrinth/CurseForge - e constrói uma matriz de suporte (loader, versão Minecraft) por projeto
  a partir dos `latestFilesIndexes` do CurseForge (200 projetos por requisição) e da lista de versões por projeto do Modrinth
  (uma requisição por projeto, que é o que mantém o loader e a versão pareados). O verificador de atualizações oferece apenas a versão mais recente que CADA mod suporta, e não oferece nada quando a resposta não pode ser estabelecida: sem escaneamento, um escaneamento para uma versão ou loader diferente, um que nunca terminou, ou um jar que nenhum dos registros reconhece. Escaneamentos são manuais apenas, e seu progresso e resultados parciais vivem em `version_compat` (não no `services/tasks.js` em memória), então uma atualização ou reinicialização do painel retoma em vez de travar em um spinner; `reconcileScans()` marca escaneamentos órfãos por um desligamento na próxima inicialização.
- **A versão do mod loader é um pin, como tudo mais.** `services/loaderPin.js` lê o build instalado do próprio manifesto de instalação da imagem (`.forge-manifest.json` e similares) e escreve o pin: a variável itzg do loader em um servidor simples (`FORGE_VERSION`, …), ou
  `CF_MOD_LOADER_VERSION` em um pack CurseForge Forge ou Fabric, que substitui a versão que o pack declara. O instalador CurseForge da imagem ignora essa substituição para NeoForge, e packs Modrinth e FTB não têm nenhuma, então seu loader segue o pack. `packs.applyPack` remove todas as variáveis `CF_` em uma atualização ou rollback de pack, que descarta uma substituição com o restante. Um build tipado é verificado contra a lista completa do registro primeiro (`services/loaderVersions.js`; o do Forge vem de seus metadados maven, que pula números; uma falha é re-verificada uma vez contra o próprio registro), então a mudança é backup → pin (sobre o env como está após o backup) → reconstrução.
- **Portas** são alocadas a partir de um esquema base (jogo a partir de `PORT_GAME_START` para cima, RCON = jogo +
  `PORT_RCON_OFFSET`, Bedrock a partir de `PORT_BEDROCK_START`), sondadas quanto à disponibilidade e reservadas no
  DB. "Ocupado" é a união das reivindicações de cada servidor (portas ao vivo, mais um par pendente abaixo),
  cada porta do host que qualquer contêiner Docker publica (`containers.publishedHostPorts`: ligações ao vivo de contêineres em execução mais as configuradas de cada contêiner parado, porque uma sonda de bind do SO de dentro do próprio contêiner do painel vê apenas o namespace de rede desse contêiner), e a sonda do SO. A parte Docker é cacheada por 3 s e limitada: uma lista que não responde em 2.5 s descarta apenas a parte Docker, e um `inspect` lento custa apenas as portas desse contêiner. Criações de servidor e `servers.changeGamePort` escolhem portas através de uma única cadeia de serialização que cobre apenas a escolha e sua reivindicação (a escrita da linha para uma criação, a reserva em memória para uma mudança de porta);
  o seletor de portas do BlueMap e as substituições de porta extra não estão nele e não
  consultam o Docker. Uma mudança de porta em um servidor existente (`servers.changeGamePort`, sob o
  lock de operação do servidor) é aplicada de uma vez, porque o Docker corrige as ligações de porta na criação do contêiner:
  o novo par (RCON sempre jogo + `PORT_RCON_OFFSET`) é verificado e reservado em memória
  (`ports.reserve`, tanto o par antigo quanto o novo, honrados por cada outra escolha) sob o lock de porta. É recusado (409 `PENDING_CHANGES`) enquanto outras configurações esperam por uma reconstrução, então ele apenas reconstrói um contêiner que já rodou, em uma nova porta; e um servidor em execução só é alterado quando a requisição diz `restart: true` (caso contrário, 409 `NEEDS_CONFIRM`). A imagem é baixada e um nome de contêiner personalizado é verificado antes que qualquer coisa seja tocada. Um servidor em execução é parado; então o novo par é escrito com `pending_recreate = 1` (então uma falha do painel a partir daí deixa um "rebuild pendente" honesto), o contêiner é removido, reconstruído no novo par e iniciado. Se qualquer passo após a parada falhar, `putBackOnOldPort` escreve o par antigo de volta, reconstrói (e reinicia, se estava em execução) nele e registra qual passo falhou; o histórico e os alertas dizem se mesmo isso falhou, o que deixa o servidor parado até que alguém o inicie. A capacidade `settings` é suficiente, incluindo o servidor em execução. Não administradores só podem escolher a partir de `PORT_GAME_START` para cima.
  (As colunas `port_*_pending` da migração 029 pertencem a um design anterior, não lançado, e são
  não utilizadas; 031 as limpa.) Uma colisão de lock responde 409 com `code: 'BUSY'`, que os chamadores que tentam novamente
  verificam em vez da mensagem. Uma reinicialização automática após falha
  (`watcher.restartAfterCrash`) e um backup ou início agendado (`scheduler.runTaskWithRetry`)
  que encontram o servidor ocupado com outra ação tentam novamente a cada 20 s / 60 s por até 30 minutos,
  e uma atualização ou rollback de pack tenta novamente seus passos bloqueados da mesma forma (`opLock.retryWhileBusy`);
  uma reinicialização após falha ou um início agendado em espera desiste assim que alguém parou, matou ou
  iniciou o servidor desde (`events.lifecycleActionSince`), e a reinicialização após falha também quando
  a reinicialização automática está desativada ou o servidor desapareceu. Reinicializações, paradas e comandos agendados não são
  retentados, e um agendamento cuja última execução ainda está esperando pula seu próximo disparo.
- **Cotas de disco** são aplicadas pelo painel porque o Docker não pode limitar o uso de bind-mount: o indexador
  armazena em cache tamanhos por diretório e operações de crescimento de disco são controladas por eles.
- **Segredos** (senhas RCON, chaves de API, segredos TOTP, URL do webhook Discord) são criptografados em repouso
  com AES-256-GCM usando uma chave aleatória dedicada em `$DATA_DIR/.secret-key` (modo `0600`,
  gerada automaticamente). É independente de `SESSION_SECRET`; uma chave derivada de `SESSION_SECRET` é mantida como
  fallback apenas para descriptografia para valores escritos antes que a chave dedicada existisse, e
  `src/services/secretsMigration.js` re-criptografa esses sob a chave dedicada uma vez na inicialização.
  Um `.secret-key` que existe mas não pode ser analisado é um erro de inicialização grave (ele nunca é silenciosamente
  regenerado por cima). Blueprints removem todos os segredos na exportação.
- **`server.properties` é de propriedade do painel, mas ofuscado pelo env.** A imagem itzg reafirma cada
  propriedade baseada em env a cada início (`OVERRIDE_SERVER_PROPERTIES` padrão true), então um valor que
  o painel edita diretamente - PvP/dificuldade do World Controls, o toggle de whitelist, o editor de Arquivos -
  seria silenciosamente revertido no próximo início, a menos que a variável de ambiente correspondente seja removida e o
  contêiner recriado. Cada escrita direta de propriedade passa por `writeServerProperties()` (arquivo inteiro)
  ou `setServerProperty()` (uma chave) em `src/services/servers.js`, que reescrevem atomicamente
  o arquivo, desdefinem a variável de ambiente por trás de cada chave alterada (via o atributo `prop:` nos campos do catálogo
  , verificado em testes contra as próprias definições de propriedade da imagem), e marcam
  `pending_recreate`. A dificuldade é escrita no arquivo, bem como enviada via RCON, porque um servidor dedicado
  reaplica a propriedade `difficulty` a cada inicialização. O próprio Minecraft ressalva
  server.properties de seus valores de inicialização em `whitelist on/off`, o que desfaria edições feitas
  enquanto o servidor está em execução, então o toggle de whitelist em execução captura o arquivo primeiro e o reescreve
  com apenas `white-list` alterado. O env
  vars permanecem totalmente configuráveis na criação (o assistente os renderiza e eles se aplicam uma vez); eles apenas
  desfixam na primeira vez que o painel edita a propriedade subjacente. MOTD tem o mesmo contrato: uma edição direta
  do arquivo `motd` o desdefine, então a última escrita vence.

## Formatos de dados e de comunicação

- **`data/panel.db`** - o banco de dados SQLite. Snapshotted diariamente via `VACUUM INTO` para
  `data/backups/_panel/` (os 14 mais recentes mantidos); `PRAGMA integrity_check` roda na inicialização.
- **`data/.session-secret`** - o segredo de assinatura de cookie gerado automaticamente, criado na primeira execução se
  `SESSION_SECRET` não estiver definido. Deletá-lo rotaciona o segredo (o que invalida sessões).
- **`data/.secret-key`** - a chave de criptografia dedicada de 32 bytes em repouso (modo `0600`), criada automaticamente
  na primeira execução. Independente de `SESSION_SECRET`; deletá-lo torna todas as credenciais armazenadas
  indecriptografáveis, então pertence aos seus backups.
- **Blueprints (`.mcserver.zip`)** - um zip com um `manifest.json` descrevendo configuração, recursos, a
  referência do pack fixado, o manifesto da sobreposição (URLs de origem + sha256), arquivos de configuração escolhidos e
  opcionalmente um mundo. A importação re-baixa e verifica o hash de cada mod e atribui novas portas.
- **Contêineres Docker** criados pelo painel são nomeados e rotulados para que o watcher possa encontrá-los;
  o painel possui todo o seu ciclo de vida.

## Sequência de inicialização

1. `require('./instrument')` (a costura Sentry) antes de qualquer outra coisa, depois `require('./preflight')`
   para falhar claramente em uma versão Node não suportada.
2. Carrega a configuração; garante/gera `.session-secret` **e** `.secret-key`.
3. `ensureDataRoot()` - cria o layout `./data`, limpa `tmp/`.
4. Executa migrações do DB, depois `PRAGMA integrity_check` (loga ruidosamente, aponta para `data/backups/_panel`
   em caso de falha).
5. Re-criptografa quaisquer segredos legados com chave `SESSION_SECRET` sob `.secret-key` (`secretsMigration`).
6. Importa chaves de API do ambiente uma vez (`apiKeys.importFromEnvOnce()`), fixa qualquer servidor que ainda
   esteja carregando um seletor de modpack não fixado (`packPins.pinUnpinnedServers()`), marca escaneamentos de compatibilidade de versão deixados em execução por um processo anterior como interrompidos
   (`compat.reconcileScans()`), então semeia blueprints iniciais (protegido).
7. Inicia o servidor HTTP + WS. Em um bind exposto, imprime o PIN `/setup` da primeira execução.
8. Instala o guardião de tempo de execução pós-inicialização (captura falhas não tratadas; `MSM_EXIT_ON_FATAL=1` faz com que ele saia abruptamente para implantações supervisionadas).
9. Inicia serviços em segundo plano: intermediador WS, indexador de armazenamento, watchers de falha + inventário, agendador,
   ponte de eventos Discord, watcher de alcance de chatbot e o **temporizador de manutenção diária** (poda linhas antigas de análise, transcrições de chatbot, histórico de eventos (365 dias) e linhas de cache de API, então tira um snapshot de
   `panel.db`).
10. Inicializa o Docker **em segundo plano**. A UI é totalmente utilizável enquanto o daemon está inativo;
    as funcionalidades do Docker são ativadas quando ele se torna alcançável. Uma vez conectado, `refreshStatuses({ boot })`
    reconcilia os status em cache, emite um evento único `offline-after-restart` para um servidor que estava ativo antes da reinicialização do painel e não será trazido de volta, e o loop de inicialização inicia
    servidores `auto_start` mais recupera servidores `auto_restart` encontrados com falha durante a interrupção
    (respeitando o backoff de loop de falha).

> A ordem instrument-antes-de-preflight é um trade-off deliberado: permite que uma futura fiação Sentry
> corrija o tempo de execução primeiro, ao custo de uma mensagem ligeiramente menos amigável em um Node verdadeiramente antigo.

## Pipeline de build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM com code-splitting). `postinstall` executa **apenas CSS**. `public/css/app.css`
e `public/dist/` são artefatos de build ignorados pelo git; o estágio de build do Dockerfile executa o `pnpm run build` completo
e copia `public/` para a imagem em tempo de execução. Ativos estáticos são servidos
`immutable`/cache longo para arquivos com fingerprint, cache curto para CSS/JS, e `no-cache` para HTML e
`/api`.
