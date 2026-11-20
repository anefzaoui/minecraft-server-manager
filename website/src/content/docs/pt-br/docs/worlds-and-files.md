---
title: 'Mundos e arquivos'
description: 'A biblioteca de mundos, uploads e trocas de mundos, a aba de mods e plugins e o gerenciador de arquivos no navegador.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Voltar ao índice de documentação](/docs/)

## Mundos

A página **Mundos** é a biblioteca de mundos: todos os mundos salvos em um só lugar. **Upload World** pega um arquivo compactado `.zip` ou `.tar` e encontra o mundo dentro dele automaticamente, **Save to Library** tira um "snapshot" do mundo ativo de um servidor (funciona enquanto o servidor está em execução), e cada mundo da biblioteca pode ser baixado ou instalado em qualquer servidor com **Install to…**. A instalação substitui o mundo do servidor (o servidor deve estar parado e seu mundo atual é copiado de segurança primeiro) ou o adiciona junto, para ser ativado depois. Uma verificação de compatibilidade é executada antes de cada instalação.

A própria aba **World → Worlds** de um servidor lista os mundos nesse servidor. A partir daí, você pode ativar outro mundo (com o servidor parado), baixar, duplicar, renomear ou [reduzir](/docs/world-shrink/) um mundo, copiá-lo para outro servidor, excluir um inativo e redefinir o mundo ativo com uma seed nova, mantida ou personalizada (um backup de segurança é oferecido primeiro). A mesma biblioteca fica abaixo, com **Install Here**.

![Mundos](/docs/images/worlds.png)

## O gerenciador de arquivos

Em **World** de um servidor, a aba **Files** é um gerenciador de arquivos completo no navegador para o diretório de dados desse servidor. Liste, leia, edite, renomeie, mova, copie, exclua e faça upload de arquivos, crie pastas e pesquise o texto de arquivos em uma pasta com **Find in Files**: tudo o que você normalmente faria via SSH, a partir do navegador.

![Gerenciador de arquivos](/docs/images/server-files.png)

Arquivos de texto abrem em um editor com um limite de 8 MB; arquivos maiores podem ser baixados. Uploads aceitam até 20 arquivos por vez.

### Permanecendo dentro da sandbox

Toda operação de arquivo é restrita ao próprio diretório de dados do servidor. O painel resolve cada caminho e recusa qualquer coisa que escape: travessia `..`, caminhos absolutos e até mesmo links simbólicos que apontam para fora do diretório (incluindo os pendentes que ainda não existem). Um mod ou plugin não pode plantar um link para enganar o gerenciador de arquivos a ler ou escrever em outro lugar no host.

## Mods

Para servidores com mods e plugins, a aba **Mods** (seu próprio grupo na barra lateral do servidor) gerencia o conjunto de mods: navegue e adicione mods, e veja o que está instalado. De cada linha de mod instalado, você pode atualizá-lo (ou ignorar essa atualização), [revertê-lo](/docs/updates/#undoing-a-mod-update), desativá-lo ou removê-lo, e **Update All** aplica todas as atualizações disponíveis com um reinício. Atualizações de mods e pacotes também aparecem na página [Updates](/docs/updates/).

### Adicionando mods

![Mods](/docs/images/mods.png)

Quatro caminhos, todos a partir da barra de ferramentas da aba Mods:

- **Search Mods**: pesquise **Modrinth ou CurseForge** (o chip CurseForge aparece assim que uma chave de API é armazenada em **Settings → API Keys**), e em servidores de plugins também **Hangar** (o próprio registro de plugins do PaperMC) e **SpigotMC** (via proxy CDN do Spiget), ambos sem necessidade de chave. Uma aba **Datapacks** pesquisa os datapacks do Modrinth. Tudo é filtrado para o loader e a versão do Minecraft do servidor (uma caixa de seleção também mostra builds não listadas como compatíveis, por sua conta e risco); servidores Quilt veem automaticamente builds com tag fabric também, já que Quilt executa mods Fabric. Resultados já no servidor mostram um selo **Installed**. Se um autor do CurseForge proibir downloads automatizados (ou um recurso do SpigotMC for hospedado externamente), o painel informa isso diretamente e oferece um caminho **Open CurseForge** (ou **Open SpigotMC**) + **Upload Jar** em vez de falhar no meio da instalação.

  ![Pesquisa Hangar](/docs/images/mods-search-hangar.png)

- **Import Zip**: um botão, três formatos, detecção automática:
  - Um **modpack Modrinth (`.mrpack`)**: cada arquivo fixado é canonizado de volta ao seu projeto Modrinth via lookup de hash (assim, os mods importados mantêm nomes reais, ícones e permanecem verificáveis para atualização; arquivos que o Modrinth não conhece são instalados a partir da URL própria do pack), verificado contra os checksums sha512 do pack durante o download, e pré-visualizado com vereditos de adequação. Arquivos apenas para cliente são pulados visivelmente, e ambas as árvores de sobrescrita (`overrides/`, depois `server-overrides/`; a cópia específica do servidor vence) podem ser aplicadas.

    ![Importação mrpack](/docs/images/mrpack-import.png)

  - Uma **exportação de modpack CurseForge** (o zip que o aplicativo CurseForge produz, com `manifest.json`): cada mod fixado é resolvido em massa, pré-visualizado com avisos (loader/MC errado para este servidor, arquivos não mais no CurseForge, mods que precisam de download manual), e instalado com progresso real. Os `overrides/` do pack (configs, scripts) podem opcionalmente ser aplicados também; qualquer arquivo que seria sobrescrito é copiado de segurança primeiro para `.import-backups/<timestamp>/` dentro da pasta do servidor.
  - Um **zip simples de jars** que você coletou: cada jar é identificado (correspondência de hash Modrinth → impressão digital CurseForge → metadados do próprio jar) e julgado contra o servidor (_adequado / loader errado / versão MC errada / já instalado / não identificado_), para que você escolha o que realmente pertence antes que qualquer coisa seja instalada.
- **Add by URL**: cole quase qualquer coisa: páginas de projeto Modrinth, CurseForge, Hangar ou SpigotMC, uma URL de repositório ou release do GitHub (um simples `owner/repo` também funciona; instalações do GitHub preferem a release estável mais recente e pulam jars auxiliares `-sources`/`-javadoc`), um slug Modrinth simples, ou qualquer URL direta de `.jar`. O painel resolve o build correto para o loader e a versão MC do servidor.

  ![Adicionar por link](/docs/images/mods-add-by-link.png)

- **Upload Jar** (da fallback de pesquisa ou do resolvedor de downloads pendentes): jars enviados são identificados da mesma forma, para que mantenham seu nome real, versão, ícone e se tornem verificáveis para atualização.

Cada instalação de registro é **verificada por checksum durante o download**: o stream é verificado contra o digest mais forte que o registro publica (sha512 → sha256 → sha1 → md5) e uma incompatibilidade aborta antes que qualquer coisa chegue ao servidor.

Um zip inteiro (`.mrpack` incluído) também pode **criar um servidor**: na aba **From Modpack** do assistente, envie-o e o manifest do pack (ou uma votação majoritária entre os jars identificados) preenche o loader, a versão do Minecraft e o build do loader.
