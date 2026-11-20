---
title: 'Registro de actividad'
description: 'La página de Actividad es el registro de auditoría completo: un registro cronológico y con capacidad de búsqueda de todo lo que sucedió en el panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Volver al índice de documentación](/docs/)

La página **Actividad** es el registro de auditoría completo: un registro cronológico y con capacidad de búsqueda de todo lo que sucedió en el panel. Filtra por servidor o por tipo de evento, busca en los resúmenes y exporta lo que hayas filtrado como CSV o JSON. Las entradas que capturaron un registro (un fallo, por ejemplo) lo abren en el lugar.

![Actividad](/docs/images/activity.png)

## Qué se registra

- **Autenticación**: inicios de sesión (incluyendo si se usó 2FA o un código de respaldo), bloqueos de cuenta, cambios de contraseña y activación, desactivación o restablecimiento de 2FA.
- **Ciclo de vida del servidor**: creaciones, inicios, paradas, reinicios, fallos, reinicios automáticos y eventos de falta de memoria.
- **Alertas**: arranques lentos, fallos de parada, programaciones fallidas, paradas por cuota, contenedores no saludables, desconexión-después-de-reinicio.
- **Datos**: copias de seguridad creadas y restauradas, planos exportados, instalaciones y actualizaciones de paquetes, cambios de mods y mundos, y ediciones de archivos.
- **Jugadores**: expulsiones, baneos, cambios en la lista blanca y de operadores, y notas de jugadores.
- **Configuración**: cambios en comandos de chat, cambios de usuarios y roles, cambios de permisos por servidor, cambios de puertos de juego y ediciones de configuración.

Cada entrada registra quién lo hizo (un nombre de usuario, o el panel/planificador para acciones automatizadas), a qué servidor se relaciona y cuándo. El [panel](/docs/dashboard/) muestra las entradas más recientes; esta página es el historial completo. Los operadores y espectadores solo ven las entradas de los servidores que pueden ver (más las generales del panel), y los cambios de permisos por servidor solo se muestran a los administradores. Los eventos de ciclo de vida y alerta también se pueden reenviar a Discord (ver [Integraciones](/docs/integrations/)).

Debido a que captura eventos relevantes para la seguridad (inicios de sesión, cambios de 2FA, cambios de roles y permisos), el registro de actividad es también tu primera parada si algo parece sospechoso con una cuenta.
