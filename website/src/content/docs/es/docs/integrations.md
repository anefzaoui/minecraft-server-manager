---
title: 'Integraciones'
description: 'Cada servidor tiene sus integraciones dentro del grupo de Configuración: Discord, una Página de Estado pública, Invitaciones de un clic y la pestaña opcional de Chatbot (solo administradores).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Volver al índice de documentación](/docs/)

Cada servidor tiene sus integraciones bajo el grupo **Ajustes**: **Discord**, una **Página de estado** pública, **Invitaciones** con un clic y la pestaña opcional **Chatbot** (solo para administradores). Esta página cubre Discord; [invitaciones y página de estado](/docs/invites-and-status-page/) cubre esas dos, y [el chatbot](/docs/chatbot/) tiene su propia página.

## Notificaciones de Discord

El panel reenvía eventos del servidor a un canal de Discord a través de un webhook. Sin bot, sin OAuth.

### Configuración

1. En Discord: **Configuración del servidor → Integraciones → Webhooks → Nuevo Webhook**. Elige el canal y copia la URL del webhook.
2. En el panel, abre la pestaña **Discord** de **Ajustes** del servidor, pega la URL en **URL del Webhook**, activa la tarjeta **activada** y **Guarda**. La URL se almacena cifrada (en el mismo almacén en reposo que tus claves API).
3. Usa **Enviar prueba** para confirmar que funciona.

![Integración de Discord](/docs/images/integrations-discord.png)

Para reemplazar una URL almacenada, pega una nueva y guarda; deja el campo en blanco para mantener el actual. La URL almacenada se muestra enmascarada (el token está oculto).

### Qué se envía

Las notificaciones se agrupan en categorías que se pueden activar/desactivar. Todas están activadas por defecto.

| Categoría                | Eventos                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| **Inicio / parada**      | Servidor iniciado, servidor detenido                                   |
| **Crashes**              | Crash, bucle de crash detectado, nuevo informe de crash                |
| **Copias de seguridad**  | Copia de seguridad creada, copia de seguridad restaurada               |
| **Actualizaciones**      | Actualización aplicada, actualización revertida, actualización fallida |
| **Expulsiones / baneos** | Jugador expulsado, jugador baneado                                     |
| **Alertas**              | Las cosas que silenciosamente dejan un servidor roto (ver abajo)       |

### La categoría Alertas

`Alertas` es el canal de "algo necesita una intervención humana", para condiciones que antes solo eran visibles en el panel:

| Evento                  | Significado                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | El contenedor se detuvo por quedarse sin memoria.                                                                            |
| `unhealthy`             | El proceso está activo pero la sonda `mc-health` está fallando: un servidor vivo pero muerto.                                |
| `startup-stalled`       | Todavía iniciándose después de ~10 minutos sin un "Done" en los logs (con un diagnóstico de qué arreglar, cuando se conoce). |
| `stop-failed`           | Una parada normal no surtió efecto y el contenedor sigue en ejecución.                                                       |
| `schedule-failed`       | Un reinicio / copia de seguridad / comando programado falló.                                                                 |
| `quota-exceeded`        | La cuota de disco en modo estricto se activó y el servidor se detuvo.                                                        |
| `offline-after-restart` | El servidor estaba activo antes de que el panel se reiniciara, ahora no lo está y no se iniciará automáticamente.            |
| `port-change-failed`    | Un cambio de puerto falló y el servidor no pudo volver a su puerto anterior, por lo que está caído.                          |
| `auto-restart-gave-up`  | Un servidor que falló no se reinició porque otra acción lo mantuvo ocupado demasiado tiempo.                                 |

### Cómo funciona la entrega

Un puente en segundo plano consulta el [registro de actividad](/docs/activity/) cada 15 segundos y reenvía las filas mapeadas. Si una publicación de webhook falla transitoriamente, esa fila se reintenta en sondeos posteriores en lugar de descartarse; después de varios intentos fallidos, la fila se omite y los fallos de entrega se registran como máximo una vez por hora por servidor. Después de un reinicio del panel, el puente envía los eventos que aún no había entregado, pero nunca con más de dos horas de antigüedad; en su primera ejecución, comienza desde el evento más reciente.
