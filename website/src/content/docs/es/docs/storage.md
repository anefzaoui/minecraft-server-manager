---
title: 'Almacenamiento'
description: 'Consulta dónde se consume el espacio en disco, limita cada carpeta de servidor con una cuota de disco y elimina lo que ya no necesites.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Volver al índice de documentación](/docs/)

La página **Almacenamiento** muestra a dónde va tu disco: uso por categoría, cada servidor frente a su cuota, los archivos más grandes y cómo evoluciona el uso total en escaneos recientes. Es solo para administradores.

![Almacenamiento](/docs/images/storage.png)

## Las cuotas de disco son aplicadas por el panel

Docker no puede limitar el uso de disco de un montaje de enlace (bind mount), así que el panel lo hace. Un indexador de tamaño en segundo plano recorre la carpeta de datos (cada 15 minutos, después de cambios, o cuando pulsas **Volver a escanear ahora**), almacena en caché la huella de cada servidor y aplica la cuota de disco que estableces por servidor. Una acción que llevaría la carpeta de un servidor (mundo, mods, configuraciones, logs y todo lo demás) por encima de su cuota, como instalar un mod o un mundo o subir archivos, se bloquea hasta que se libere espacio o se aumente la cuota, en lugar de permitir que un servidor llene tu host.

Establece la cuota de un servidor en su [configuración](/docs/servers/#server-settings). Activar **Detener el servidor si supera la cuota** allí también detiene un servidor en ejecución una vez que su carpeta crece más del 10% por encima de la cuota, y lo anota en el historial del servidor. Los servidores con mods pueden ser grandes, así que dales espacio. Las [copias de seguridad](/docs/backups/) se almacenan por separado y no cuentan para la cuota.

## Limpieza

La tarjeta **Limpieza con un clic** libera espacio que el panel puede reclamar de forma segura: archivos temporales de más de una hora, archivos de biblioteca huérfanos y logs y reportes de fallos archivados de más de 30 días. Cada uno muestra cuánto libera y abre una vista previa antes de que se elimine nada. Las listas **Por categoría** y **Archivos más grandes** enlazan directamente al gestor de archivos, para que puedas encontrar qué más podar antes de que te quedes sin espacio.
