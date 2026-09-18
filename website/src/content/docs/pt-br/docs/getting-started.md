---
title: 'Primeiros passos'
description: 'Na primeira vez que você abrir o painel, ele pedirá para criar uma conta de administrador.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Voltar ao índice da documentação](/docs/)

## Configuração inicial

Na primeira vez que você abrir o painel, ele pedirá para criar uma conta de administrador. Esta é a única conta que existe até que você adicione outras e ela tem controle total.

Escolha um nome de usuário e uma senha com pelo menos 8 caracteres. É só isso: você estará conectado e será levado diretamente para o painel.

> **Instalações expostas são protegidas por PIN.** Se você iniciar o painel vinculado a um endereço não-loopback (`PANEL_HOST` diferente de `127.0.0.1`), a página de configuração também pedirá um **PIN de 6 dígitos**. O painel o exibe no seu console ao iniciar. Digite-o junto com seu nome de usuário e senha. Isso impede que um estranho que alcance a porta primeiro reivindique a conta de administrador. O PIN desaparece assim que a conta de administrador existir.

## Login

Após a configuração, o painel é protegido por uma tela de login. Digite seu nome de usuário e senha para continuar.

![Login](/docs/images/login.png)

Se a [autenticação de dois fatores](/docs/two-factor-authentication/) estiver habilitada em sua conta, você será solicitado a inserir um código de 6 dígitos do seu aplicativo autenticador logo após a senha.

## Navegando pelo painel

Tudo está organizado na barra lateral esquerda:

- **Painel** - todos os servidores em um só lugar ([detalhes](/docs/dashboard/)).
- **Servidores**, **Modpacks**, **Mundos**, **Blueprints** - crie e gerencie servidores e seu conteúdo.
- **Atualizações**, **Backups**, **Agendamentos**, **Armazenamento**, **Atividade** - o lado operacional: o que está desatualizado, seus snapshots, automação, uso de disco e o log de auditoria.
- **Configurações** (inferior): usuários, chaves de API e configuração do painel.

A barra superior tem o botão **Criar um Servidor**, um **seletor de tema** (escuro/claro) e seu **menu de conta**, onde você pode gerenciar a [autenticação de dois fatores](/docs/two-factor-authentication/) ou sair.

## Em um celular ou tablet

Cada página é projetada primeiro para uma tela estreita e depois se expande: a barra lateral se esconde atrás do botão de menu, tabelas de dados se empilham em cartões, barras de ferramentas se ajustam e a barra de controles do mundo colapsa em um cartão que você abre quando precisa. Botões e chips têm um tamanho de alvo de toque real. Nada é exclusivo para desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Painel em um celular" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Visão geral do servidor em um celular" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Console em um celular" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Aba de mods em um celular" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Configurações em um celular" width="180">
</p>

## O que você precisa

O painel se comunica com o Docker para executar servidores, portanto, ele precisa de acesso a um daemon Docker (Docker Desktop ou um socket Docker Engine). Quando o Docker está acessível, o bloco Docker no painel mostra **Conectado** e sua versão. Se não estiver, o painel ainda funciona. Você só não poderá iniciar servidores até que o daemon esteja ativo.

## Próximos passos

- [Crie seu primeiro servidor →](/docs/servers/)
- [Proteja sua conta com 2FA →](/docs/two-factor-authentication/)
