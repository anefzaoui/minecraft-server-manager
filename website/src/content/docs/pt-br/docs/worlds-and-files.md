---
title: 'Mundos e arquivos'
description: 'A página Mundos gerencia os dados do mundo em seus servidores: troque o mundo ativo, envie um mundo ou baixe um.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Voltar ao índice de docs](/docs/)

## Mundos

A página **Mundos** gerencia os dados do mundo em seus servidores: troque o mundo ativo, envie um mundo ou baixe um.

![Mundos](/docs/images/worlds.png)

## O gerenciador de arquivos

Sob a seção **Mundo** de um servidor, a aba **Arquivos** é um gerenciador de arquivos completo no navegador para o diretório de dados desse servidor. Liste, leia, edite, crie, renomeie, mova, copie, exclua e envie arquivos: tudo o que você normalmente faria via SSH, pelo navegador.

![Gerenciador de arquivos](/docs/images/server-files.png)

Arquivos de texto abrem em um editor com um limite de 2 MB; arquivos maiores podem ser baixados. Uploads aceitam múltiplos arquivos de uma vez.

### Permanecendo dentro da sandbox

Toda operação de arquivo é restrita ao próprio diretório de dados do servidor. O painel resolve cada caminho e recusa qualquer coisa que escape: travessia `..`, caminhos absolutos e até mesmo links simbólicos que apontam para fora do diretório (incluindo os pendentes que ainda não existem). Um mod ou plugin não pode plantar um link para enganar o gerenciador de arquivos a ler ou escrever em outro lugar no host.

## Mods

Para servidores com mods, a aba **Mods** (seu próprio grupo na barra lateral do servidor) gerencia o conjunto de mods: navegue e adicione mods, e veja o que está instalado. Atualizações de mods e pacotes aparecem na página [Atualizações](/docs/updates/).

### Adicionando mods

![Mods](/docs/images/mods.png)

Quatro maneiras de adicionar, todas a partir da barra de ferramentas da aba Mods:

- **Pesquisar mods** - pesquise em **Modrinth ou CurseForge** (o chip CurseForge aparece assim que uma chave de API é armazenada em Configurações → Chaves de API), e em servidores de plugins também **Hangar** (o registro de plugins do PaperMC) e **SpigotMC** (via proxy CDN do Spiget) - ambos sem necessidade de chave. Tudo é filtrado para o loader e a versão do Minecraft do servidor; servidores Quilt automaticamente veem builds com tag fabric também, já que Quilt executa mods Fabric. Resultados já no servidor mostram um selo **Instalado**. Se um autor da CurseForge proibir downloads automatizados - ou um recurso SpigotMC for hospedado externamente - o painel informa isso claramente e oferece um caminho **Abrir página** + **Enviar jar** em vez de falhar no meio da instalação.

  ![Pesquisa Hangar](/docs/images/mods-search-hangar.png)

- **Importar zip** - um botão, três formatos, auto-detectados:
  - Um **Modpack Modrinth (`.mrpack`)**: cada arquivo fixado é canonizado de volta ao seu projeto Modrinth via lookup de hash (assim, mods importados mantêm nomes reais, ícones e permanecem verificáveis para atualização; arquivos que o Modrinth não conhece são instalados a partir da URL própria do pack), verificado contra os checksums sha512 do pack durante o download, e pré-visualizado com vereditos de adequação. Arquivos apenas para cliente são pulados visivelmente, e ambas as árvores de sobrescrita (`overrides/`, depois `server-overrides/` - a cópia específica do servidor vence) podem ser aplicadas.

    ![Importação mrpack](/docs/images/mrpack-import.png)

  - Uma **exportação de modpack CurseForge** (o zip que o aplicativo CurseForge produz, com `manifest.json`): cada mod fixado é resolvido em massa, pré-visualizado com avisos (loader/MC errado para este servidor, arquivos não mais na CurseForge, mods que precisam de download manual), e instalado com progresso real. Os `overrides/` do pack (configs, scripts) podem opcionalmente ser aplicados também - qualquer arquivo que seria sobrescrito é primeiro copiado de volta para `.import-backups/<timestamp>/` dentro da pasta do servidor.
  - Um **zip simples de jars** que você coletou: cada jar é identificado (correspondência de hash Modrinth → impressão digital CurseForge → metadados do próprio jar) e julgado contra o servidor - _adequado / loader errado / versão MC errada / já instalado / não identificado_ - para que você escolha o que realmente pertence antes que qualquer coisa seja instalada.
- **Adicionar por link** - cole quase qualquer coisa: páginas de projeto Modrinth, CurseForge, Hangar ou SpigotMC, uma URL de repositório ou release do GitHub (um simples `owner/repo` também funciona - instalações GitHub preferem a release estável mais recente e pulam jars `-sources`/`-javadoc` laterais), um slug Modrinth simples, ou qualquer URL direta de `.jar`. O painel resolve o build correto para o loader e a versão MC do servidor.

  ![Adicionar por link](/docs/images/mods-add-by-link.png)

- **Enviar jar** (da fallback de pesquisa ou do resolvedor de downloads pendentes) - jars enviados são identificados da mesma forma, então mantêm seu nome real, versão, ícone e se tornam verificáveis para atualização.

Cada instalação de registro é **verificada por checksum durante o download**: o stream é verificado contra o digest mais forte que o registro publica (sha512 → sha256 → sha1 → md5) e uma incompatibilidade aborta antes que qualquer coisa chegue ao servidor.

Um zip inteiro (`.mrpack` incluído) também pode **criar um servidor**: na aba _Do modpack_ do assistente, envie-o e o manifesto do pack (ou uma votação majoritária entre os jars identificados) preenche o loader, a versão do Minecraft e o build do loader.
