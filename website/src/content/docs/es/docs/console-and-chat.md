---
title: 'Consola y comandos de chat'
description: 'La pestaña Consola transmite el registro del servidor en tiempo real y te proporciona un cuadro de comandos para enviar cualquier comando del servidor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Volver al índice de documentación](/docs/)

## La consola en vivo

La pestaña **Consola** transmite el registro del servidor en tiempo real y te proporciona un cuadro de comandos para enviar cualquier comando del servidor. Sin `docker exec`, sin SSH. La salida regresa en línea, con colores y todo. Para enviar comandos se necesita el permiso Consola en ese servidor; sin él, aún puedes ver el registro.

Encima del registro, puedes filtrar líneas por texto (o por `/expresión regular/`) y por nivel (INFO, WARN, ERROR), y **Descargar** ofrece la salida reciente, el `latest.log` completo, o todos los archivos de registro como un zip.

![Consola](/docs/images/server-console.png)

La consola es también donde el panel lee el estado del servidor: observa el registro para clasificar la fase de arranque ("Cargando mods", "Generando mundo", "Finalizando inicio") y llama a `list` para rastrear quién está en línea, de modo que el panel y las tarjetas del servidor siempre reflejen la realidad.

Ese sondeo abre una conexión RCON de corta duración cada ciclo, que el servidor registra como un par `Thread RCON Client … started` / `shutting down` cada ~20 segundos, y (en servidores cuyo núcleo o plugins lo repiten) una línea `Rcon issued server command: …` por cada sondeo de solo lectura (`list` para recuentos de jugadores, más lecturas de `time query …` y `gamerule <name>` mientras Controles del Mundo está abierto). El interruptor **Ocultar ruido de consola** encima del registro filtra esas líneas (junto con las líneas de inicio del oyente RCON). Está activado por defecto y se recuerda por navegador; desactívalo para ver la transmisión sin procesar.

Los comandos enviados desde el panel se pueden anunciar en el juego bajo una etiqueta por servidor (el cuadro **Anunciar como…**), para que los jugadores sepan que un operador actuó en lugar de una consola misteriosa.

## Chat

**Consola → Chat** envía mensajes al juego mientras el servidor se ejecuta: los mensajes **Estilizados** toman colores y formato y pueden ir a todos o a un jugador en línea, y los **Simples** envían una transmisión simple `[Servidor]` a todos.

![Consola → Chat](/docs/screenshots/04-chat.png)

## Comandos de chat

Los comandos de chat (**Consola → Comandos**) permiten a los jugadores activar acciones del panel escribiendo un comando de prefijo en el chat del juego, por ejemplo `!spawn` para teletransportarse aleatoriamente. La detección se basa en el registro y la ejecución pasa a través del servidor, por lo que **no se requieren mods**.

![Comandos de chat](/docs/images/chat-commands.png)

Cada comando tiene:

- Un **disparador** (p. ej., `spawn`), escrito después del **prefijo** del servidor (`!` por defecto, uno o dos caracteres, nunca `/`).
- Una **acción**: teletransporte aleatorio, teletransporte a una estructura, teletransporte a un bioma o ejecución de comandos de consola sin procesar.
- Un **nivel de permiso**: todos, jugadores en lista blanca u solo operadores.
- Un **cooldown** por jugador (30 segundos por defecto), y mensajes personalizables de espera / éxito / fallo con marcadores como `{distance}`.

### Una nota sobre seguridad

Los comandos que pueden dañar un servidor (`stop`, `op`, `ban`, `whitelist`, y similares) solo se permiten en disparadores **solo para operadores**. El panel verifica esto incluso cuando están anidados dentro de una cadena `execute … run …`, por lo que un disparador de bajo permiso no puede introducir de contrabando un comando peligroso. El texto ordinario del chat que simplemente menciona esas palabras (como un mensaje `say`) se deja intacto.
