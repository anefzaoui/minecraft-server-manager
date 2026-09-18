---
title: 'Consola y comandos de chat'
description: 'La pestaña Consola transmite el registro del servidor en tiempo real y te proporciona un cuadro de comandos para enviar cualquier comando del servidor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Volver al índice de documentación](/docs/)

## La consola en vivo

La pestaña **Consola** transmite el registro del servidor en tiempo real y te proporciona un cuadro de comandos para enviar cualquier comando del servidor. Sin `docker exec`, sin SSH. La salida se muestra en línea, con colores y todo.

![Consola](/docs/images/server-console.png)

La consola es también donde el panel lee el estado del servidor: observa el registro para clasificar la fase de arranque ("Cargando mods", "Generando mundo", "Finalizando inicio") y llama a `list` para rastrear quién está en línea, de modo que el panel y las tarjetas del servidor siempre reflejen la realidad.

Esa consulta abre una conexión RCON de corta duración cada ciclo, que el servidor registra como un par `Thread RCON Client … started` / `shutting down` cada ~20 segundos, y (en servidores cuyo núcleo o plugins lo repiten) una línea `Rcon issued server command: …` para cada consulta de solo lectura: `list` para el recuento de jugadores, además de lecturas de `time query …` y `gamerule <name>` mientras la página de Controles del Mundo está abierta. El interruptor **Ocultar ruido RCON** encima del registro filtra esas líneas (junto con las líneas de inicio del oyente RCON). Está activado por defecto y se recuerda por navegador; desactívalo para ver el flujo sin procesar.

Los comandos enviados desde el panel se pueden anunciar en el juego bajo una etiqueta por servidor, para que los jugadores sepan que un operador actuó en lugar de una consola misteriosa.

## Comandos de chat

Los comandos de chat permiten a los jugadores activar acciones del panel escribiendo un comando de prefijo en el chat del juego, por ejemplo `!spawn` para teletransportarse aleatoriamente. La detección se basa en el registro y la ejecución se realiza a través del servidor, por lo que **no se requieren mods**.

![Comandos de chat](/docs/images/chat-commands.png)

Cada comando tiene:

- Un **disparador** (por ejemplo, `spawn`) y un **prefijo** (`!` por defecto).
- Una **acción**: teletransporte aleatorio, teletransporte a una estructura, teletransporte a un bioma o ejecución de comandos de consola sin procesar.
- Un **nivel de permiso**: todos, jugadores en la lista blanca o solo operadores.
- Un **período de enfriamiento** y mensajes personalizables de pendiente / éxito / fallo con marcadores como `{distance}`.

### Una nota sobre la seguridad

Los comandos que pueden dañar un servidor (`stop`, `op`, `ban`, `whitelist` y similares) solo se permiten en disparadores **solo para operadores**. El panel verifica esto incluso cuando están anidados dentro de una cadena `execute … run …`, por lo que un disparador de bajo permiso no puede introducir de contrabando un comando peligroso. El texto ordinario del chat que simplemente menciona esas palabras (como un mensaje `say`) se deja intacto.
