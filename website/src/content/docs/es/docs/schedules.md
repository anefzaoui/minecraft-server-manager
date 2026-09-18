---
title: 'Programaciones'
description: 'La página de Programaciones automatiza tareas recurrentes con expresiones cron.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Volver al índice de documentación](/docs/)

La página **Programaciones** automatiza tareas recurrentes con expresiones cron. Sin cron externo, sin scripts.

![Programaciones](/docs/images/schedules.png)

## Qué puedes programar

- **Reinicios** - un reinicio nocturno para mantener un servidor en funcionamiento durante mucho tiempo.
- **Copias de seguridad** - instantáneas regulares (etiquetadas como `scheduled` en la página de [Copias de seguridad](/docs/backups/)).
- **Comandos** - ejecutar cualquier comando del servidor según un horario.
- **Comprobaciones de actualizaciones** - actualizar periódicamente lo que está obsoleto.

Cada programación se dirige a un servidor específico (o al panel globalmente), se ejecuta con su propia expresión cron y puede habilitarse o deshabilitarse sin eliminarla. Se muestra la hora de la última ejecución para que puedas confirmar que se está activando.
