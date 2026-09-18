---
title: 'Autenticação de dois fatores'
description: 'A autenticação de dois fatores (2FA) adiciona uma segunda etapa ao login: após sua senha, você insere um código curto de um aplicativo autenticador no seu celular.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Voltar ao índice da documentação](/docs/)

A autenticação de dois fatores (2FA) adiciona uma segunda etapa ao login: após sua senha, você insere um código curto de um aplicativo autenticador no seu celular. Mesmo que alguém descubra sua senha, não conseguirá acessar sua conta sem o seu dispositivo.

Funciona com qualquer autenticador TOTP padrão (Google Authenticator, Authy, 1Password, Microsoft Authenticator e outros), e está disponível para **todas** as contas, não apenas administradores. Proteger seu próprio login não é uma ação de gerenciamento de servidor, então visualizadores e operadores também podem ativá-la.

## Ativando a 2FA

Abra o menu da conta (sua inicial, no canto superior direito) e escolha **Autenticação de dois fatores**.

![Menu da conta](/docs/images/2fa-user-menu.png)

Você verá uma caixa de diálogo de registro:

![Registro](/docs/images/2fa-enroll.png)

1. **Escaneie o código QR** com seu aplicativo autenticador, ou toque em **Copiar** e insira a chave manual.
2. Digite o **código de 6 dígitos** que seu aplicativo exibe agora.
3. **Confirme sua senha.** Ativar a 2FA revalida sua senha, então uma sessão aberta indevidamente não pode ativá-la com o dispositivo de outra pessoa.
4. Clique em **Ativar**.

### Salve seus códigos de backup

No momento em que a 2FA é ativada, o painel exibe um conjunto de **códigos de backup** de uso único.

![Códigos de backup](/docs/images/2fa-backup-codes.png)

Cada código funciona **uma vez**, para fazer login caso você perca o acesso ao seu aplicativo autenticador. Salve-os em um local seguro (um gerenciador de senhas é ideal), pois eles não serão exibidos novamente. Você pode gerar um novo conjunto a qualquer momento (o que invalida os antigos).

## Fazendo login com 2FA

A partir daí, o login terá uma segunda etapa. Após seu nome de usuário e senha, o painel solicitará seu código:

![Login com 2FA](/docs/images/2fa-login-challenge.png)

Insira o código atual de 6 dígitos do seu aplicativo (ou um dos seus códigos de backup) e pronto. Até que você complete esta etapa, a sessão **não** está logada: ela não pode acessar nenhuma página ou API.

## Gerenciando ou desativando a 2FA

Abra a mesma opção **Autenticação de dois fatores** no menu da conta enquanto ela estiver ativada. Após confirmar sua senha, você pode:

- **Gerar novos códigos de backup** - emite um novo conjunto e invalida o antigo.
- **Desativar 2FA** - remove-a da sua conta.

Ambas as opções revalidam sua senha atual primeiro.

## Perdeu seu celular _e_ seus códigos de backup?

Um **administrador** pode redefinir a 2FA de outro usuário em **Configurações → Usuários** (o botão **Redefinir** na coluna 2FA). Isso limpa a 2FA da conta para que o usuário possa fazer login apenas com sua senha e configurá-la novamente. Administradores não podem redefinir sua _própria_ 2FA sem senha. Eles passam pelo processo normal de desativação com senha, para que uma sessão de administrador comprometida não possa remover seu próprio segundo fator.

## Bom saber

- Os códigos são baseados em tempo e rotacionam a cada 30 segundos; o painel aceita uma pequena variação no relógio e se recupera silenciosamente se o relógio do servidor for corrigido posteriormente.
- Um código não pode ser reutilizado - uma vez usado para fazer login, o mesmo código não funcionará novamente dentro de sua janela de validade.
- Códigos incorretos estão sujeitos a limitação de taxa. O limitador é **compartilhado** com a etapa de senha (um bloqueio por conta mais um limitador por IP `RATE_LIMIT_AUTH_PER_15MIN`), então inserir uma senha correta não pode redefinir o contador pouco antes de adivinhar o código de 6 dígitos.
- Alterações na 2FA (ativação, desativação, redefinição, uso de código de backup) são todas registradas no [Log de atividades](/docs/activity/).
