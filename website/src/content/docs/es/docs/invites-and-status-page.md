---
title: 'Página de invitaciones y estado'
description: 'Invita amigos a un servidor con la dirección, versión y un modpack de cliente, y comparte una página de estado pública que muestre solo lo que tú elijas.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Volver al índice de documentación](/docs/)

Dos pestañas dentro del grupo **Ajustes** de un servidor ayudan a los jugadores a encontrarlo y unirse a él: **Invitaciones** escribe todo lo que un amigo necesita para conectarse, y **Página de estado** publica una pequeña página pública que muestra si el servidor está en línea. Ambas requieren el permiso de **Ajustes** del servidor ([usuarios y roles](/docs/users-and-roles/#per-server-permissions)).

## Invitaciones

**Ajustes → Invitaciones** tiene una tarjeta **Invitar amigos**:

- **Dirección para compartir** enumera las direcciones de la máquina en tu red local con el puerto de juego del servidor, tu dirección pública cuando el panel pudo detectarla (los jugadores fuera de tu red solo pueden acceder a ella mediante reenvío de puertos), y **Dirección personalizada…** para un dominio o dirección que hayas configurado tú mismo, como `play.example.com:25565`.
- **Texto de invitación** es un mensaje listo para pegar con el nombre del servidor, la dirección que elegiste y su versión y tipo de Minecraft. **Copiar texto de invitación** lo pone en el portapapeles. Cuando la lista blanca está activada, el texto pide a los amigos su nombre de usuario de Minecraft, y la tarjeta te recuerda que añadas a cada amigo en la pestaña **Jugadores** antes de que se unan.
- **Lo que los amigos necesitan** dice lo que se requiere del lado del jugador: nada más que la versión correcta de Minecraft para un servidor vanilla o con plugins (Paper y similares), o los mods del servidor para uno modificado.

### El modpack del cliente

En un servidor modificado, la tarjeta también ofrece **Descargar Modpack del Cliente (.mrpack)**. Los amigos lo importan en Prism Launcher o en la aplicación Modrinth, que instala la versión de Minecraft y el cargador de mods del servidor, descarga los mods y añade el servidor a su lista multijugador con la dirección que elegiste.

El archivo se crea a partir de los mods que añadiste tú mismo al servidor (la superposición de mods personalizados) que provienen de Modrinth. Los mods de otros lugares se enumeran en la tarjeta en su lugar, para que los amigos puedan añadir esos archivos a su carpeta `mods` manualmente. En un servidor creado a partir de un modpack, los amigos deberían instalar ese pack, en la versión que ejecuta el servidor, en su lanzador; la pestaña **Descripción general** muestra la versión.

### Jugar a través de Internet

**Jugar a través de Internet (reenvío de puertos)** en la parte inferior de la tarjeta explica el lado del router: reenvía el puerto de juego del servidor (TCP y UDP) a la máquina que ejecuta el panel, y luego comparte tu dirección pública con el puerto. Si tu proveedor de Internet utiliza CGNAT, el reenvío de puertos no puede funcionar, y un servicio de túnel (por ejemplo, playit.gg) es la solución. El panel no abre puertos del router por sí mismo. Solo los puertos de juego deben estar en Internet; mantén cerrado el puerto propio del panel y los puertos RCON ([puertos de un vistazo](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Página de estado

**Ajustes → Página de estado** activa una página pública para un servidor, desactivada por defecto:

1. Activa la tarjeta.
2. Elige la **Dirección de la página**: la página se encuentra en `/status/<dirección>` en tu panel, y la dirección tiene entre 3 y 40 letras minúsculas, números o guiones, única entre tus servidores.
3. Pulsa **Guardar**. **Abrir página** y **Copiar enlace** te proporcionan entonces el enlace para compartir.

Cualquiera con el enlace verá el nombre del servidor, su MOTD, versión, si está en ejecución, el número de jugadores y su tiempo de actividad, y nada más. La página no tiene enlace al panel y no requiere inicio de sesión. Lee el estado en memoria del panel, por lo que los visitantes nunca causan trabajo en el demonio de Docker.

Desactivar la página conserva su dirección, por lo que al volver a activarla se restaura el mismo enlace. Para una página o un bot propio, la [API pública](/docs/public-api/) devuelve el mismo tipo de estado en formato JSON.

Relacionado: [notificaciones de Discord](/docs/integrations/), [el mapa en vivo](/docs/live-map/), [creación y gestión de servidores](/docs/servers/).
