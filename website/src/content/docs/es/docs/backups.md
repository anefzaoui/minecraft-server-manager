---
title: 'Copias de seguridad'
description: 'La página de Copias de seguridad muestra todas las instantáneas de tu flota, con tamaño, motivo y antigüedad.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Volver al índice de documentación](/docs/)

La página **Copias de seguridad** muestra todas las instantáneas de tu flota, con su tamaño, motivo y antigüedad.

![Copias de seguridad](/docs/images/backups.png)

## Crear una copia de seguridad

Desde la pestaña **Copias de seguridad** de un servidor (o a través de un [horario](/docs/schedules/)), puedes crear una instantánea de todo el directorio del servidor con un solo clic. El panel primero pone el mundo en estado de espera (`save-off` → `save-all`), comprime los datos y luego vuelve a habilitar el guardado (`save-on`), por lo que las copias de seguridad son consistentes incluso en un servidor en ejecución. La compresión se ejecuta en un hilo de trabajo en segundo plano para no bloquear el panel. Cada copia de seguridad puede llevar una nota.

Cada archivo está **verificado en cuanto a integridad** en el momento en que se escribe: el panel reabre el archivo zip y lee su directorio. Un archivo dañado o que no se puede abrir se elimina y la llamada de copia de seguridad falla en ese momento, en lugar de que el problema surja meses después, cuando una restauración es lo único que te separa de la pérdida de datos. Se permite un archivo sin entradas (un servidor que nunca se ha iniciado), pero se marca en el evento.

Marca **"También reducir el mundo después"** (en la pestaña Copias de seguridad, o en un horario de copias de seguridad) para eliminar los fragmentos raramente visitados una vez que el archivo se ha escrito de forma segura (consulta **[Reducir un mundo](/docs/world-shrink/)**). La reducción solo se ejecuta mientras el servidor está detenido; en un servidor en ejecución, la copia de seguridad todavía se realiza y la reducción se omite.

![Copias de seguridad del servidor](/docs/images/server-backups.png)

## Motivos de las copias de seguridad

Las copias de seguridad se etiquetan según el motivo por el que se tomaron:

- **manual** - hiciste clic en el botón.
- **programada** - creada por un [horario](/docs/schedules/). Cada servidor nuevo también recibe automáticamente una copia de seguridad programada diaria (escalonada entre las 02:00 y las 05:59), por lo que un servidor tiene cobertura automática desde el primer día, no solo antes de las actualizaciones.
- **pre-actualización** - tomada automáticamente antes de una actualización de paquete, para que una actualización sea siempre reversible.
- **pre-restauración** - tomada automáticamente justo antes de una restauración o un reinicio del mundo, como una red de seguridad en caso de que la restauración no sea lo que querías.

## Retención

La retención está limitada **por servidor, por motivo**: se conservan las más recientes de cada grupo, las más antiguas se eliminan automáticamente después de cada copia de seguridad exitosa:

| Motivo            | Conservadas |
| ----------------- | ----------- |
| programada        | 10          |
| pre-actualización | 10          |
| manual            | 20          |
| pre-restauración  | 5           |

`pre-restauración` tiene su propio pequeño espacio precisamente para que una copia de seguridad automática de seguridad nunca pueda eliminar una copia de seguridad `manual` que conservaste deliberadamente.

Se aplican dos límites opcionales además de los recuentos por motivo, ambos desactivados por defecto: una **edad máxima** (se eliminan las copias de seguridad más antiguas que N días, independientemente de su motivo) y un **tamaño total máximo** por servidor (se eliminan las copias de seguridad más antiguas hasta que el total encaje, empezando por las de `pre-restauración`). La copia de seguridad más reciente de un servidor nunca se elimina por ninguno de los dos límites. Todos estos se pueden cambiar globalmente en la página de Configuración, y anularse por servidor en su pestaña Copias de seguridad.

Las copias de seguridad se pueden **renombrar** desde la lista de copias de seguridad (el botón de renombrar en cada fila). El archivo en disco y el registro del panel se mueven juntos, por lo que la descarga, la restauración y la retención siguen funcionando con el nuevo nombre.

![Renombrar una copia de seguridad](/docs/images/backup-rename.png)

> La retención está limitada automáticamente, pero los archivos grandes con mods todavía cuentan para la [cuota de disco](/docs/storage/) de un servidor, así que vigila el total para paquetes grandes.

## Restauración

Restaurar una copia de seguridad detiene el servidor (verificando que el contenedor realmente se detuvo antes de tocar ningún archivo), toma una copia de seguridad de seguridad `pre-restauración`, reemplaza **todo el directorio del servidor** con la instantánea y lo deja detenido para que lo inicies de nuevo. Dado que las actualizaciones de paquetes siempre toman una copia de seguridad `pre-actualización` primero, siempre puedes revertir una actualización fallida.

## La propia base de datos del panel

Las copias de seguridad del servidor solo cubren los directorios del mundo por servidor. La propia base de datos del panel (`panel.db`, que contiene usuarios, roles, secretos de 2FA, horarios, pines de paquetes e historial) se guarda como instantánea por separado en el temporizador de mantenimiento diario:

- `VACUUM INTO` escribe una copia consistente y desfragmentada en `data/backups/_panel/`; se conservan las **14** más recientes.
- Al arrancar, el panel ejecuta `PRAGMA integrity_check` y registra ruidosamente si falla, indicándote `data/backups/_panel` para obtener la copia buena más reciente.

Haz una copia de seguridad de todo el árbol `data/` (también contiene `.secret-key`, la clave de cifrado en reposo) y habrás hecho una copia de seguridad de todo.
