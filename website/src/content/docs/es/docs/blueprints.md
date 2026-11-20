---
title: 'Planos'
description: 'Los planos guardan la configuración completa de un servidor de Minecraft como una receta reutilizable para crear nuevos servidores. Los secretos nunca se incluyen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Volver al índice de la documentación](/docs/)

Un **blueprint** (plantilla) captura toda la configuración de un servidor (tipo, versión, recursos, entorno, pin del pack, mods personalizados y, opcionalmente, su configuración y mundo) en un único archivo portátil `.mcserver.zip` del que puedes crear nuevos servidores. Los secretos (contraseñas, tokens y claves en el entorno) nunca se escriben en un blueprint.

![Blueprints](/docs/images/blueprints.png)

## Exportación

Desde la pestaña **Configuración → Configuración** de un servidor, usa **Exportar como Blueprint** y elige qué incluir: la configuración del servidor siempre, sus directorios de configuración (activados por defecto) y, opcionalmente, los archivos de mods personalizados (un archivo más grande que se instala sin descargar nada) y el mundo activo. El resultado se guarda en tu biblioteca de blueprints y se puede descargar para compartir.

**Clonar Servidor**, en la misma tarjeta, realiza una exportación e importación en un solo paso para crear una copia del servidor, con o sin su mundo.

## Importación y creación a partir de un blueprint

Importa un archivo de blueprint (**Importar Blueprint** en la página **Blueprints**) o elige uno de la biblioteca (**Crear un Servidor** en su tarjeta, o la pestaña **Desde Blueprint** del asistente) para crear un nuevo servidor preconfigurado exactamente igual que el original. El nuevo servidor obtiene sus propios puertos y una nueva contraseña RCON. Los mods personalizados que no se incrustaron se vuelven a descargar y se verifican con los hashes que registró el blueprint. La biblioteca también comienza con dos blueprints de inicio, uno de Paper y otro de Fabric.

Es la forma más rápida de:

- Poner en marcha servidores idénticos (una red de servidores de minijuegos, copias de staging de producción).
- Mover un servidor entre paneles.
- Mantener una plantilla conocida y fiable a la que siempre puedes recurrir.

Dado que un blueprint registra el [pin del pack](/docs/modpacks/) exacto, un servidor de modpack creado a partir de un blueprint instala la misma versión fijada, sin sorpresas de actualizaciones.
