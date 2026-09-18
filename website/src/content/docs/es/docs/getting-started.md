---
title: 'Primeros pasos'
description: 'La primera vez que abras el panel, te pedirá que crees una cuenta de administrador.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Volver al índice de documentación](/docs/)

## Configuración inicial

La primera vez que abras el panel, te pedirá que crees una cuenta de administrador. Esta es la única cuenta que existe hasta que añadas más, y tiene control total.

Elige un nombre de usuario y una contraseña de al menos 8 caracteres. Eso es todo: ya has iniciado sesión y te llevará directamente al panel de control.

> **Las instalaciones expuestas están protegidas con PIN.** Si inicias el panel conectado a una dirección no local (`PANEL_HOST` distinta de `127.0.0.1`), la página de configuración también te pedirá un **PIN de 6 dígitos**. El panel lo imprime en su consola al iniciarse. Introdúcelo junto con tu nombre de usuario y contraseña. Esto evita que un extraño que llegue primero al puerto reclame la cuenta de administrador. El PIN desaparece una vez que existe la cuenta de administrador.

## Inicio de sesión

Después de la configuración, el panel está protegido por una pantalla de inicio de sesión. Introduce tu nombre de usuario y contraseña para continuar.

![Inicio de sesión](/docs/images/login.png)

Si la [autenticación de dos factores](/docs/two-factor-authentication/) está habilitada en tu cuenta, se te pedirá un código de 6 dígitos de tu aplicación de autenticación justo después de la contraseña.

## Cómo orientarse

Todo cuelga de la barra lateral izquierda:

- **Panel** - todos los servidores de un vistazo ([detalles](/docs/dashboard/)).
- **Servidores**, **Modpacks**, **Mundos**, **Planos** - crea y gestiona servidores y su contenido.
- **Actualizaciones**, **Copias de seguridad**, **Programaciones**, **Almacenamiento**, **Actividad** - el lado operativo: qué está desactualizado, tus instantáneas, automatización, uso del disco y el registro de auditoría.
- **Configuración** (abajo): usuarios, claves API y configuración del panel.

La barra superior tiene el botón **Crear un servidor**, un **selector de tema** (oscuro/claro) y tu **menú de cuenta**, donde puedes gestionar la [autenticación de dos factores](/docs/two-factor-authentication/) o cerrar sesión.

## En un teléfono o tableta

Cada página está diseñada primero para una pantalla estrecha y luego se amplía: la barra lateral se oculta tras el botón del menú, las tablas de datos se apilan en tarjetas, las barras de herramientas se envuelven y el riel de controles del servidor se colapsa en una tarjeta que abres cuando la necesitas. Los botones y chips tienen un tamaño de destino táctil real. Nada es exclusivo para escritorio.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Panel en un teléfono" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Vista general del servidor en un teléfono" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Consola en un teléfono" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Pestaña de mods en un teléfono" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Configuración en un teléfono" width="180">
</p>

## Lo que necesitas

El panel habla con Docker para ejecutar servidores, por lo que necesita acceso a un demonio de Docker (Docker Desktop o un socket de Docker Engine). Cuando Docker es accesible, el mosaico de Docker en el panel de control muestra **Conectado** y su versión. Si no lo es, el panel sigue funcionando. Simplemente no podrás iniciar servidores hasta que el demonio esté en funcionamiento.

## Próximos pasos

- [Crea tu primer servidor →](/docs/servers/)
- [Asegura tu cuenta con 2FA →](/docs/two-factor-authentication/)
