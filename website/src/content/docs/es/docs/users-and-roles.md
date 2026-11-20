---
title: 'Usuarios y roles'
description: 'Cuentas, los roles de administrador, operador y espectador, y permisos por servidor en Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Volver al índice de documentación](/docs/)

El panel es multiusuario. Administra cuentas en **Ajustes → Usuarios**.

![Usuarios](/docs/images/settings-users.png)

## Los tres roles

| Rol          | Por defecto en cada servidor                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Todo: administrar usuarios, claves API, archivos globales, anulaciones avanzadas de Docker y todas las acciones del servidor.                                     |
| **operator** | Ejecutar y configurar servidores (iniciar/detener, consola, copias de seguridad, mundos, mods, la mayoría de ajustes), pero no áreas exclusivas de administrador. |
| **viewer**   | Solo lectura. Ver servidores y su estado, pero sin realizar cambios.                                                                                              |

Cada usuario, incluido un espectador, puede administrar su propia [autenticación de dos factores](/docs/two-factor-authentication/), porque proteger tu propio inicio de sesión no es una acción de administración del servidor.

Un rol es el **predeterminado** para cada servidor. Para otorgar a alguien derechos diferentes en un servidor, usa los permisos por servidor a continuación.

## Permisos por servidor

La página **Permisos** (en la barra lateral, o **Permisos del servidor** en **Ajustes → Usuarios**) muestra una cuadrícula: cada operador y espectador en el lateral, cada servidor en la parte superior. Haz clic en una celda para decidir qué puede hacer ese usuario en ese servidor específico. Los administradores no aparecen en la lista porque siempre tienen todo.

![Permisos](/docs/images/settings-permissions.png)

Cada celda es un conjunto de permisos:

| Permiso                 | Lo que permite en ese servidor                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Ver**                 | Ver el servidor, su estado, salida de consola, jugadores, historial y estadísticas.                            |
| **Potencia**            | Iniciar, detener, reiniciar, matar y reconstruir el servidor.                                                  |
| **Consola**             | Ejecutar comandos de consola y acciones rápidas del mundo, enviar chat y administrar comandos de chat.         |
| **Jugadores**           | Expulsar, banear, agregar a la lista blanca, dar op y editar notas de jugadores.                               |
| **Contenido**           | Instalar y desinstalar mods, plugins, paquetes, mundos, datapacks y editar inventarios.                        |
| **Copias de seguridad** | Crear, restaurar, descargar y eliminar copias de seguridad.                                                    |
| **Archivos**            | Navegar, editar, subir y descargar archivos del servidor, logs archivados y paquetes de logs; exportar planos. |
| **Ajustes**             | Cambiar ajustes del servidor, propiedades, integraciones, icono y versiones de actualización.                  |
| **Eliminar**            | Eliminar el servidor.                                                                                          |

![Editor de permisos](/docs/images/permissions-editor.png)

Debajo de la cuadrícula, **Qué cubre cada permiso** detalla lo que una persona puede hacer con cada permiso, lo que no está incluido y las rutas exactas del panel que desbloquea. Esta última lista es verificada contra el código en ejecución por el conjunto de pruebas.

![Referencia de permisos](/docs/images/permissions-reference.png)

En un teléfono, la cuadrícula se apila en una tarjeta por usuario, con una fila por servidor.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Permisos en un teléfono" width="180">
</p>

Cómo encajan las piezas:

- **El rol es el predeterminado.** Un operador comienza con todos los permisos en todos los servidores; un espectador comienza solo con Ver. Una celda en texto tenue (su información sobre herramientas dice "Predeterminado del rol") nunca ha sido modificada.
- **Una celda anula el rol solo para ese servidor.** Otorga a un espectador Potencia y Consola en un servidor y podrá ejecutarlo, mientras que todos los demás servidores permanecen de solo lectura para él. Quita Eliminar a un operador en tu servidor principal y conservará todo lo demás allí.
- **Cada permiso incluye Ver.** No puedes actuar sobre un servidor que no puedes ver.
- **Desactiva todo para ocultar un servidor.** Desaparece de la barra lateral, el panel, las copias de seguridad, los horarios, la actividad, las actualizaciones, los modpacks, el estado en vivo, las tareas en ejecución y los planos de ese usuario, y la biblioteca de mundos deja de nombrarlo. Un enlace directo, una llamada API o un socket de consola responden "no encontrado", lo mismo que un servidor que no existe.
- **Las acciones a nivel de panel siguen siguiendo el rol.** La creación de servidores (incluida la clonación de uno), el almacenamiento, los usuarios, las claves API, los ajustes globales y los horarios a nivel de panel no son por servidor, por lo que un espectador con permisos en algunos servidores todavía no puede hacer ninguna de esas cosas. Los operadores conservan la creación de servidores y los horarios a nivel de panel; el almacenamiento, los usuarios, las claves API y los ajustes globales son exclusivos para administradores.
- **Los horarios siguen al servidor.** Un reinicio, copia de seguridad o comando programado en un servidor requiere el permiso correspondiente allí (Potencia, Copias de seguridad o Consola), independientemente del rol.
- **Los planos también siguen al servidor.** Exportar un servidor como plano requiere Archivos allí, porque el archivo contiene sus archivos. Un plano exportado desde un servidor que alguien no puede ver también se oculta a esa persona.
- **Las áreas exclusivas para administradores permanecen exclusivas para administradores** en todos los servidores: el chatbot, la retención de copias de seguridad y las anulaciones avanzadas de Docker.

Cada cambio se registra en el registro de actividad indicando quién cambió qué; esas entradas solo se muestran a los administradores. La eliminación de un usuario elimina sus filas. La eliminación de un servidor los mantiene, por lo que un servidor oculto para alguien permanece oculto en su historial y copias de seguridad conservadas.

Las instalaciones existentes continúan funcionando sin cambios: hasta que un administrador edite una celda, cada usuario tiene exactamente lo que su rol les otorgó antes.

## Exclusivo para administradores, y por qué

Algunas cosas están restringidas a los administradores a propósito:

- **Gestión de usuarios, almacenamiento, ajustes globales, claves API y archivos globales.**
- **La [API pública](/docs/public-api/)**: habilitar `/api/v1` y crear, delimitar o revocar sus tokens Bearer de solo lectura.
- **Anulaciones avanzadas de Docker**: nombre de contenedor personalizado, publicaciones de puertos adicionales y montajes de enlace. Un montaje de enlace puede mapear cualquier ruta del host a un contenedor y, combinado con el acceso de Docker del panel, eso es efectivamente acceso root en el host. Estos campos solo aparecen para los administradores.

Los nombres de contenedor personalizados tampoco pueden residir en el propio espacio de nombres `msm-` del panel, por lo que un contenedor con nombre manual nunca puede suplantar a otra instancia y dirigir incorrectamente una detención o un comando a la instancia equivocada.

## Gestión de cuentas

![Imagen de perfil](/docs/images/profile-picture.png)

Los administradores pueden crear usuarios, cambiar roles, restablecer contraseñas y eliminar cuentas desde la tabla de Usuarios. La columna **2FA** muestra si cada usuario tiene habilitada la autenticación de dos factores; un administrador puede restablecer la 2FA de otro usuario con **Restablecer 2FA** en el menú de acciones de ese usuario (para el caso de teléfono perdido y códigos de respaldo), pero nunca deshabilitar la suya propia sin su contraseña, lo cual el flujo de autoservicio maneja en su lugar.

Los inicios de sesión fallidos tienen límites de tasa por cuenta (tanto un contador global por IP como por cuenta) para ralentizar los intentos de fuerza bruta, y el mismo límite cubre el paso del código 2FA para que una contraseña correcta no pueda restablecer el contador antes de adivinar el código. Delante de eso, hay un limitador de solicitudes más general por IP de cliente en los puntos finales de inicio de sesión / 2FA / configuración, ajustable a través de `RATE_LIMIT_AUTH_PER_15MIN` (predeterminado 100; detrás de un proxy inverso, configure `TRUST_PROXY` para que se base en la IP real del cliente).
