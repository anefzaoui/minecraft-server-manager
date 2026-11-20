---
title: '¿Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: cuál elegir?'
description: '¿Vanilla, Paper, Fabric, Forge, NeoForge o Quilt: qué tipo de servidor de Minecraft ejecutar, elegido según lo que instalen tus jugadores?'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Volver al índice de documentación](/docs/)

Elige según lo que quieras que los jugadores instalen, no según lo que suene más rápido.

| Quieres                                                    | Ejecuta esto        | Los jugadores instalan |
| ---------------------------------------------------------- | ------------------- | ---------------------- |
| Supervivencia con amigos, nada inusual                     | Vanilla             | Nada                   |
| Un servidor público con rangos, reclamaciones y moderación | Paper               | Nada                   |
| Un modpack específico de CurseForge o Modrinth             | Lo que diga el pack | El pack                |
| Un modpack moderno que estés creando tú mismo              | Fabric o NeoForge   | Los mismos mods        |
| Un pack antiguo de la era 1.7 a 1.12                       | Forge               | Los mismos mods        |

Esa es la decisión para la mayoría de la gente. El resto de esta página explica por qué.

## Los plugins y los mods no son lo mismo

Esta es la distinción de la que depende todo lo demás.

Los **plugins** solo se ejecutan en el servidor. Paper, Spigot y Bukkit los cargan. Los jugadores se unen con un cliente normal y sin modificar y nunca se enteran. Cualquier cosa que trate fundamentalmente sobre reglas, permisos, economías, reclamaciones, minijuegos o moderación es un plugin, y por eso casi todos los servidores públicos ejecutan Paper.

Los **mods** cambian el juego en sí: nuevos bloques, nuevas dimensiones, nuevas máquinas. El cliente tiene que cargar los mismos mods que el servidor, o no podrá entender lo que el servidor le está diciendo. Cualquiera que se una a un servidor modificado instala primero el pack.

Un servidor no puede ser significativamente ambas cosas. Existen proyectos híbridos que añaden una API de plugins a un cargador de mods, y funcionan hasta que dejan de hacerlo, normalmente en el peor momento. Si necesitas ambas cosas, ejecuta un proxy con un servidor modificado y un servidor de plugins detrás de él en lugar de un híbrido.

## El lado de los plugins

**Paper** es la respuesta por defecto. Es un fork de Spigot con años de trabajo de rendimiento y un archivo de configuración para casi todos los comportamientos que han molestado alguna vez a un administrador. La mayoría de los plugins de Vanilla de la era de Bukkit todavía funcionan.

**Purpur** es un fork de Paper con aún más opciones, incluidas las de jugabilidad. Úsalo si quieres esos interruptores específicos; de lo contrario, usa Paper.

**Vanilla** merece la pena ejecutarlo cuando el objetivo es el juego sin cambios. Es más lento con muchos jugadores y no tiene sistema de permisos, por lo que la moderación es manual.

Paper cambia algunos comportamientos de Vanilla por defecto en nombre del rendimiento. Si un artilugio de redstone de un vídeo no funciona en tu servidor, esa suele ser la razón, y normalmente es una configuración.

## El lado de los mods

**Fabric** es pequeño, se actualiza a una nueva versión de Minecraft en cuestión de días y lleva la mayoría de los mods de rendimiento modernos. Casi todos los mods de Fabric también quieren la Fabric API, que es una descarga separada. Si tu objetivo es un servidor rápido con un puñado de mods de calidad de vida, este es el tuyo.

**NeoForge** es donde el antiguo ecosistema de Forge realiza ahora su trabajo para las versiones actuales. Se separó de Forge durante la 1.20.1 y la mayoría de los packs grandes creados para la 1.20.2 y posteriores lo tienen como objetivo. Si estás empezando un nuevo pack pesado hoy en día, este es el tuyo.

**Forge** todavía domina el pasado. Cualquier cosa de las eras 1.7.10, 1.12.2 y 1.16.5, que es una gran parte de los packs queridos, es Forge y siempre lo será. Mantenlo para esos.

**Quilt** es un fork de Fabric que ejecuta la mayoría de los mods de Fabric. Existe por buenas razones, pero si no tienes una razón específica para elegirlo, elige Fabric.

Los mods para un cargador no funcionan en otro. Una página de mods que dice Fabric significa Fabric.

## Si estás instalando un pack, el pack decide

No elijas. El pack enumera su cargador y su versión exacta de Minecraft, y ambas deben coincidir. "Casi" no es una cosa aquí: un pack para 1.20.1 no funciona en 1.20.4, y un pack NeoForge 1.20.1 no funciona en Forge 1.20.1.

Instala el pack por su ID o enlace en lugar de seleccionando mods manualmente, y fija la versión. Los packs se actualizan, y una actualización que te pilla desprevenido a mitad de temporada es la forma en que los mundos se corrompen.

## Qué versión de Java

El requisito de Minecraft se mueve con el juego, y ejecutar la incorrecta produce un `UnsupportedClassVersionError` poco útil en lugar de un mensaje claro.

| Versión de Minecraft | Java |
| -------------------- | ---- |
| 1.16.5 y anteriores  | 8    |
| 1.17                 | 16   |
| 1.18 y 1.19          | 17   |
| 1.20 a 1.20.4        | 17   |
| 1.20.5 a 1.21.x      | 21   |
| 26.1 y posteriores   | 25   |

Los packs antiguos realmente necesitan Java 8; este es uno de los pocos lugares en el software donde la versión más reciente es incorrecta.

## En Minecraft Server Manager

El asistente de creación pregunta qué quieres ejecutar y elige la versión de Java de la tabla anterior, por lo que el desajuste nunca ocurre por accidente. Vanilla, Paper y Purpur están en su pestaña **Vanilla**; la pestaña **Desde Mods** acepta Fabric, Forge, NeoForge o Quilt, con la versión de Minecraft y una compilación del cargador (la última, o una que fijes). Instalar un pack de CurseForge, Modrinth o GT New Horizons lo fija a una versión exacta. La actualización solo ocurre cuando la aplicas (o después de la comprobación diaria, si la política de actualización del servidor es **Actualización Automática**), siempre hace una copia de seguridad primero y se puede revertir.

El navegador de mods sabe qué cargador ejecuta un servidor y filtra lo que ofrece en consecuencia, por lo que un jar de Fabric no puede terminar en un servidor NeoForge por error.

Relacionado: [creación y gestión de servidores](/docs/servers/), [modpacks](/docs/modpacks/),
[cuánta RAM necesita un servidor](/docs/guide-server-memory/).
