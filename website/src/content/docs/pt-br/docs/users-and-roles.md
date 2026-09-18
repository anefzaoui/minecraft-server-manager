---
title: 'Usuários e funções'
description: 'O painel é multiusuário.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Voltar ao índice da documentação](/docs/)

O painel é multiusuário. Gerencie contas em **Configurações → Usuários**.

![Usuários](/docs/images/settings-users.png)

## As três funções

| Função       | Pode fazer                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Tudo: gerenciar usuários, chaves de API, arquivos globais, substituições avançadas do Docker e todas as ações do servidor.                        |
| **operator** | Executar e configurar servidores (iniciar/parar, console, backups, mundos, mods, a maioria das configurações), mas não áreas exclusivas de admin. |
| **viewer**   | Somente leitura. Ver servidores e seus status, mas sem fazer alterações.                                                                          |

Todo usuário, incluindo um viewer, pode gerenciar sua própria [autenticação de dois fatores](/docs/two-factor-authentication/), pois proteger seu próprio login não é uma ação de gerenciamento de servidor.

## Apenas para administradores, e por quê

Algumas coisas são restritas a administradores propositalmente:

- **Gerenciamento de usuários, chaves de API e arquivos globais.**
- **A [API pública](/docs/public-api/)** - habilitar `/api/v1` e criar, escopar ou revogar seus tokens Bearer somente leitura.
- **Substituições avançadas do Docker** - nome de contêiner personalizado, publicações de porta extras e montagens de volume (bind mounts). Uma montagem de volume pode mapear qualquer caminho do host para um contêiner e, combinado com o acesso Docker do painel, isso é efetivamente root no host. Esses campos aparecem apenas para administradores.

Nomes de contêineres personalizados também não podem residir no namespace `msm-` do próprio painel, então um contêiner nomeado manualmente nunca pode ofuscar outro servidor e direcionar um comando ou parada para a instância errada.

## Gerenciando contas

![Foto de perfil](/docs/images/profile-picture.png)

Administradores podem criar usuários, alterar funções, redefinir senhas e excluir contas na tabela de Usuários. A coluna **2FA** mostra se cada usuário tem a autenticação de dois fatores habilitada; um administrador pode **redefinir** a 2FA de outro usuário (para o caso de perda do telefone e códigos de backup), mas nunca desabilitar a sua própria sem a senha, o que o fluxo de autoatendimento cuida em vez disso.

Falhas de login são limitadas por conta (tanto um contador por IP quanto um contador global da conta) para desacelerar tentativas de força bruta, e o mesmo limite cobre a etapa do código 2FA, para que uma senha correta não possa redefinir o contador antes da adivinhação do código. Na frente disso, há um limitador de requisições mais amplo por IP do cliente nos endpoints de login / 2FA / configuração, ajustável via `RATE_LIMIT_AUTH_PER_15MIN` (padrão 100; atrás de um proxy reverso, defina `TRUST_PROXY` para que ele use o IP real do cliente).
