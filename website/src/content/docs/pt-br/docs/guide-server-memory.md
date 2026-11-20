---
title: 'Quanta RAM um servidor de Minecraft precisa?'
description: 'Quanta RAM um servidor de Minecraft precisa para vanilla, Paper, mods leves e modpacks grandes, e quanta deixar para a máquina.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Voltar ao índice da documentação](/docs/)

Resposta curta, para um servidor que será realmente jogado:

| O que você está executando                    | Heap Java | Dê à máquina |
| --------------------------------------------- | --------- | ------------ |
| Vanilla ou Paper, até 10 jogadores            | 2 GB      | 4 GB         |
| Paper com plugins, 10 a 30 jogadores          | 4 GB      | 6 GB         |
| Um modpack leve, 40 a 80 mods                 | 4 GB      | 6 GB         |
| Um pack "kitchen-sink" grande, 150 a 300 mods | 6 a 8 GB  | 10 GB        |
| GregTech New Horizons e monstros similares    | 8 a 12 GB | 16 GB        |

Dois números, não um. Essa é a parte que a maioria dos guias pula, e é o motivo pelo qual as pessoas compram um servidor de 4 GB, dão 4 GB para o Java e depois o veem morrer.

## O heap e a máquina são números diferentes

O heap Java (`-Xmx`) é quanta memória o jogo em si pode usar para o mundo, entidades e dados de mods. A máquina, ou o contêiner, precisa conter esse heap **mais** tudo o que o Java precisa: metadados de classe, pilhas de threads, contabilidade do coletor de lixo, buffers de rede e a própria JVM. Essa sobrecarga é de aproximadamente 0,5 a 1,5 GB para um servidor com mods.

Se o heap for igual à memória da máquina, o kernel mata o servidor no momento em que o Java tenta usar essa sobrecarga. No Docker, isso aparece como código de saída 137, e nos logs como nada: o processo simplesmente desaparece no meio de uma frase. As pessoas geralmente culpam um mod.

Uma regra segura: **heap mais 25 por cento, e pelo menos um gigabyte de sobra.** Um heap de 8 GB requer uma máquina de 10 GB.

## Mais RAM não é mais desempenho

O Minecraft é limitado por thread única na maior parte do que faz. Dar a um pack de 40 mods 16 GB não faz os chunks gerarem mais rápido; faz com que cada pausa de coleta de lixo dure mais, porque há mais para percorrer. Um servidor que engasga a cada trinta segundos é frequentemente um servidor com muito heap, não muito pouco.

Aumente o heap quando vir isso, e não de outra forma:

- `java.lang.OutOfMemoryError: Java heap space` no log.
- Repetidos "Can't keep up! Is the server overloaded?" com pausas de coleta de lixo nos timings.
- Uso de memória que sobe até o teto e fica preso lá por horas.

## Por que seu servidor mostra 12 GB usados enquanto ninguém está online

Porque você o mandou fazer isso. Dois padrões conspiram:

1. A imagem Docker comum define o heap inicial igual ao máximo, então `-Xms` e `-Xmx` são ambos o seu número. O Java o reivindica antecipadamente em vez de crescer para ele.
2. O popular conjunto de flags do Aikar inclui `-XX:+AlwaysPreTouch`, que percorre cada página desse heap na inicialização para que as páginas sejam realmente alocadas. É deliberado: troca um boot mais lento e um número ocioso alto por menos pausas depois.

Medido no Paper 1.21.1 com um heap de 2 GB em um contêiner de 4 GB, amostrado por três minutos após o carregamento completo do mundo:

| Configuração                                 | Memória residente |
| -------------------------------------------- | ----------------- |
| Sem flags                                    | 2.60 GiB          |
| Flags do Aikar                               | 2.59 GiB          |
| Flags do Aikar sem `AlwaysPreTouch`          | 1.95 GiB          |
| Flags do Aikar com um heap inicial de 512 MB | 1.38 GiB          |
| Sem flags com um heap inicial de 512 MB      | 1.25 GiB          |

Portanto, um servidor "usando" 12 GB em ociosidade é geralmente um heap de 12 GB que foi pré-tocado, não um vazamento. Seu monitoramento está lendo corretamente; o número apenas não significa o que parece.

Se você quiser um número ocioso honesto, defina o heap inicial mais baixo que o máximo. Você paga por isso com algumas coletas a mais no início. Se preferir tempos de quadro estáveis, deixe como está e pare de olhar o gráfico.

## Jogadores importam menos do que você pensa

Dobrar de 10 para 20 jogadores custa muito menos do que adicionar cinquenta mods. Jogadores adicionam principalmente entidades e chunks carregados, que escalam suavemente. Mods adicionam dados de classe, registros, recursos de geração de mundo e seus próprios caches, que não escalam. Priorize o tamanho do pack, depois adicione cerca de 100 a 200 MB por jogador regular em um servidor com mods.

A distância de visualização é a outra grande alavanca. Reduzir de 12 para 8 chunks pode economizar um gigabyte em um servidor movimentado e é quase imperceptível na jogabilidade.

## No Minecraft Server Manager

Cada servidor tem dois campos separados, **Heap Java** e **Limite de memória do contêiner**, precisamente porque são perguntas diferentes. O assistente de criação define o limite do contêiner 50% acima do heap para você, e o painel se recusa a salvar um servidor cujo limite de contêiner não esteja acima de seu heap, porque essa combinação termina com o código de saída 137 em vez de uma mensagem de erro.

O medidor de memória em um servidor mostra o que o contêiner está realmente usando, com uma nota quando o heap foi reivindicado antecipadamente, para que um heap pré-tocado não seja lido como descontrolado. Um servidor que o kernel matou por falta de memória é registrado exatamente assim no histórico, em vez de um crash misterioso.

Relacionado: [criando e gerenciando servidores](/docs/servers/),
[relatórios de crash](/docs/servers/#crash-reports--mclogs-analysis), [armazenamento e cotas](/docs/storage/).
