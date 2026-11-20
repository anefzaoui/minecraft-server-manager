---
title: 'Modpacks'
description: 'Instala modpacks de CurseForge, Modrinth, FTB y GT New Horizons como servidores, siempre fijados a una versión exacta del pack.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Volver al índice de documentación](/docs/)

La página **Modpacks** (y la pestaña **Desde Modpack** en el [asistente de creación](/docs/servers/)) instala un modpack como servidor, siempre **fijado a una versión exacta del pack** para que un reinicio nunca pueda actualizar el pack silenciosamente sin que te des cuenta.

![Modpacks](/docs/images/modpacks.png)

## Plataformas compatibles

- **CurseForge**: busca por nombre. Necesita una clave API de CurseForge (añádela en **Ajustes → Claves API**).
- **Modrinth**: busca por nombre.
- **FTB**: packs de Feed The Beast, solo a través de la API (un ID numérico de pack más un ID de versión explícito). El panel aún no comprueba las actualizaciones de los packs FTB.
- **GT New Horizons**: el pack experto 1.7.10, instalado desde el propio índice de lanzamientos de GTNH. GTNH elige su tiempo de ejecución de Java por versión de pack (2.8.0+ se ejecuta en **Java 25** a través de parches lwjgl3ify incluidos, versiones anteriores en Java 21 o 17), y el asistente aumenta la RAM y el disco del servidor a mínimos sensatos para él.
- **Zip personalizado**: no es un pack publicado en absoluto. Sube una **exportación de modpack de CurseForge** (el zip con `manifest.json` que la aplicación de CurseForge produce para un conjunto de mods elegido manualmente), un **`.mrpack` de Modrinth**, o **cualquier zip de archivos jar de mods**. El panel resuelve el manifiesto en bloque (o identifica cada jar por hash/huella digital/metadatos), previsualiza lo que encaja e instala todo en una sola tarea, incluyendo las configuraciones `overrides/` del pack si lo optas. Los mods cuyos autores no permiten descargas automatizadas se listan con un enlace al navegador y una ranura de carga manual en lugar de fallar la instalación.

## Cómo funciona el fijado

Cuando eliges un pack, el panel resuelve la versión exacta, la registra e instala esa. En la página **Actualizaciones** se te informará cuando haya una versión más nueva disponible (a menos que la [política de actualización](#update-policy) del servidor sea **Solo Manual**); actualizar es una acción deliberada y protegida con una copia de seguridad previa a la actualización y reversión. A los servidores que siguen versiones estables nunca se les ofrece una beta. La pestaña **Versiones** del propio servidor responde a la otra mitad de la pregunta: qué versiones futuras de Minecraft pueden seguir los mods que realmente tiene ([actualizaciones](/docs/updates/#minecraft-version-compatibility)).

La versión del cargador de mods también viene con el pack: el servidor instala la compilación de Forge, NeoForge o Fabric que declara el pack. Si un pack de Forge o Fabric de CurseForge declara una versión demasiado antigua para sus propios mods, la pestaña **Versiones** puede anularla hasta que se corrija el pack; una actualización del pack elimina la anulación, ya que la nueva versión declara la suya propia ([cambiar la versión del cargador de mods](/docs/updates/#changing-the-mod-loader-version)).

Los servidores creados en versiones muy antiguas del panel (anteriores a 0.9.7) podían quedar _sin fijar_, lo que significa que la imagen del contenedor instalaba silenciosamente la versión más reciente del pack en cada inicio. El panel ahora las repara al arrancar: bloquea cada una a la versión que está realmente instalada (leída de los propios registros del panel o del manifiesto de instalación de la imagen, nunca de un "último" recién resuelto) y registra un evento. Si no puede determinar qué está instalado, la página de Ajustes del servidor muestra una advertencia con un botón **Seleccionar una Versión…** (packs de CurseForge, Modrinth y GTNH) que abre el [selector de versiones](#changing-the-pack-version), y cualquier intento de guardar una configuración de modpack sin fijar se rechaza rotundamente.

## Política de actualización

Cada servidor tiene una tarjeta **Política de Actualización** en su pestaña **Ajustes → Configuración**, y las tres opciones significan lo que dicen:

- **Solo Manual** (predeterminado): nada cambia por sí solo, y el servidor queda completamente fuera de la insignia de actualización y de la página de Actualizaciones. El modo "déjame en paz": ideal para un pack ajustado manualmente o importado que nunca quieres que se toque. No fija la versión: [**Cambiar Versión…**](#changing-the-pack-version) funciona bajo cualquier política. Para que se te informe sobre nuevas versiones y las apliques con un solo clic, elige **Notificarme**.
- **Notificarme**: la comprobación diaria muestra las actualizaciones disponibles como una insignia y en la página de Actualizaciones; aplicarlas siempre depende de tu clic.
- **Actualización Automática**: después de la comprobación diaria programada, las actualizaciones **del pack** pendientes se aplican a través del mismo camino protegido que una actualización manual: copia de seguridad previa a la actualización, monitorización de salud y reversión automática si la nueva versión falla al arrancar. Las actualizaciones que moverían el servidor a una versión diferente de Minecraft siempre se omiten con un evento en su lugar: convertir un mundo permanentemente es una decisión que el panel se niega a tomar por ti. Los botones manuales de **Comprobar Ahora** solo comprueban; nunca activan las actualizaciones automáticas.

## Actualizar un pack

Desde un servidor fijado puedes actualizar a una versión más reciente en una sola acción. El panel toma una copia de seguridad primero, cambia la versión fijada, reconstruye el servidor (resolviendo de nuevo Java si la nueva versión necesita un tiempo de ejecución diferente) y monitoriza el primer arranque, con una ventana generosa para packs grandes como GTNH que descargan un par de gigabytes y construyen un mundo de varios cientos de mods al principio.

## Cambiar la versión del pack

Para ejecutar una versión específica, más nueva o más antigua, usa **Cambiar Versión…** en la tarjeta del pack de la pestaña **Visión General** del servidor. En la página **Modpacks**, al abrir la tarjeta de un pack instalado se ofrece la misma opción: elige una versión en el desplegable y haz clic en **Cambiar a esta Versión**. Ambas necesitan el permiso **Contenido** del servidor, y ambas están disponibles para los packs de CurseForge, Modrinth y GTNH (los packs FTB aún no tienen lista de versiones). La lista muestra las 25 versiones más recientes para CurseForge y Modrinth, y cada lanzamiento de GTNH.

El cambio pasa por el mismo camino protegido que una actualización: una copia de seguridad previa a la actualización, el nuevo pin, una reconstrucción y un primer arranque supervisado, con una reversión de un clic si el servidor no arranca correctamente. Tus mods personalizados se conservan, al igual que los mods del pack que deshabilitaste, junto con la configuración de instalación del pack (mods forzados, archivos a ignorar, proyectos adicionales). Instalar un pack diferente reinicia esa configuración, ya que solo tiene sentido para el pack para el que se creó.

Cada versión se lista con la versión de Minecraft que ejecuta, comparada con la versión con la que se guardó por última vez tu mundo:

- **Misma versión de Minecraft**: cambia tras una confirmación normal. Volver a una versión de pack anterior puede eliminar bloques y objetos de mods que esa versión no tiene, por lo que la copia de seguridad permanece en la pestaña Copias de seguridad en cualquier caso.
- **Versión más reciente de Minecraft**: permitida tras una confirmación que advierte que el mundo se convertirá permanentemente. La copia de seguridad tomada primero es la única forma de volver al mundo antiguo.
- **Versión anterior de Minecraft**: no disponible. Minecraft no puede cargar un mundo en una versión anterior a la que lo guardó por última vez, por lo que el panel lo rechaza en lugar de dejar un servidor que falla al arrancar.
