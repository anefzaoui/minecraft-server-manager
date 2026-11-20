---
title: 'Modelos'
description: 'Modelos salvam toda a configuração de um servidor Minecraft como uma receita reutilizável para criar novos servidores. Segredos nunca são incluídos.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Voltar ao índice da documentação](/docs/)

Um **blueprint** captura toda a configuração de um servidor (tipo, versão, recursos, ambiente, pinagem de pack, mods personalizados e, opcionalmente, sua configuração e mundo) em um único arquivo portátil `.mcserver.zip` do qual você pode criar novos servidores. Segredos (senhas, tokens e chaves no ambiente) nunca são gravados em um blueprint.

![Blueprints](/docs/images/blueprints.png)

## Exportando

Na aba **Configurações → Configuração** de um servidor, use **Exportar como Blueprint** e escolha o que incluir: a configuração do servidor sempre, seus diretórios de configuração (ativados por padrão) e, opcionalmente, os próprios arquivos de mods personalizados (um arquivo maior que instala sem baixar nada) e o mundo ativo. O resultado é salvo em sua biblioteca de blueprints e pode ser baixado para compartilhamento.

**Clonar Servidor**, no mesmo cartão, faz uma exportação e uma importação em uma única etapa para criar uma cópia do servidor, com ou sem seu mundo.

## Importando e criando a partir de um blueprint

Importe um arquivo de blueprint (**Importar Blueprint** na página **Blueprints**) ou escolha um da biblioteca (**Criar um Servidor** em seu cartão, ou a aba **Do Blueprint** do assistente) para criar um novo servidor pré-configurado exatamente como o original. O novo servidor recebe suas próprias portas e uma nova senha RCON. Mods personalizados que não foram incorporados são baixados novamente e verificados contra os hashes que o blueprint registrou. A biblioteca também começa com dois blueprints iniciais, um Paper e um Fabric.

É a maneira mais rápida de:

- Criar servidores idênticos (uma rede de servidores de minijogos, cópias de staging da produção).
- Mover um servidor entre painéis.
- Manter um modelo conhecido e confiável ao qual você sempre pode retornar.

Como um blueprint registra o [pin de pack](/docs/modpacks/) exato, um servidor de modpack criado a partir de um blueprint instala a mesma versão fixada, sem atualizações inesperadas.
