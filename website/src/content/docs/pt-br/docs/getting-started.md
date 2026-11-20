---
title: 'Primeiros passos'
description: 'Instale o Minecraft Server Manager e conclua a configuração inicial: a verificação do sistema, seu fuso horário e a conta de administrador.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Voltar ao índice da documentação](/docs/)

## Configuração inicial

Na primeira vez que você abrir o painel, um breve assistente de configuração o guiará:

1.  **Verificação do Sistema** garante que o Docker esteja acessível, o Node.js seja recente o suficiente e a pasta de dados seja gravável. Se o Docker ainda não estiver em execução, você ainda poderá continuar; a criação e o início de servidores só ocorrerão quando ele estiver ativo.
2.  **Crie Sua Conta de Administrador**. Esta é a única conta que existe até que você adicione outras e ela tem controle total. Escolha um nome de usuário (2 a 32 caracteres) e uma senha com pelo menos 8 caracteres. Você estará logado assim que ela for criada.
3.  **Configuração do Painel** (opcional): um domínio público para mostrar aos jogadores nos endereços de conexão, uma chave de API da CurseForge e seu fuso horário. Tudo isso pode ser alterado posteriormente em **Configurações**.

A última etapa oferece **Criar um Servidor** ou **Ir para o Painel Principal**.

![A etapa de Verificação do Sistema da configuração inicial](/docs/images/setup-system-check.png)

> **Instalações expostas são protegidas por PIN.** Se você iniciar o painel vinculado a um endereço não-loopback (`PANEL_HOST` diferente de `127.0.0.1`), a página de configuração também solicitará um **PIN de 6 dígitos**. O painel o exibirá no seu console ao iniciar. Digite-o junto com seu nome de usuário e senha. Isso impede que um estranho que alcance a porta primeiro reivindique a conta de administrador. O PIN desaparece assim que a conta de administrador existir.

## Login

Após a configuração, o painel é protegido por uma tela de login. Digite seu nome de usuário e senha para continuar.

![Login](/docs/images/login.png)

Se a [autenticação de dois fatores](/docs/two-factor-authentication/) estiver habilitada em sua conta, você será solicitado a inserir um código de 6 dígitos do seu aplicativo autenticador logo após a senha.

## Navegando pelo painel

Tudo se encontra na barra lateral esquerda:

- **Painel Principal** - todos os servidores em um relance ([detalhes](/docs/dashboard/)).
- **Servidores**, **Modpacks**, **Mundos**, **Blueprints** - crie e gerencie servidores e seu conteúdo.
- **Atualizações**, **Backups**, **Agendamentos**, **Armazenamento**, **Atividade** - o lado operacional: o que está desatualizado, seus snapshots, automação, uso de disco e o log de auditoria.
- **Permissões** (inferior, apenas para administradores): o que cada usuário pode fazer em cada servidor ([detalhes](/docs/users-and-roles/#per-server-permissions)).
- **Configurações** (inferior, apenas para administradores): chaves de API, configuração do painel, padrões para novos servidores, [retenção de backup](/docs/backups/#retention), usuários, segurança de login e a API pública.

Abaixo disso, a barra lateral lista seus servidores. Abrir um deles mostra suas próprias abas: **Visão Geral**, **Console**, **Jogadores**, **Mods**, **Mundo**, **Backups**, **Monitoramento** e **Configurações**, a maioria com sub-abas relacionadas (por exemplo, **Configurações → Configuração** contém as configurações do servidor e sua porta de jogo). Veja [Um único servidor](/docs/servers/#a-single-server).

A barra superior tem o botão **Criar um Servidor**, um **seletor de tema** (escuro/claro) e seu **menu de conta**, onde você pode alterar sua foto de perfil, gerenciar [autenticação de dois fatores](/docs/two-factor-authentication/) ou sair.

## Em um celular ou tablet

Cada página é projetada primeiro para uma tela estreita e se alarga a partir daí: a barra lateral se esconde atrás do botão de menu, as tabelas de dados se empilham em cartões, as barras de ferramentas se ajustam e a barra de controles do mundo colapsa em um cartão que você abre quando precisa. Botões e chips têm um tamanho de alvo de toque real. Nada é exclusivo para desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Painel principal em um celular" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Visão geral do servidor em um celular" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Console em um celular" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Aba Mods em um celular" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Compatibilidade de versão em um celular" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Configurações em um celular" width="180">
</p>

## O que você precisa

O painel se comunica com o Docker para executar servidores, portanto, ele precisa de acesso a um daemon Docker (Docker Desktop ou um socket do Docker Engine). Quando o Docker está acessível, o bloco do Docker no painel principal mostra **Conectado** e sua versão. Se não estiver, o painel ainda funciona. Você apenas não poderá iniciar servidores até que o daemon esteja ativo.

## Próximos passos

- [Crie seu primeiro servidor →](/docs/servers/)
- [Proteja sua conta com 2FA →](/docs/two-factor-authentication/)
