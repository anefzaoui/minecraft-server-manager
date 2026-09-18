---
title: 'Registro de actividad'
description: 'La página de Actividad es el registro de auditoría completo: un registro cronológico y con capacidad de búsqueda de todo lo que sucedió en el panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Volver al índice de documentación](/docs/)

La página **Actividad** es el registro de auditoría completo: un registro cronológico y con capacidad de búsqueda de todo lo que sucedió en el panel.

![Actividad](/docs/images/activity.png)

## Qué se registra

- **Autenticación** - inicios de sesión (incluyendo si se usó 2FA o un código de respaldo), y la activación, desactivación o restablecimiento de 2FA.
- **Ciclo de vida del servidor** - creaciones, inicios, paradas, reinicios, caídas y eventos de falta de memoria.
- **Alertas** - arranques lentos, fallos de parada, tareas programadas fallidas, paradas por cuota, contenedores no saludables, desconexión después de reiniciar.
- **Datos** - copias de seguridad creadas y restauradas, planos exportados, instalaciones y actualizaciones de paquetes.
- **Configuración** - cambios en comandos de chat, cambios de roles y ediciones de configuración.

Cada entrada registra quién lo hizo (un nombre de usuario o el panel/planificador para acciones automatizadas), a qué servidor se relaciona y cuándo. El [panel](/docs/dashboard/) muestra las entradas más recientes; esta página es el historial completo. Los eventos de ciclo de vida y de alerta también se pueden reenviar a Discord (ver [Integraciones](/docs/integrations/)).

Debido a que captura eventos relevantes para la seguridad (inicios de sesión, cambios de 2FA, cambios de roles), el registro de actividad es también tu primera parada si algo parece sospechoso con una cuenta.
