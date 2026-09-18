---
title: 'Usuarios y roles'
description: 'El panel es multiusuario.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Volver al índice de documentación](/docs/)

El panel es multiusuario. Gestiona cuentas en **Ajustes → Usuarios**.

![Usuarios](/docs/images/settings-users.png)

## Los tres roles

| Rol            | Puede hacer                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**      | Todo: gestionar usuarios, claves API, archivos globales, anulaciones avanzadas de Docker y todas las acciones del servidor.                                       |
| **operador**   | Ejecutar y configurar servidores (iniciar/detener, consola, copias de seguridad, mundos, mods, la mayoría de ajustes), pero no áreas exclusivas de administrador. |
| **espectador** | Solo lectura. Ver servidores y su estado, pero sin realizar cambios.                                                                                              |

Cada usuario, incluido un espectador, puede gestionar su propia [autenticación de dos factores](/docs/two-factor-authentication/), ya que proteger tu propio inicio de sesión no es una acción de gestión del servidor.

## Exclusivo para administradores, y por qué

Algunas cosas están restringidas a los administradores a propósito:

- **Gestión de usuarios, claves API y archivos globales.**
- **La [API pública](/docs/public-api/)** - habilitar `/api/v1` y crear, delimitar o revocar sus tokens Bearer de solo lectura.
- **Anulaciones avanzadas de Docker** - nombre de contenedor personalizado, publicaciones de puertos adicionales y montajes de enlace. Un montaje de enlace puede mapear cualquier ruta del host al contenedor, y combinado con el acceso de Docker del panel, eso es efectivamente root en el host. Estos campos solo aparecen para los administradores.

Los nombres de contenedores personalizados tampoco pueden residir en el propio espacio `msm-` del panel, por lo que un contenedor con nombre manual nunca puede solapar a otro servidor y dirigir erróneamente una parada o un comando a la instancia incorrecta.

## Gestión de cuentas

![Imagen de perfil](/docs/images/profile-picture.png)

Los administradores pueden crear usuarios, cambiar roles, restablecer contraseñas y eliminar cuentas desde la tabla de Usuarios. La columna **2FA** muestra si cada usuario tiene la autenticación de dos factores habilitada; un administrador puede **restablecer** la 2FA de otro usuario (para el caso de teléfono perdido y códigos de respaldo), pero nunca deshabilitar la suya propia sin su contraseña, lo cual el flujo de autoservicio maneja en su lugar.

Los inicios de sesión fallidos están limitados por tasa por cuenta (tanto un contador por IP como un contador global de la cuenta) para ralentizar los intentos de fuerza bruta, y el mismo límite cubre el paso del código 2FA para que una contraseña correcta no pueda restablecer el contador antes de adivinar el código. Delante de eso hay un limitador de solicitudes por IP de cliente más general en los puntos finales de inicio de sesión / 2FA / configuración, configurable a través de `RATE_LIMIT_AUTH_PER_15MIN` (por defecto 100; detrás de un proxy inverso, establece `TRUST_PROXY` para que se base en la IP real del cliente).
