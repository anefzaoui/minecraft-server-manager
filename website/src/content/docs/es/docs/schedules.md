---
title: 'Programaciones'
description: 'La página de Programaciones automatiza tareas recurrentes con expresiones cron. Sin cron externo, sin scripts.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Volver al índice de documentación](/docs/)

La página **Programaciones** automatiza tareas recurrentes con expresiones cron. Sin cron externo, sin scripts.

![Programaciones](/docs/images/schedules.png)

## Qué puedes programar

- **Reinicios**: un reinicio nocturno para mantener un servidor en ejecución durante mucho tiempo en buen estado.
- **Paradas e inicios**: apagar un servidor durante la noche y volver a encenderlo por la mañana.
- **Copias de seguridad**: instantáneas regulares (etiquetadas como `scheduled` en la página de [Copias de seguridad](/docs/backups/)). Una programación de copias de seguridad también puede reducir el tamaño del mundo después de cada copia de seguridad ([reducir el tamaño de un mundo](/docs/world-shrink/)). Cada servidor nuevo recibe automáticamente una programación de copias de seguridad diarias.
- **Comandos**: ejecutar cualquier comando del servidor según una programación.
- **Comprobaciones de actualizaciones**: actualizar periódicamente lo que está obsoleto. La comprobación programada es también lo que aplica las actualizaciones para los servidores configurados para [Actualización automática](/docs/modpacks/#update-policy).

Cada programación se dirige a un servidor específico (o al panel globalmente), se ejecuta con su propia expresión cron y puede habilitarse o deshabilitarse sin eliminarla. El editor previsualiza las próximas horas de ejecución mientras escribes, los tiempos cron siguen la zona horaria del panel (establecida en **Configuración**), y la tabla muestra la próxima ejecución de cada programación. Cada ejecución se registra como un evento en el historial, al igual que una ejecución fallida.

El panel también establece sus propias programaciones de mantenimiento al arrancar por primera vez, que puedes reprogramar o desactivar: una comprobación de actualizaciones diaria, un reescaneo del almacenamiento cada seis horas, una limpieza diaria de archivos temporales antiguos, una revisión de caducidad de baneos cada 15 minutos (levantando baneos temporales que han expirado), y un relleno de metadatos de contenido nocturno (rellenando nombres e iconos de mods faltantes).

## Cuando el servidor está ocupado

Una copia de seguridad o inicio programado que encuentra su servidor en medio de otra acción (una restauración, una limpieza de copias de seguridad, un cambio de puerto) espera e intenta de nuevo cada minuto hasta que esa acción finaliza, durante un máximo de 30 minutos. Un inicio en espera se cancela si alguien inicia o detiene el servidor mientras tanto. Un reinicio o parada programado no se reintenta: se omite y se ejecuta de nuevo en su próxima hora programada.
