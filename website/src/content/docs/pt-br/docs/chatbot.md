---
title: 'Chatbot por servidor Minecraft'
description: 'Este fork adiciona um chatbot configurado pelo administrador a cada servidor Minecraft gerenciado.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Voltar ao índice de docs](/docs/)

Este fork adiciona um chatbot configurado pelo administrador a cada servidor Minecraft gerenciado. Ele se conecta a um endpoint de chat-completions compatível com OpenAI, incluindo Ollama em outro host da LAN. Cada servidor tem seu próprio endpoint, modelo, nome de invocação, persona, política de transcrição, mensagens de divulgação e política de poderes. A invocação padrão é `@wizard`, e a persona padrão demonstra um mago antigo e brincalhão no jogo; ambos são editáveis.

![Configurações do Chatbot](/docs/images/integrations-chatbot.png)

## Experiência do jogador

- Qualquer jogador pode usar `@wizard <mensagem>` (ou a invocação configurada) para conversação e ajuda determinística com receitas vanilla, ciente da versão do Minecraft.
- Saudações de entrada e um check-in único configurável na sessão de jogo lembram os jogadores que o chatbot está disponível. `@wizard chat` abre uma curta janela de conversa opt-in; `@wizard bye` a fecha.
- **Usuários básicos** podem invocar poderes próprios/do mundo habilitados. **Controladores de poder** podem invocar ações separadamente validadas que afetam outro jogador online. Jogadores em nenhum dos grupos permanecem apenas para conversação.
- Auto-presentes de usuários básicos usam uma lista de permissão de itens. Controladores podem dar a outro jogador qualquer item vanilla ou modificado válido com namespace, sujeito ao limite de quantidade e outras salvaguardas de poder.

![Transcrições do Chatbot](/docs/images/chatbot-transcripts.png)

## Design e segurança

Configuração e transcrições são apenas para administradores. O modelo nunca recebe RCON bruto ou execução de comando arbitrária. Uma mensagem expõe apenas a única ferramenta fixa que corresponde à sua intenção explícita; o código do servidor valida autorização, argumentos, flags, quantidades, cooldowns e nomes exatos de jogadores online antes de executar uma operação de serviço existente. Seletores do Minecraft são rejeitados, ações entre jogadores não podem ter como alvo o chamador, poderes começam em modo de simulação (dry-run) e cada poder tentado é auditado. Modelos de chamada de ferramenta não suportados voltam para conversação apenas.

Respostas são limitadas para o chat do Minecraft. Receitas vanilla conhecidas vêm de dados de receita versionados empacotados e são renderizadas como linhas estáveis 2x2/3x3; o LLM não é confiável para inventar layouts de receita. Receitas desconhecidas ou modificadas direcionam o jogador para JEI/REI em vez de fabricar uma resposta.

## Arquivos principais de implementação

- `src/services/wizard.js`: configuração por servidor, requisições compatíveis com OpenAI, tratamento de chat, divulgação, retenção de transcrições e limites de resposta.
- `src/services/wizardPowers.js`: verificações de função, esquemas de ferramentas específicos de intenção, validação, execução, cooldowns e auditoria de poder.
- `src/services/wizardRecipes.js`: consulta determinística de receita versionada e formatação de grade. Dados de receita e itens vêm do pacote empacotado [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Um rascunho anterior deste documento apontava para uma pasta `src/data/recipes/` que nunca foi commitada; não existe tal pasta, e os dados residem no pacote. Veja "Pegada de dependência".)
- `src/analytics/ingest.js`: encaminha joins, saídas e chat de jogadores analisados para o chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` e `views/partials/server/integrations.hbs`: API de administrador e UI de Integrações por servidor.
- `src/db/migrations/011_wizard_chat.js` a `019_wizard_power_controllers.js`: esquema persistente.
- `test/wizard.test.js`: testes de autorização, limites de ferramenta, retenção, divulgação e comportamento de chat.

Os nomes internos de rota/módulo/tabela `wizard` são mantidos para compatibilidade de atualização e API; "chatbot" é o termo do produto voltado para o usuário. Da mesma forma, o campo armazenado `power_testers_json` mapeia para o grupo **Usuários básicos** da UI.

## Pegada de dependência (`minecraft-data`)

A ajuda de receita usa o pacote `minecraft-data`. Ele é grande em disco (cerca de 429 MB instalado) e é enviado dentro da imagem de produção porque é uma dependência de tempo de execução, não de desenvolvimento. Estamos mantendo-o de propósito para que a ajuda de receita funcione offline para todas as versões do Minecraft sem chamadas de rede.

Notas para quem olhar isso a seguir (humano ou IA), para que o tamanho não seja uma surpresa:

- Apenas os dados Java (`pc`) são usados no momento. `wizardRecipes.js` lê `minecraftData.versions.pc` e as tabelas `recipes`, `items` e `blocks` por versão. Os arquivos que ele realmente toca somam aproximadamente 15 MB em todas as versões de pc.
- Cerca de 330 MB do pacote é `data/bedrock`, e nada aqui o lê ainda. Estamos deixando-o no lugar de propósito. Se o painel algum dia adicionar suporte ao Minecraft Bedrock, os dados de receita e itens do Bedrock já estarão aqui, então o recurso de receita pode crescer para cobrir servidores Bedrock sem adicionar uma nova dependência. Comece em `minecraftData.versions.bedrock` e siga a mesma estrutura do caminho de pc.
- Se o tamanho tiver que ser reduzido antes que o suporte ao Bedrock chegue, já existe um padrão para isso neste repositório. `src/services/itemRegistry.js` busca arquivos `minecraft-data` do CDN jsDelivr quando precisa deles e os armazena em cache em `api_cache`. Essa abordagem, ou um pequeno subconjunto escolhido a dedo de `src/data/recipes/` cobrindo algumas versões comuns, reduziria muito a imagem.

## Armazenamento local e inspeção manual

Todas as configurações e transcrições retidas residem no banco de dados SQLite do painel em `/data/panel.db` dentro do contêiner do painel. Com a montagem Compose padrão, o caminho do host é `${DATA_DIR_HOST}/panel.db` (por exemplo, `/opt/msm/data/panel.db`). As tabelas relevantes são `wizard_configs`, `wizard_transcripts` e `wizard_outreach`; auditorias de poder são linhas na tabela `events` com o tipo `wizard-power`. A chave de API LLM opcional é criptografada com AES-256-GCM usando o `SESSION_SECRET` do painel, normalmente persistido como `${DATA_DIR_HOST}/.session-secret`.

Faça backup do banco de dados e pare o painel antes de editar o SQLite diretamente para que seu WAL seja tratado com segurança. Usar a UI/API do administrador é preferível porque aplica validação e criptografia. Mantenha os arquivos `panel.db`, `panel.db-wal` e `panel.db-shm` juntos ao copiar um banco de dados ativo.
