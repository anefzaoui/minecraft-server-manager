---
title: 'Movendo um servidor Minecraft para outro host'
description: 'Mover um mundo é fácil. Mover um servidor no qual os jogadores ainda podem fazer login, com seus inventários, casas e permissões intactos, é a parte que dá errado.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Voltar ao índice da documentação](/docs/)

Mover um mundo é fácil. Mover um servidor no qual os jogadores ainda podem fazer login, com seus inventários, casas e permissões intactos, é a parte que dá errado. A ordem abaixo mantém o tempo de inatividade em poucos minutos e preserva um caminho de volta caso a nova máquina decepcione.

## Faça um inventário primeiro

Anote estas informações antes de tocar em qualquer coisa. Cada uma delas já arruinou uma migração quando foi assumida em vez de verificada:

- **Versão e loader do Minecraft**, exatamente. 1.20.1 NeoForge não é 1.20.1 Forge.
- **A lista de mods ou plugins com versões.** O mundo não carregará sem os mods que o criaram.
- **Versão do Java**, que acompanha a versão do Minecraft.
- **`level-name`** de `server.properties`. A pasta do mundo muitas vezes não se chama `world`.
- **Modo online.** Se o servidor antigo rodou com `online-mode=false` e o novo roda com ele ativado, ou vice-versa, cada jogador recebe um UUID diferente e, portanto, um inventário totalmente novo e vazio. Este é o erro mais doloroso desta página.
- **Qualquer coisa que viva fora da pasta do servidor**, como um banco de dados MySQL de um plugin.

## Copie enquanto está rodando, depois copie novamente enquanto está parado

O truque para um tempo de inatividade curto é fazer a cópia lenta primeiro.

1. **Com o servidor rodando**, copie todo o diretório do servidor para a nova máquina. Em um mundo grande, isso pode levar uma hora; ninguém percebe, porque nada parou.
2. **Anuncie uma reinicialização e, em seguida, pare o servidor corretamente.** Uma parada graciosa faz o jogo salvar o mundo; matar o processo não.
3. **Copie novamente.** Apenas os arquivos que mudaram serão movidos desta vez, então levará de segundos a minutos.
4. **Inicie-o na nova máquina**, em uma porta não pública, se possível, e conecte-se a ele você mesmo. Verifique uma base que você conhece, seu próprio inventário e se os plugins ou mods carregaram sem erros.
5. **Em seguida**, direcione os jogadores para ele.

`rsync -a --delete` é a ferramenta usual para os passos 1 e 3. Mantenha as permissões e os carimbos de data/hora: um mundo copiado como o usuário errado é um servidor que não iniciará, e o erro não dirá isso claramente.

## Não exclua o antigo ainda

Mantenha a máquina antiga, parada, mas intacta, por pelo menos alguns dias. É o único rollback real. Mantenha-a desligada em vez de rodando, para que ninguém se conecte acidentalmente à cópia abandonada e construa lá por uma semana.

## Faça o endereço sobreviver à mudança

Se os jogadores se conectam a um endereço IP puro, cada mudança força todos os jogadores a editar sua lista de servidores, e alguns deles nunca o fazem.

Use um nome de host que você controla, apontado para o servidor. A mudança se torna então uma alteração de DNS, e o endereço na lista de todos no cliente permanece o mesmo. Diminua o tempo de vida (TTL) do registro um dia antes da mudança para que a alteração se propague rapidamente.

Se você quer que os jogadores digitem um domínio puro enquanto o servidor roda em uma porta não padrão, um registro SRV faz isso. É o mesmo mecanismo que os hosts comerciais usam para distribuir `play.something.net`.

## Verifique a nova máquina antes de confiar nela

Três coisas que diferem entre hosts e causam problemas após a mudança:

- **O firewall.** Sua porta de jogo precisa estar aberta, e apenas sua porta de jogo. Não exponha um painel de gerenciamento ou um mapa à internet só porque funcionou em localhost.
- **Velocidade de núcleo único.** O Minecraft se importa muito mais com a velocidade de um único núcleo do que com a quantidade deles. Oito núcleos lentos parecerão piores do que dois rápidos.
- **Disco.** Um mundo em armazenamento rotativo ou em um volume muito compartilhado irá travar durante o carregamento de chunks.

## Saindo de um painel gerenciado

Se você está vindo de um host que lhe deu um painel de controle em vez de uma máquina, encontre o download ou o gerenciador de arquivos e pegue todo o diretório do servidor em vez de apenas o mundo. Obtenha os arquivos JAR dos plugins e mods em si, não uma lista: as versões importam, e "latest" é um arquivo diferente no mês seguinte.

Verifique se seus backups são seus também. Um backup que só existe dentro do painel que você está deixando não é um backup que você possui.

## No Minecraft Server Manager

Todo o painel é um diretório. Copiá-lo para outra máquina e iniciar o painel lá traz todos os servidores, mundos, backups e configurações com ele, o que torna a movimentação do painel em si uma cópia em vez de uma migração.

Para um único servidor em vez de todos eles, um blueprint captura sua configuração, conjunto de mods e versão do pack fixado (e, se você marcar, o mundo ativo) como um único `.mcserver.zip` que pode ser importado em outro painel para reconstruir o mesmo servidor. Mundos podem ser baixados e instalados separadamente quando apenas o mundo precisa viajar.

Se a porta de jogo que um servidor usava já estiver ocupada na nova máquina, ou você quiser testar em uma porta não pública primeiro, altere-a em **Configurações → Configuração**: o cartão **Porta do Jogo** tem **Usar Próxima Porta Livre**, um servidor em execução pergunta antes de reiniciar na nova porta e, se não puder iniciar lá, ele volta para a antiga. Mude para a porta pública quando você direcionar os jogadores para ela.

Relacionado: [blueprints](/docs/blueprints/), [backups que realmente restauram](/docs/guide-backups/), [mundos e arquivos](/docs/worlds-and-files/).
