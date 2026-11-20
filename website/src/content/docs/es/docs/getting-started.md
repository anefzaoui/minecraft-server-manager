---
title: 'Primeros pasos'
description: 'Instala Minecraft Server Manager y completa la configuración inicial: la comprobación del sistema, tu zona horaria y la cuenta de administrador.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Volver al índice de documentación](/docs/)

## Configuración inicial

La primera vez que abras el panel, un breve asistente de configuración te guiará:

1.  **Comprobación del sistema**: se asegura de que Docker sea accesible, que Node.js sea lo suficientemente reciente y que la carpeta de datos se pueda escribir. Si Docker aún no se está ejecutando, puedes continuar; la creación y el inicio de servidores esperarán hasta que lo esté.
2.  **Crear tu cuenta de administrador**: Esta es la única cuenta que existe hasta que añadas más, y tiene control total. Elige un nombre de usuario (de 2 a 32 caracteres) y una contraseña de al menos 8 caracteres. Iniciarás sesión tan pronto como se cree.
3.  **Configuración del panel** (opcional): un dominio público para mostrar a los jugadores en las direcciones de conexión, una clave API de CurseForge y tu zona horaria. Todo esto se puede cambiar más tarde en **Configuración**.

El último paso ofrece **Crear un servidor** o **Ir al panel de control**.

![El paso de Comprobación del sistema de la configuración inicial](/docs/images/setup-system-check.png)

> **Las instalaciones expuestas requieren PIN.** Si inicias el panel enlazado a una dirección no local (`PANEL_HOST` distinta de `127.0.0.1`), la página de configuración también solicitará un **PIN de 6 dígitos**. El panel lo imprimirá en su consola al iniciarse. Introdúcelo junto con tu nombre de usuario y contraseña. Esto evita que un extraño que llegue primero al puerto reclame la cuenta de administrador. El PIN desaparece una vez que existe la cuenta de administrador.

## Inicio de sesión

Después de la configuración, el panel está protegido por una pantalla de inicio de sesión. Introduce tu nombre de usuario y contraseña para continuar.

![Inicio de sesión](/docs/images/login.png)

Si la [autenticación de dos factores](/docs/two-factor-authentication/) está habilitada en tu cuenta, se te pedirá un código de 6 dígitos de tu aplicación de autenticación justo después de tu contraseña.

## Cómo orientarse

Todo cuelga de la barra lateral izquierda:

- **Panel de control**: todos los servidores de un vistazo ([detalles](/docs/dashboard/)).
- **Servidores**, **Modpacks**, **Mundos**, **Planos**: crea y gestiona servidores y su contenido.
- **Actualizaciones**, **Copias de seguridad**, **Programaciones**, **Almacenamiento**, **Actividad**: el lado operativo: qué está desactualizado, tus instantáneas, automatización, uso del disco y el registro de auditoría.
- **Permisos** (abajo, solo administradores): lo que cada usuario puede hacer en cada servidor ([detalles](/docs/users-and-roles/#per-server-permissions)).
- **Configuración** (abajo, solo administradores): claves API, configuración del panel, valores predeterminados para nuevos servidores, [retención de copias de seguridad](/docs/backups/#retention), usuarios, seguridad de inicio de sesión y la API pública.

Debajo de estos, la barra lateral enumera tus servidores. Al abrir uno, se muestran sus propias pestañas: **Información general**, **Consola**, **Jugadores**, **Mods**, **Mundo**, **Copias de seguridad**, **Monitorización** y **Configuración**, la mayoría con subpestañas relacionadas (por ejemplo, **Configuración → Configuración** contiene la configuración del servidor y su puerto de juego). Consulta [Un solo servidor](/docs/servers/#a-single-server).

La barra superior tiene el botón **Crear un servidor**, un **conmutador de tema** (oscuro/claro) y tu **menú de cuenta**, donde puedes cambiar tu foto de perfil, gestionar la [autenticación de dos factores](/docs/two-factor-authentication/) o cerrar sesión.

## En un teléfono o tableta

Cada página está diseñada primero para una pantalla estrecha y luego se amplía: la barra lateral se oculta detrás del botón de menú, las tablas de datos se apilan en tarjetas, las barras de herramientas se envuelven y el riel de controles del mundo se colapsa en una tarjeta que abres cuando la necesitas. Los botones y chips tienen un tamaño de destino táctil real. Nada es exclusivo para escritorio.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Panel de control en un teléfono" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Información general del servidor en un teléfono" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Consola en un teléfono" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Pestaña de Mods en un teléfono" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Compatibilidad de versiones en un teléfono" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Configuración en un teléfono" width="180">
</p>

## Lo que necesitas

El panel habla con Docker para ejecutar servidores, por lo que necesita acceso a un demonio de Docker (Docker Desktop o un socket de Docker Engine). Cuando Docker es accesible, el mosaico de Docker en el panel de control muestra **Conectado** y su versión. Si no lo está, el panel sigue funcionando. Simplemente no podrás iniciar servidores hasta que el demonio esté en funcionamiento.

## Próximos pasos

- [Crea tu primer servidor →](/docs/servers/)
- [Asegura tu cuenta con 2FA →](/docs/two-factor-authentication/)
