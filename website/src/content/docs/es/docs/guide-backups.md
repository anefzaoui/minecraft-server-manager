---
title: 'Copias de seguridad de servidores de Minecraft que realmente se restauran'
description: 'Cómo hacer copias de seguridad de servidores de Minecraft que realmente se restauran: copias consistentes, guardadas en otro lugar y probadas al menos una vez.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Volver al índice de documentación](/docs/)

La mayoría de los servidores tienen copias de seguridad. Pocos tienen copias de seguridad que funcionan, y la diferencia solo se descubre en el peor de los días. Tres cosas las diferencian: la copia es consistente, vive en otro lugar y alguien la ha restaurado al menos una vez.

## Copiar el mundo mientras no se está escribiendo

Un servidor en ejecución escribe archivos de región continuamente. Cópialos a mitad de la escritura y obtendrás un archivo que es mitad viejo y mitad nuevo, que o bien no se carga o bien se carga con un agujero en el suelo donde solía estar la base de alguien. Nada te advertirá, porque la copia tuvo éxito.

Hay dos formas correctas de hacer una copia:

1. **Detener el servidor**, copiar, volver a iniciarlo. Sencillo, honesto y poco popular debido al tiempo de inactividad.
2. **Indicar al juego que deje de escribir primero.** Ejecuta `save-off`, luego `save-all flush`, espera a que termine, copia, luego `save-on`. El mundo está completo y en silencio durante la duración de la copia.

Nunca te saltes directamente a la copia. Una instantánea a nivel del sistema de archivos o del volumen solo es válida si es genuinamente atómica, y un `cp -r` mientras los jugadores colocan bloques no lo es.

## Copia de seguridad de más que solo el mundo

Restaurar solo el mundo te da el terreno y pierde el servidor. También necesitas:

- `server.properties`, y cualquier otra cosa que establezca las reglas.
- Los archivos JAR de mods o plugins, en las versiones exactas que se estaban ejecutando. Un mundo no se cargará sin los mods que crearon sus bloques.
- Datos del jugador, incluyendo `whitelist.json`, `ops.json` y las carpetas de estadísticas y avances.
- La versión del pack, si provino de un pack. Anotarla cuenta.

La comprobación de cordura más rápida de cualquier copia de seguridad: ¿podrías reconstruir este servidor en una máquina nueva solo con el archivo? Si la respuesta necesita una frase que empiece con "y luego reinstalaría", no es una copia de seguridad completa.

## Una copia en el mismo disco no es una copia de seguridad

Una copia de seguridad que vive en la máquina que protege cubre exactamente un fallo: has eliminado algo. No cubre la muerte del disco, la suspensión de la cuenta por parte del proveedor o un error que elimine todo el directorio.

Manténlo simple en lugar de perfecto:

- Una copia local, para el caso común, que es alguien haciendo vandalismo o una mala actualización.
- Una copia en otro lugar. Otra máquina, un almacén de objetos o un NAS doméstico que se conecte por la noche a través de SSH.
- Suficiente historial para sobrevivir a un problema que no notaste de inmediato. La corrupción a menudo se encuentra días después, y si guardas tres días de copias de seguridad, ya has sobrescrito la buena.

Siete copias diarias más cuatro semanales cubren casi todos los incidentes reales y cuestan muy poco espacio.

## Prueba una restauración antes de necesitarla

Elige una copia de seguridad, restáurala en un servidor de repuesto y conéctate. Esa es la prueba completa, lleva quince minutos y detecta todos los fallos clásicos: el archivo que falta la carpeta de mods, un mundo que necesita una versión que ya no ejecutas, permisos que hacen que los archivos no se puedan leer, una carga truncada.

Hazlo una vez cuando configures las copias de seguridad y una vez más después de cualquier cambio importante en el servidor.

## Tamaño, y cómo mantenerlo razonable

Los mundos crecen porque los jugadores exploran. Un mundo en el que alguien ha volado diez mil bloques en línea recta transporta todos los trozos a lo largo de esa línea para siempre, y la mayoría de esos trozos nunca volverán a ser visitados.

Tres palancas, en orden de cuánto devuelven:

1. **Recortar trozos no visitados.** Las herramientas que podan por la hora de la última modificación suelen eliminar una gran fracción de un mundo muy transitado sin efectos visibles en el juego.
2. **Comprimir correctamente.** Los archivos de región se comprimen bien; los archivos que los contienen no se benefician de nada exótico.
3. **No guardar cada copia horaria durante un año.** La retención supera a la compresión.

## En Minecraft Server Manager

Las copias de seguridad siguen la ruta `save-off`, `flush`, copia, `save-on`, y se rechaza una solicitud de detención o reinicio a mitad de la copia de seguridad hasta que la copia termine en lugar de competir con ella. El archivo cubre todo el directorio del servidor, por lo que los mods, la configuración y los datos del jugador viajan con el mundo.

Las copias de seguridad pueden ejecutarse en un horario junto con reinicios y comandos, y cada servidor nuevo comienza con un horario de copia de seguridad diario. Los recuentos de retención son por tipo, por lo que las diez copias programadas que se acumulan por sí solas no pueden desplazar la que hiciste a mano antes de un cambio arriesgado, y los límites de antigüedad y tamaño se aplican además. Los administradores cambian todo esto en la página de Configuración, o por servidor en su pestaña de Copias de seguridad. Restaurar primero toma una copia de seguridad nueva, por lo que una restauración a un punto incorrecto en el tiempo es en sí misma irreversible. Un mundo puede reducirse por sí solo o como parte de una copia de seguridad, que es la palanca que más importa para el tamaño.

Todo el panel, incluidas todas las copias de seguridad, vive bajo un solo directorio. Copiar ese directorio a otro lugar es la mitad de la historia fuera de la máquina, y es deliberadamente lo único que tienes que copiar.

Relacionado: [copias de seguridad en el panel](/docs/backups/), [programaciones](/docs/schedules/),
[reducir un mundo](/docs/world-shrink/), [mover un servidor a otro host](/docs/guide-moving-a-server/).
