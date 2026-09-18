---
title: 'El panel'
description: 'El panel es tu base de operaciones: cada servidor, su estado en vivo y un registro de lo que ha estado sucediendo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Volver al índice de documentación](/docs/)

El panel es tu base de operaciones: cada servidor, su estado en vivo y un registro de lo que ha estado sucediendo.

![Panel](/docs/images/dashboard.png)

## Los mosaicos de resumen

En la parte superior:

- **Servidores en línea**: cuántos de tus servidores se están ejecutando actualmente.
- **Jugadores conectados**: el número total de jugadores en todos los servidores en ejecución.
- **Actualizaciones disponibles**: cuántos servidores, paquetes o mods tienen una versión más reciente ([ver Actualizaciones](/docs/updates/)).
- **Docker**: si el panel puede acceder al demonio de Docker y su versión.

## Tarjetas de servidor

Cada servidor se muestra como una tarjeta con su estado (En ejecución, Iniciando, Detenido, Fallido), el tipo y la versión de Minecraft, y su puerto de juego. Para los servidores en ejecución, también obtienes el uso en vivo de **jugadores**, **CPU**, **memoria** y **disco**, actualizado continuamente.

Haz clic en una tarjeta para abrir ese servidor. La tarjeta vacía **Crear un servidor** y el botón **Crear un servidor** en la barra superior inician el [asistente de creación](/docs/servers/).

Puedes buscar y ordenar tus servidores, y cambiar entre diseños de cuadrícula y lista con el interruptor de la derecha.

## Actividad reciente

El registro en la parte inferior es un registro de auditoría en vivo y legible por humanos: inicios de sesión, copias de seguridad, exportaciones de planos, comprobaciones de actualizaciones, cambios en comandos de chat, inicios y paradas de servidores, y más. Cada entrada está etiquetada con el servidor al que pertenece (o el propio panel) y hace cuánto tiempo ocurrió. El historial completo se encuentra en la página [Actividad](/docs/activity/).
