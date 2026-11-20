---
title: 'Reducir el tamaño de un mundo'
description: 'Reduce el tamaño de un mundo de Minecraft eliminando fragmentos (chunks) poco visitados para recuperar espacio en disco y acelerar las copias de seguridad.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Volver al índice de documentación](/docs/)

Con el tiempo, un mundo se expande: cada lugar por el que un jugador ha caminado, volado o ha sido transportado por una perla de ender deja fragmentos generados en el disco, incluso si nadie regresó. **Reducir mundo** elimina los fragmentos en los que casi nadie ha pasado tiempo, por lo que el mundo ocupa menos espacio. Minecraft reconstruye un área eliminada a partir de la semilla del mundo en el momento en que alguien vuelve a viajar allí, por lo que esto es seguro para la tierra que nadie está utilizando, pero cualquier cosa que un jugador _construyera_ en un lugar en el que apenas estuvo también desaparecería, por eso deberías hacer una copia de seguridad primero (la copia de seguridad es el deshacer).

## ¿Qué cuenta como "visitado raramente"?

Cada fragmento registra cuánto tiempo han pasado los jugadores en él (Minecraft llama a esto `InhabitedTime`). Reducir mundo elimina cualquier fragmento con **menos de 30 segundos** de tiempo total de jugador por defecto; el diálogo de reducción te permite cambiar ese umbral (de 1 segundo a 1 hora) y cuántos fragmentos alrededor del punto de aparición se conservan (por defecto 8, `0` desactiva la protección del punto de aparición).

Lo que se conserva, siempre:

- El área alrededor del **punto de aparición** del mundo (leído de `level.dat`) en el overworld. El Nether, el End y las dimensiones personalizadas no tienen área de aparición.
- Cualquier fragmento cuyo tiempo de visita no se pudo leer, por ejemplo, un mundo guardado con un formato de compresión que el panel no decodifica (LZ4). La vista previa y el resultado te indican cuántos fragmentos de este tipo se omitieron.

Se cubren todas las dimensiones del mundo: carpetas hermanas estilo Bukkit (`world_nether`, `world_the_end`) así como el diseño vanilla y Forge/Fabric (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Cuando se elimina un fragmento, sus entidades y puntos de interés de aldeanos desaparecen con él, por lo que un fragmento regenerado no hereda mobs obsoletos, vagonetas o lugares de trabajo.

## Hacerlo desde la pestaña Mundos

1. Haz una copia de seguridad desde la pestaña **Copias de seguridad**. Reducir desde la pestaña Mundos no hace una por ti.
2. Abre **Mundo → Mundos**, busca el mundo y haz clic en el icono de reducir.
3. Haz clic en **Vista previa** para ver aproximadamente cuántos fragmentos (y cuántos megabytes) se eliminarían. Todavía no se ha cambiado nada; una vista previa funciona mientras el servidor está en ejecución.
4. Haz clic en **Reducir mundo**. La reducción edita los archivos del mundo directamente, por lo que el servidor debe estar detenido: deténlo primero, o marca la opción para detenerlo, reducirlo y volver a iniciarlo de una vez (el servidor se reinicia incluso si la reducción falla). El progreso se muestra en la bandeja de tareas.

![Reducir mundo](/docs/images/world-shrink.png)

## Hacerlo como parte de una copia de seguridad

En la pestaña **Copias de seguridad**, marca **"Reducir también el mundo después"** antes de **Hacer copia de seguridad ahora**. El archivo de copia de seguridad se escribe primero (ese archivo es tu deshacer), luego se reduce el mundo, pero solo si el servidor está detenido. Si el servidor está en ejecución, la copia de seguridad aún se ejecuta y la reducción se omite con una nota.

Las copias de seguridad programadas tienen la misma opción: en el editor de programación, elige la tarea **Copia de seguridad** y marca **"Reducir el mundo después de cada copia de seguridad"**. Combínalo con una programación de **Detener servidor** unos minutos antes si deseas que se ejecute sin supervisión.
