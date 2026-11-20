---
title: 'Seu servidor Minecraft não inicia'
description: 'Um servidor Minecraft que não inicia, corrigido em ordem de probabilidade: o log, a versão do Java, memória, o EULA e porta, e mods.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Voltar ao índice da documentação](/docs/)

Siga esta lista. Ela está ordenada pela frequência com que cada item é a resposta, e os quatro primeiros cobrem a maioria dos casos.

## 1. Leia as últimas vinte linhas, não as primeiras

Role até o **fim** do log. Uma stack trace Java é impressa de dentro para fora, então o topo da
parede de texto é a parte menos interessante. O que você quer é a última linha `Caused by:` e o que
vem depois dela. Essa única linha geralmente indica o problema.

Duas formas indicam onde você está:

- `Exception in thread "main"` ou um caminho de relatório de crash perto do final significa que o
  próprio jogo falhou.
- O log simplesmente parando no meio de uma linha, sem nenhuma exceção, significa que algo matou o
  processo por fora. Pule para o ponto 3.

## 2. UnsupportedClassVersionError significa o Java errado

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Classe 52 é Java 8, 60 é 16, 61 é 17, 65 é 21, 69 é 25. A mensagem significa que o servidor precisa
de um Java mais novo do que o que está rodando; o inverso, um pack antigo em Java novo, geralmente
falha com um erro de mixin ou reflection.

| Versão do Minecraft | Java |
| ------------------- | ---- |
| 1.16.5 e anteriores | 8    |
| 1.17                | 16   |
| 1.18 e 1.19         | 17   |
| 1.20 a 1.20.4       | 17   |
| 1.20.5 a 1.21.x     | 21   |
| 26.1 e posteriores  | 25   |

Packs antigos realmente precisam do Java 8. Mais novo não é melhor aqui.

## 3. Código de saída 137 é o kernel, não um mod

O log para no meio da frase, não há relatório de crash e o container reporta 137. Isso é um
kill por falta de memória: o processo pediu memória que a máquina não tinha, então foi
terminado.

Quase sempre o heap Java foi definido com o mesmo número da memória da máquina. O heap precisa
da memória da máquina **menos** o overhead do próprio JVM, que é de 0.5 a 1.5 GB em um servidor
modificado. Diminua o heap, ou aumente a máquina. [Quanta RAM um servidor precisa](/docs/guide-server-memory/) tem os
números.

## 4. O EULA e a porta

Dois clássicos com correções de uma linha:

- `You need to agree to the EULA in order to run the server.` Defina `eula=true`, em `eula.txt` ou
  com a variável de ambiente que sua configuração usa.
- `Address already in use` ou `FAILED TO BIND TO PORT`. Algo mais está usando a porta 25565,
  frequentemente uma cópia anterior do mesmo servidor que nunca parou completamente. Encontre-a e
  pare-a em vez de mudar a porta, ou você acabará com duas.

## 5. Um mod está sem sua dependência

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Mods do Fabric esmagadoramente precisam do Fabric API como um arquivo separado. Mods do Forge e
NeoForge listam suas dependências no próprio erro. Instale a versão nomeada, não a mais nova:
"requires 0.91.x" significa essa linha, e 0.92 falhará na mesma verificação.

Às vezes, a dependência ausente é o próprio loader:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

A correção é uma build mais nova do loader, não um mod diferente. "47.4.14 or above" significa
qualquer build a partir dali, e o Forge não publica todos os números, então a build a ser
instalada pode ser a próxima. Em um modpack, atualize o pack primeiro: um pack cuja própria
versão do loader está muito antiga para seus mods é um bug para o autor corrigir.

## 6. Um mod é para o loader ou versão errada

Um jar para um loader diferente não falha educadamente. Espere um erro de mixin, um
`NoClassDefFoundError`, ou um crash dentro de uma classe que você nunca ouviu falar. Verifique a
página do jar: o loader e a versão do Minecraft ambos têm que bater exatamente. 1.20.1 e 1.20.4 são
jogos diferentes no que diz respeito aos mods.

## 7. O mundo é de uma versão mais nova

```
This world was created by a newer version of Minecraft
```

Mundos atualizam para frente e nunca para trás. Restaure o backup de antes da atualização, ou rode
a versão que o mundo espera. Não há caminho de downgrade que mantenha os chunks intactos.

## Quando travou depois de rodar bem por semanas

Pergunta diferente, geralmente resposta diferente:

- **Travou sob carga**, com timings mostrando longas pausas: garbage collection, então olhe o
  tamanho do heap antes dos mods.
- **Travou no mesmo ponto do mundo**: um chunk corrompido ou uma entidade quebrada. O relatório de
  crash geralmente indica as coordenadas.
- **Travou logo após uma atualização**: o mod que atualizou é o suspeito, mesmo que o trace aponte
  para outro lugar. Reverte e veja.
- **Travou na reinicialização, tendo funcionado antes**: verifique o disco. Um disco cheio
  produz erros espetaculares e enganosos.

## Obtendo ajuda que realmente ajuda

Poste o **log inteiro**, não a última linha, e diga o que você mudou antes de quebrar. Cole em um
lugar feito para isso, como [mclo.gs](https://mclo.gs), em vez de no chat. Inclua a versão do
Minecraft, o loader, o pack e sua versão, e quanto heap o servidor tem. Um relatório com esses
quatro fatos é respondido em uma única resposta; sem eles, leva cinco.

## No Minecraft Server Manager

Crashes são detectados pela própria saída do container, então um servidor que morre às três da
manhã é registrado com seu trecho de log em vez de ser encontrado no dia seguinte. Os suspeitos
usuais nesta página (o EULA, o Java errado, um mundo de uma versão mais nova, uma porta já em
uso, Java ficando sem memória) são reconhecidos nesse log e nomeados na entrada de histórico com o
que fazer a respeito, e o auto-restart os ignora, já que reiniciar não os corrigirá. Relatórios de
crash são analisados na chegada: a exceção é destacada, a pilha é colapsável, e mods que aparecem
no trace são listados como suspeitos.

Qualquer relatório pode ser compartilhado para mclo.gs a partir de seu card quando você precisar de
ajuda (após uma confirmação, já que a postagem é pública), e o menu **Download** do console tem
todos os arquivos de log como um zip, então "postar o log inteiro" é um download em vez de um
projeto de arqueologia. Um kill por falta de memória é registrado como um kill por falta de
memória, o que economiza a hora usual de culpar um mod. Se algo mais genuinamente precisar da
porta, o card **Game Port** em **Settings → Configuration** move o servidor para uma livre.

Um loader muito antigo é alterado na aba **Versions** do servidor, que verifica se a build existe
e faz um backup antes de reconstruir o servidor ([mudando a versão do mod loader](/docs/updates/#changing-the-mod-loader-version)).

Relacionado: [quanta RAM um servidor precisa](/docs/guide-server-memory/), [escolhendo um loader](/docs/guide-choosing-a-loader/),
[criando e gerenciando servidores](/docs/servers/).
