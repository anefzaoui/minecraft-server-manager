---
title: 'Mapa en vivo'
description: 'Activa un mapa 3D en vivo de BlueMap del mundo de un servidor con un solo clic, servido únicamente a través del inicio de sesión del panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Volver al índice de documentación](/docs/)

La pestaña **Mundo → Mapa** de un servidor muestra un mapa 3D en vivo y ampliable de su mundo, generado por [BlueMap](https://bluemap.bluecolored.de/) (gratuito y de código abierto), con las posiciones de los jugadores y todas las dimensiones. El panel lo instala, lo configura y lo sirve; nunca tendrás que abrir un puerto ni editar un archivo de configuración para ello.

## Activarlo

1. Abre el servidor, luego **Mundo → Mapa**.
2. Pulsa **Activar mapa en vivo**. El panel instala la versión de BlueMap que coincide con el cargador y la versión de Minecraft del servidor desde Modrinth, acepta la descarga de recursos de BlueMap por ti y elige un puerto libre para ello.
3. Reinicia el servidor (el cambio se aplica en el siguiente inicio y el servidor se marca como pendiente de uno).

BlueMap se renderiza en segundo plano, por lo que un mapa nuevo tarda unos minutos en dibujar sus primeros fragmentos (tiles). Hasta entonces, la pestaña indica que el mapa aún no está disponible y vuelve a comprobarlo automáticamente. Una vez que esté listo, **Pantalla completa** abrirá el mapa en su propia pestaña del navegador.

Funciona en servidores con un cargador de mods (Fabric, Quilt, Forge, NeoForge) y en servidores de plugins (Paper, Purpur y el resto de la familia Paper, Spigot), incluidos los servidores de modpacks. Los servidores Vanilla no tienen una versión de BlueMap, y la pestaña lo indica.

## Quién puede verlo

El mapa se sirve únicamente a través del panel, detrás de su inicio de sesión: cualquiera que pueda ver el servidor en el panel puede abrir su mapa, y nadie más. El puerto propio de BlueMap nunca debe abrirse a Internet ([puertos de un vistazo](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Activar o desactivar el mapa requiere el permiso **Configuración** del servidor ([usuarios y roles](/docs/users-and-roles/#per-server-permissions)).

Cuando el propio panel se ejecuta en Docker, accede a BlueMap dentro del contenedor del servidor; el [README](https://github.com/anefzaoui/minecraft-server-manager#installation) explica los detalles para configuraciones de proxy inverso.

## Desactivarlo

**Desactivar mapa** elimina el archivo JAR de BlueMap que instaló el panel y libera su puerto, de nuevo a partir del siguiente reinicio. El mundo en sí no se ve afectado; los fragmentos de mapa renderizados permanecen en la carpeta del servidor hasta que los elimines en la pestaña **Archivos**.

Relacionado: [mundos y archivos](/docs/worlds-and-files/), [invitaciones y página de estado](/docs/invites-and-status-page/).
