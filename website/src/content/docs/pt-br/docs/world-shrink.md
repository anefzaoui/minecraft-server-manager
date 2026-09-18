---
title: 'Encolhendo um mundo'
description: 'Com o tempo, um mundo se expande: todo lugar que um jogador já andou, voou ou'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Voltar ao índice de docs](/docs/)

Com o tempo, um mundo se expande: cada lugar por onde um jogador andou, voou ou
foi carregado por uma pérola do Fim deixa blocos gerados no disco, mesmo que
ninguém tenha voltado. **Encolher mundo** remove os blocos em que quase ninguém
passou tempo, para que o mundo ocupe menos espaço. O Minecraft reconstrói uma área
removida a partir da semente do mundo no momento em que alguém viaja para lá
novamente, então isso é seguro para
terras que ninguém está usando, mas qualquer coisa que um jogador _construiu_
em um local onde mal parou também seria removida, e é por isso que você deve
fazer um backup primeiro (o backup é o
desfazer).

## O que conta como "visitado raramente"

Cada bloco registra quanto tempo os jogadores passaram parado nele (o Minecraft
chama isso de `InhabitedTime`). Encolher mundo remove qualquer bloco com menos de
**30 segundos** de tempo total de jogador por padrão; a caixa de diálogo de
encolhimento permite que você altere esse limite (1 segundo a 1 hora) e quantos
blocos ao redor do spawn manter (padrão 8, `0` desliga a proteção do spawn).

O que é mantido, sempre:

- A área ao redor do **ponto de spawn** do mundo (lido de `level.dat`) no
  mundo normal. O Nether, o End e dimensões personalizadas não têm área de spawn.
- Qualquer bloco cujo tempo de visita não pôde ser lido, por exemplo, um mundo
  salvo com um formato de compressão que o painel não decodifica (LZ4). A prévia e o
  resultado informam quantos desses blocos foram ignorados.

Cada dimensão do mundo é coberta: pastas irmãs no estilo Bukkit
(`world_nether`, `world_the_end`), bem como o layout vanilla e Forge/Fabric
(`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`).
Quando um bloco é removido, suas entidades e pontos de interesse de aldeões vão
junto, então um bloco regenerado não herda mobs, carrinhos de mina ou locais de
trabalho obsoletos.

## Fazendo isso na aba Mundos

1. Faça um backup na aba **Backups**. Encolher pela aba Mundos não faz um
   backup para você.
2. Abra **Mundo → Mundos**, encontre o mundo e clique no ícone de encolher.
3. Clique em **Prévia** para ver aproximadamente quantos blocos (e quantos megabytes)
   seriam removidos. Nada é alterado ainda; uma prévia funciona enquanto o servidor
   está em execução.
4. Clique em **Encolher Mundo**. Encolher edita os arquivos do mundo diretamente,
   então o servidor deve ser parado: pare-o primeiro, ou marque a opção para
   pará-lo, encolher e iniciá-lo novamente em uma única etapa (o servidor é
   iniciado novamente mesmo que o encolhimento falhe). O progresso é mostrado na
   bandeja de tarefas.

![Encolher mundo](/docs/images/world-shrink.png)

## Fazendo isso como parte de um backup

Na aba **Backups**, marque **"Encolher o mundo também depois"** antes de
**Fazer Backup Agora**. O arquivo de backup é escrito primeiro (esse arquivo é o
seu desfazer), depois o mundo é encolhido, mas apenas se o servidor estiver parado.
Se o servidor estiver em execução, o backup ainda é executado e o encolhimento é
ignorado com uma observação.

Backups agendados têm a mesma opção: no editor de agendamento, escolha a tarefa
**Backup** e marque **"Encolher o mundo após cada backup"**. Combine-o com um
agendamento de **Parar servidor** alguns minutos antes, se você quiser que ele
execute sem supervisão.
