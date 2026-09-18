---
title: 'Modpacks'
description: 'La página de Modpacks (y la pestaña "Desde modpack" en el asistente de creación) instala un modpack como servidor, siempre fijado a una versión exacta del pack para que un reinicio pueda'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Volver al índice de documentación](/docs/)

La página **Modpacks** (y la pestaña **Desde modpack** en el [asistente de creación](/docs/servers/)) instala un modpack como servidor, siempre **fijado a una versión exacta del pack** para que un reinicio nunca pueda actualizar el pack silenciosamente sin que te des cuenta.

![Modpacks](/docs/images/modpacks.png)

## Plataformas compatibles

- **CurseForge** - busca o pega la URL de un pack. Necesita una clave API de CurseForge para buscar y para packs privados (añádela en Ajustes → Claves API).
- **Modrinth** - busca por nombre.
- **FTB** - packs de Feed The Beast.
- **GT New Horizons** - el pack experto 1.7.10, instalado desde el propio índice de lanzamientos de GTNH. GTNH elige su runtime de Java por versión de pack (2.8.0+ se ejecuta en **Java 25** a través de parches lwjgl3ify incluidos, versiones anteriores en Java 21 o 17), y el asistente aumenta la RAM y el disco del servidor a mínimos sensatos para él.
- **Zip personalizado** - no es un pack publicado en absoluto: sube una **exportación de modpack de CurseForge** (el zip con `manifest.json` que la aplicación de CurseForge produce para un conjunto de mods elegido manualmente) o **cualquier zip de archivos jar de mods**. El panel resuelve el manifiesto en bloque a través de la API de CurseForge (o identifica cada jar por hash/huella digital/metadatos), previsualiza lo que encaja e instala todo en una sola tarea, incluyendo las configuraciones `overrides/` del pack si optas por ello. Los mods cuyos autores no permiten descargas automáticas se listan con un enlace al navegador y una ranura de carga manual en lugar de fallar la instalación.

## Cómo funciona la fijación

Cuando eliges un pack, el panel resuelve la versión exacta, la registra y la instala. En la página **Actualizaciones** se te informará cuando haya una versión más nueva disponible; la actualización es una acción deliberada y protegida con una copia de seguridad previa a la actualización y un rollback. A los servidores que siguen la versión estable nunca se les ofrece una beta.

Los servidores creados en versiones muy antiguas del panel (antes de la 0.9.7) podían quedar _sin fijar_, lo que significaba que la imagen del contenedor instalaba silenciosamente la versión más reciente del pack en cada inicio. El panel ahora las repara al arrancar: bloquea cada una a la versión que está realmente instalada (leída de los propios registros del panel o del manifiesto de instalación de la imagen, nunca de un "último" recién resuelto) y registra un evento. Si no puede determinar qué está instalado, la página de Ajustes del servidor muestra una advertencia pidiéndote que elijas la versión manualmente, y cualquier intento de guardar una configuración de modpack sin fijar se rechaza rotundamente.

## Política de actualización

Cada servidor tiene una política de actualización en **Ajustes**, y las tres opciones significan lo que dicen:

- **Solo manual** - nada cambia por sí solo, y el servidor queda completamente fuera de la insignia de actualización y de la página de Actualizaciones. El modo "déjame en paz": ideal para un pack ajustado manualmente o importado que nunca quieres que se toque.
- **Notificarme** (predeterminado) - la comprobación diaria muestra las actualizaciones disponibles como una insignia y en la página de Actualizaciones; aplicarlas siempre depende de tu clic.
- **Actualización automática** - después de la comprobación diaria programada, las actualizaciones **del pack** pendientes se aplican a través de la misma ruta protegida que una actualización manual: copia de seguridad previa a la actualización, monitorización de la salud y un rollback automático si la nueva versión falla al arrancar. Las actualizaciones que moverían el servidor a una versión diferente de Minecraft siempre se omiten con un evento en su lugar; convertir un mundo permanentemente es una decisión que el panel se niega a tomar por ti. Los botones manuales de "comprobar ahora" solo comprueban; nunca activan las actualizaciones automáticas.

## Actualizar un pack

Desde un servidor fijado puedes actualizar a una versión más reciente en una sola acción. El panel realiza una copia de seguridad primero, cambia la versión fijada, recrea el contenedor (resolviendo de nuevo Java si la nueva versión necesita un runtime diferente) y monitoriza el primer arranque, con una ventana generosa para packs grandes como GTNH que descargan un par de gigabytes y construyen un mundo de varios cientos de mods en el primer inicio.
