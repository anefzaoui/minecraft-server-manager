---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: qual escolher?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge ou Quilt: qual tipo de servidor Minecraft executar, escolhido com base no que seus jogadores instalam.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Voltar ao índice da documentação](/docs/)

Escolha com base no que você quer que os jogadores instalem, não no que parece mais rápido.

| Você quer                                         | Execute isto          | Jogadores instalam |
| ------------------------------------------------- | --------------------- | ------------------ |
| Sobrevivência com amigos, nada incomum            | Vanilla               | Nada               |
| Um servidor público com ranks, claims e moderação | Paper                 | Nada               |
| Um modpack específico da CurseForge ou Modrinth   | O que estiver escrito | O pack             |
| Um modpack moderno que você está construindo      | Fabric ou NeoForge    | Os mesmos mods     |
| Um pack antigo da era 1.7 a 1.12                  | Forge                 | Os mesmos mods     |

Essa é a decisão para a maioria das pessoas. O resto desta página explica o porquê.

## Plugins e mods não são a mesma coisa

Essa é a distinção da qual todo o resto depende.

**Plugins** rodam apenas no servidor. Paper, Spigot e Bukkit os carregam. Os jogadores entram com um cliente comum, não modificado, e nunca sabem. Tudo que é fundamentalmente sobre regras, permissões, economias, claims, minigames ou moderação é um plugin, e é por isso que quase todo servidor público roda Paper.

**Mods** mudam o jogo em si: novos blocos, novas dimensões, novas máquinas. O cliente precisa carregar os mesmos mods que o servidor, ou não conseguirá entender o que o servidor está dizendo. Qualquer um que entre em um servidor modificado instala o pack primeiro.

Um servidor não pode ser significativamente ambos. Projetos híbridos existem que adicionam uma API de plugin a um carregador de mods, e eles funcionam até que não funcionem mais, geralmente no pior momento. Se você precisa de ambos, execute um proxy com um servidor modificado e um servidor de plugins por trás dele, em vez de um híbrido.

## O lado dos plugins

**Paper** é a resposta padrão. É um fork do Spigot com anos de trabalho de performance e um arquivo de configuração para quase todo comportamento que já incomodou um administrador. Plugins Vanilla da era Bukkit ainda rodam na maioria das vezes.

**Purpur** é um fork do Paper com ainda mais opções, incluindo as de jogabilidade. Use-o se quiser essas configurações específicas; caso contrário, use Paper.

**Vanilla** vale a pena rodar quando o objetivo é o jogo inalterado. É mais lento com muitos jogadores e não tem sistema de permissões, então a moderação é manual.

Paper muda alguns comportamentos vanilla por padrão em nome da performance. Se uma engenhoca de redstone de um vídeo não funciona no seu servidor, esse é geralmente o motivo, e geralmente é uma configuração.

## O lado dos mods

**Fabric** é pequeno, atualiza para uma nova versão do Minecraft em dias e carrega a maioria dos mods de performance modernos. Quase todo mod Fabric também quer o Fabric API, que é um download separado. Se seu objetivo é um servidor rápido com alguns mods de qualidade de vida, este é o ideal.

**NeoForge** é onde o antigo ecossistema Forge agora faz seu trabalho para as versões atuais. Ele se separou do Forge durante a 1.20.1, e a maioria dos grandes packs construídos para 1.20.2 e posteriores o têm como alvo. Se você está começando um novo pack pesado hoje, este é o ideal.

**Forge** ainda domina o passado. Qualquer coisa das eras 1.7.10, 1.12.2 e 1.16.5, que é uma grande parte dos packs amados, é Forge e sempre será. Mantenha-o para esses.

**Quilt** é um fork do Fabric que roda a maioria dos mods Fabric. Ele existe por boas razões, mas se você não tem um motivo específico para escolhê-lo, escolha Fabric.

Mods para um carregador não rodam em outro. Uma página de mod que diz Fabric significa Fabric.

## Se você está instalando um pack, o pack decide

Não escolha. O pack lista seu carregador e sua versão exata do Minecraft, e ambos precisam corresponder. "Próximo o suficiente" não existe aqui: um pack para 1.20.1 não roda em 1.20.4, e um pack NeoForge 1.20.1 não roda em Forge 1.20.1.

Instale o pack pelo ID ou link em vez de escolher mods manualmente, e fixe a versão. Packs atualizam, e uma atualização que cai debaixo dos seus pés no meio da temporada é como mundos são corrompidos.

## Qual versão do Java

O requisito do Minecraft se move com o jogo, e rodar a versão errada produz um `UnsupportedClassVersionError` inútil em vez de uma mensagem clara.

| Versão do Minecraft | Java |
| ------------------- | ---- |
| 1.16.5 e anteriores | 8    |
| 1.17                | 16   |
| 1.18 e 1.19         | 17   |
| 1.20 a 1.20.4       | 17   |
| 1.20.5 a 1.21.x     | 21   |
| 26.1 e posteriores  | 25   |

Packs antigos realmente precisam do Java 8; este é um dos poucos lugares em software onde a versão mais nova está errada.

## No Minecraft Server Manager

O assistente de criação pergunta o que você quer rodar e escolhe a versão do Java da tabela acima, então a incompatibilidade nunca acontece por acidente. Vanilla, Paper e Purpur estão na aba **Vanilla**; a aba **De Mods** aceita Fabric, Forge, NeoForge ou Quilt, com a versão do Minecraft e uma build do carregador (a mais recente, ou uma que você fixou). Instalar um pack da CurseForge, Modrinth ou GT New Horizons o fixa em uma versão exata. A atualização só acontece quando você a aplica (ou após a verificação diária, se a política de atualização do servidor for **Atualização Automática**), sempre faz um backup primeiro e pode ser revertida.

O navegador de mods sabe qual carregador um servidor roda e filtra o que ele oferece de acordo, então um jar Fabric não pode cair em um servidor NeoForge por engano.

Relacionado: [criando e gerenciando servidores](/docs/servers/), [modpacks](/docs/modpacks/),
[quanta RAM um servidor precisa](/docs/guide-server-memory/).
