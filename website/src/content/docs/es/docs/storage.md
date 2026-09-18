---
title: 'Almacenamiento'
description: 'La página de Almacenamiento muestra el uso de tu disco: uso por servidor y su tendencia a lo largo del tiempo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Volver al índice de documentación](/docs/)

La página **Almacenamiento** muestra a dónde se está yendo tu disco: uso por servidor y cómo evoluciona con el tiempo.

![Almacenamiento](/docs/images/storage.png)

## Las cuotas de disco son aplicadas por el panel

Docker no puede limitar el uso de disco de un montaje bind, así que el panel lo hace. Un indexador de tamaño en segundo plano recorre el directorio de datos, almacena en caché la huella de cada servidor y aplica la cuota de disco que estableces por servidor. Cuando los datos de un servidor (mundo + copias de seguridad + todo lo demás) se acercan a su cuota, el panel detiene el crecimiento descontrolado en lugar de permitir que un servidor llene tu host.

Establece la cuota de un servidor en su [configuración](/docs/servers/). Los servidores modificados y sus [copias de seguridad](/docs/backups/) pueden ser grandes, así que dales espacio.

## Limpieza

La vista de Almacenamiento te ayuda a encontrar qué podar (copias de seguridad antiguas, mundos no utilizados o un servidor que ha crecido mucho más de lo esperado) antes de que te quedes sin espacio.
