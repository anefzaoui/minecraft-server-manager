---
title: 'Autenticación de dos factores'
description: 'La autenticación de dos factores (2FA) añade un segundo paso al inicio de sesión: después de tu contraseña, introduces un código corto de una aplicación de autenticación en tu teléfono.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Volver al índice de documentación](/docs/)

La autenticación de dos factores (2FA) añade un segundo paso al inicio de sesión: después de tu contraseña, introduces un código corto de una aplicación de autenticación en tu teléfono. Incluso si alguien descubre tu contraseña, no podrá acceder sin tu dispositivo.

Funciona con cualquier autenticador TOTP estándar (Google Authenticator, Authy, 1Password, Microsoft Authenticator y otros), y está disponible para **todas** las cuentas, no solo para los administradores. Proteger tu propio inicio de sesión no es una acción de gestión del servidor, por lo que los espectadores y operadores también pueden activarla.

## Habilitar 2FA

Abre el menú de cuenta (tu inicial, arriba a la derecha) y elige **Autenticación de dos factores**.

![Menú de cuenta](/docs/images/2fa-user-menu.png)

Aparecerá un diálogo de inscripción:

![Inscripción](/docs/images/2fa-enroll.png)

1. **Escanea el código QR** con tu aplicación de autenticación, o pulsa **Copiar** e introduce la clave manualmente.
2. Escribe el **código de 6 dígitos** que muestra tu aplicación.
3. **Confirma tu contraseña.** Habilitar 2FA vuelve a comprobar tu contraseña, por lo que una sesión abierta no autorizada no puede activarla con el dispositivo de otra persona.
4. Haz clic en **Habilitar**.

### Guarda tus códigos de respaldo

En el momento en que se habilita la 2FA, el panel muestra un conjunto de **códigos de respaldo** de un solo uso.

![Códigos de respaldo](/docs/images/2fa-backup-codes.png)

Cada código funciona **una vez**, para iniciar sesión si alguna vez pierdes el acceso a tu aplicación de autenticación. Guárdalos en un lugar seguro (un gestor de contraseñas es ideal) porque no se volverán a mostrar. Puedes generar un nuevo conjunto en cualquier momento (lo que invalidará los anteriores).

## Iniciar sesión con 2FA

A partir de entonces, iniciar sesión tiene un segundo paso. Después de tu nombre de usuario y contraseña, el panel te pide tu código:

![Inicio de sesión con 2FA](/docs/images/2fa-login-challenge.png)

Introduce el código actual de 6 dígitos de tu aplicación (o uno de tus códigos de respaldo) y habrás iniciado sesión. Hasta que completes este paso, la sesión **no** ha iniciado sesión: no puede acceder a ninguna página ni API.

## Gestionar o desactivar 2FA

Abre la misma entrada **Autenticación de dos factores** en el menú de cuenta mientras está habilitada. Después de confirmar tu contraseña puedes:

- **Regenerar códigos de respaldo** - emite un nuevo conjunto y retira el anterior.
- **Desactivar 2FA** - la elimina de tu cuenta.

Ambas opciones vuelven a comprobar tu contraseña actual primero.

## ¿Perdiste tu teléfono _y_ tus códigos de respaldo?

Un **administrador** puede restablecer la 2FA de otro usuario desde **Ajustes → Usuarios** (el botón **Restablecer** en la columna 2FA). Eso borra la 2FA de la cuenta para que el usuario pueda iniciar sesión solo con su contraseña y configurarla de nuevo. Los administradores no pueden restablecer su propia 2FA sin contraseña. Pasan por el proceso normal de desactivación con contraseña, por lo que una sesión de administrador secuestrada no puede eliminar su propio segundo factor.

## Bueno saber

- Los códigos se basan en el tiempo y rotan cada 30 segundos; el panel acepta una pequeña deriva del reloj y se recupera silenciosamente si el reloj del servidor se corrige más tarde.
- Un código no se puede reutilizar; una vez que se utiliza para iniciar sesión, ese mismo código no funcionará de nuevo dentro de su ventana.
- Los códigos incorrectos están sujetos a límites de velocidad. El límite se **comparte** con el paso de la contraseña (un bloqueo por cuenta más un límite por IP `RATE_LIMIT_AUTH_PER_15MIN`), por lo que introducir una contraseña correcta no puede restablecer el contador justo antes de adivinar el código de 6 dígitos.
- Los cambios de 2FA (habilitar, deshabilitar, restablecer, uso de códigos de respaldo) se registran en el [Registro de actividad](/docs/activity/).
