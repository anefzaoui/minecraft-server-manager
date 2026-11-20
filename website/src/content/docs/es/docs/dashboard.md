---
title: 'El panel'
description: 'El panel es tu base de operaciones: cada servidor, su estado en vivo y un registro de lo que ha estado sucediendo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Volver al índice de documentación](/docs/)

El panel de control es tu base de operaciones: cada servidor, su estado en tiempo real y un registro de lo que ha estado sucediendo.

![Panel de control](/docs/images/dashboard.png)

## Los resúmenes

En la parte superior:

- **Servidores en línea**: cuántos de tus servidores se están ejecutando actualmente, del total.
- **Jugadores conectados**: el número total de jugadores en todos los servidores en ejecución.
- **Actualizaciones disponibles**: cuántos servidores, paquetes o mods tienen una versión más reciente ([ver Actualizaciones](/docs/updates/)).
- **Docker**: si el panel puede acceder al demonio de Docker y su versión.

Una segunda fila añade **Memoria asignada** (y cuánta se está utilizando), **Almacenamiento utilizado** en todas las carpetas de datos del servidor, **Salud · 24h** (caídas, detenciones por falta de memoria y reinicios automáticos en el último día), y **Actualizaciones** divididas en actualizaciones de mods y de nivel de servidor. Debajo de ellas, **Servidores por estado** cuenta tus servidores en cada estado, y la **Vista general de recursos** muestra la parte de memoria y CPU de cada servidor.

## Tarjetas de servidor

Cada servidor se muestra como una tarjeta con su estado (En ejecución, Iniciando, Detenido, Caído y estados intermedios como No saludable o Bloqueado), el tipo y la versión de Minecraft, su puerto de juego y sus etiquetas. Cada tarjeta muestra el uso de **jugadores** y **disco** frente a la cuota; los servidores en ejecución también muestran la **CPU** y la **memoria** en tiempo real, actualizadas continuamente.

Haz clic en una tarjeta para abrir ese servidor. La tarjeta vacía **Crear un servidor** y el botón **Crear un servidor** en la barra superior inician el [asistente de creación](/docs/servers/).

Puedes buscar tus servidores (por nombre, tipo, versión o etiqueta), ordenarlos por estado, nombre, tamaño, última vez iniciado o creado, y cambiar entre diseños de cuadrícula y lista con el selector de la derecha.

## Actividad reciente

El registro en la parte inferior muestra las entradas más recientes del historial de auditoría legible por humanos del panel: inicios de sesión, copias de seguridad, exportaciones de planos, comprobaciones de actualizaciones, cambios en comandos de chat, inicios y paradas de servidores, y más. Cada entrada está etiquetada con el servidor al que pertenece (o el propio panel) y hace cuánto tiempo ocurrió. **Ver todo** abre el historial completo en la página [Actividad](/docs/activity/).
