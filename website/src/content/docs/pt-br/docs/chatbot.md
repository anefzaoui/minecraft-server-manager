---
title: 'Chatbot de Minecraft por servidor'
description: 'O painel oferece um chatbot configurado pelo administrador para cada servidor Minecraft gerenciado, configurado na aba Configurações → Chatbot do servidor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Voltar ao índice da documentação](/docs/)

O painel oferece um chatbot configurado pelo administrador para cada servidor Minecraft gerenciado, configurado na aba **Configurações → Chatbot** do servidor. Ele se conecta a um endpoint de chat-completions compatível com OpenAI, incluindo Ollama em outro host da LAN. Cada servidor tem seu próprio endpoint, modelo, nome de invocação, persona, política de transcrição, mensagens de divulgação e política de poder. A invocação padrão é `@wizard`, e a persona padrão demonstra um mago antigo e brincalhão no jogo; ambos são editáveis.

![Configurações do Chatbot](/docs/images/integrations-chatbot.png)

## Experiência do jogador

- Qualquer jogador pode usar `@wizard <mensagem>` (ou a invocação configurada) para conversação e ajuda com receitas vanilla determinísticas e cientes da versão do Minecraft.
- Saudações de entrada e um check-in configurável e único na sessão de jogo lembram os jogadores que o chatbot está disponível. `@wizard chat` abre uma curta janela de conversa opt-in; `@wizard bye` a fecha.
- **Usuários básicos** podem invocar poderes próprios/do mundo habilitados. **Controladores de poder** podem invocar ações validadas separadamente que afetam outro jogador online. Jogadores em nenhum dos grupos permanecem apenas na conversa.
- Presentes próprios de usuários básicos usam uma lista de permissão de itens. Controladores podem dar a outro jogador qualquer item vanilla ou modificado válido e com namespace, sujeito ao limite de quantidade e outras salvaguardas de poder.

![Transcrições do Chatbot](/docs/images/chatbot-transcripts.png)

## Design e segurança

A configuração e as transcrições são apenas para administradores. O modelo nunca recebe RCON bruto ou execução de comando arbitrária. Uma mensagem expõe apenas a única ferramenta fixa que corresponde à sua intenção explícita; o código do servidor valida autorização, argumentos, sinalizadores, quantidades, tempos de recarga e nomes exatos de jogadores online antes de executar uma operação de serviço existente. Seletores do Minecraft são rejeitados, ações entre jogadores não podem ter como alvo o chamador, os poderes começam em modo de simulação (dry-run) e cada poder tentado é auditado. Modelos de chamada de ferramenta não suportados voltam para conversação apenas.

As respostas são limitadas para o chat do Minecraft. Receitas vanilla conhecidas vêm de dados de receitas versionados incluídos e são renderizadas como linhas estáveis de 2x2/3x3; o LLM não é confiável para inventar layouts de receita. Receitas desconhecidas ou modificadas direcionam o jogador para JEI/REI em vez de fabricar uma resposta.

## Arquivos principais de implementação

- `src/services/wizard.js`: configuração por servidor, requisições compatíveis com OpenAI, tratamento de chat, divulgação, retenção de transcrições e limites de resposta.
- `src/services/wizardPowers.js`: verificações de função, esquemas de ferramentas específicos de intenção, validação, execução, tempos de recarga e auditoria de poder.
- `src/services/wizardRecipes.js`: consulta determinística de receitas versionadas e formatação de grade. Dados de receitas e itens vêm do pacote incluído [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Um rascunho anterior deste documento apontava para uma pasta `src/data/recipes/` que nunca foi commitada; não existe tal pasta, e os dados vivem no pacote. Veja "Pegada de dependência".)
- `src/analytics/ingest.js`: encaminha joins, saídas e chat de jogadores analisados para o chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` e `views/partials/server/integrations.hbs` (via `chatbot.hbs`): API de administrador e a aba Configurações → Chatbot por servidor.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js` e `019_wizard_power_controllers.js`: esquema persistente.
- `test/wizard.test.js`: testes de autorização, limites de ferramenta, retenção, divulgação e comportamento de chat.

Os nomes internos de rota/módulo/tabela `wizard` são mantidos para compatibilidade de atualização e API; "chatbot" é o termo do produto voltado para o usuário. Da mesma forma, o campo armazenado `power_testers_json` corresponde ao grupo **Usuários básicos** da interface do usuário.

## Pegada de dependência (`minecraft-data`)

A ajuda de receitas usa o pacote `minecraft-data`. Ele é grande em disco (cerca de 429 MB instalado) e é incluído na imagem de produção porque é uma dependência de tempo de execução, não de desenvolvimento. Estamos mantendo-o de propósito para que a ajuda de receitas funcione offline para todas as versões do Minecraft sem chamadas de rede.

Notas para quem olhar isso a seguir (humano ou IA), para que o tamanho não seja uma surpresa:

- Apenas os dados Java (`pc`) são usados no momento. `wizardRecipes.js` lê `minecraftData.versions.pc` e as tabelas `recipes`, `items` e `blocks` por versão. Os arquivos que ele realmente toca somam aproximadamente 15 MB em todas as versões de pc.
- Cerca de 330 MB do pacote é `data/bedrock`, e nada aqui o lê ainda. Estamos deixando-o no lugar de propósito. Se o painel adicionar suporte ao Bedrock Minecraft no futuro, os dados de receitas e itens do Bedrock já estarão aqui, então o recurso de receitas poderá crescer para cobrir servidores Bedrock sem adicionar uma nova dependência. Comece em `minecraftData.versions.bedrock` e siga o mesmo formato do caminho de pc.
- Se o tamanho precisar ser reduzido antes que o suporte ao Bedrock chegue, já existe um padrão para isso neste repositório. `src/services/itemRegistry.js` busca arquivos `minecraft-data` do CDN jsDelivr quando precisa deles e os armazena em cache em `api_cache`. Essa abordagem, ou um pequeno subconjunto escolhido a dedo de `src/data/recipes/` cobrindo algumas versões comuns, reduziria muito a imagem.

## Armazenamento local e inspeção manual

Todas as configurações e transcrições retidas ficam no banco de dados SQLite do painel em `/data/panel.db` dentro do contêiner do painel. Com a montagem Compose padrão, o caminho do host é `${DATA_DIR_HOST}/panel.db` (por exemplo, `/opt/msm/data/panel.db`). As tabelas relevantes são `wizard_configs`, `wizard_transcripts` e `wizard_outreach`; auditorias de poder são linhas na tabela `events` com o tipo `wizard-power`. A chave de API LLM opcional é criptografada com AES-256-GCM com a chave em repouso do painel, `.secret-key` na pasta de dados (separada de `SESSION_SECRET`).

Faça backup do banco de dados e pare o painel antes de edições diretas do SQLite para que seu WAL seja tratado com segurança. Usar a UI/API do administrador é preferível porque aplica validação e criptografia. Mantenha os arquivos `panel.db`, `panel.db-wal` e `panel.db-shm` juntos ao copiar um banco de dados ativo.
