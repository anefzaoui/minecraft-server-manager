---
title: 'Copias de seguridad'
description: 'La página de Copias de seguridad muestra cada instantánea de su flota, con tamaño, motivo y antigüedad, filtrable por servidor y por motivo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Volver al índice de documentación](/docs/)

La página **Copias de seguridad** muestra todas las instantáneas de su flota, con tamaño, motivo y antigüedad, filtrables por servidor y por motivo.

![Copias de seguridad](/docs/images/backups.png)

## Crear una copia de seguridad

Desde la pestaña **Copias de seguridad** de un servidor (o a través de un [programa](/docs/schedules/)), puede crear una instantánea de todo el directorio del servidor con un solo clic. El panel primero pone en pausa el mundo (`save-off` → `save-all`), comprime los datos y luego vuelve a habilitar el guardado (`save-on`), por lo que las copias de seguridad son consistentes incluso en un servidor en ejecución. La compresión se ejecuta en un hilo de trabajo en segundo plano para no bloquear el panel. Una copia de seguridad iniciada a través de la API puede llevar una nota.

Cada archivo se **verifica la integridad** en el momento en que se escribe: el panel reabre el archivo zip y lee su directorio. Un archivo dañado o que no se puede abrir se elimina y la solicitud de copia de seguridad falla en ese momento, en lugar de que el problema surja meses después, cuando una restauración es lo único que le separa de la pérdida de datos. Se permite un archivo con cero entradas (un servidor que nunca se ha iniciado), pero se marca en el evento.

Marque **"También reducir el mundo después"** (en la pestaña Copias de seguridad o en un programa de copias de seguridad) para eliminar los fragmentos poco visitados una vez que el archivo se haya escrito de forma segura (consulte **[Reducir un mundo](/docs/world-shrink/)**). La reducción solo se ejecuta mientras el servidor está detenido; en un servidor en ejecución, la copia de seguridad todavía se realiza y la reducción se omite.

![Copias de seguridad del servidor](/docs/images/server-backups.png)

## Motivos de las copias de seguridad

Las copias de seguridad se etiquetan según el motivo por el que se tomaron:

- **manual**: usted hizo clic en **Hacer copia de seguridad ahora**. Reemplazar el mundo activo de un servidor con uno de la biblioteca también toma primero una copia de seguridad `manual`.
- **programada**: creada por un [programa](/docs/schedules/). Cada servidor nuevo también recibe automáticamente una copia de seguridad programada diaria (escalonada entre las 02:00 y las 05:59), por lo que un servidor tiene cobertura automática desde el primer día, no solo antes de las actualizaciones.
- **pre-actualización**: tomada automáticamente antes de una actualización de paquete o un cambio de versión de Minecraft, para que una actualización sea siempre reversible.
- **pre-restauración**: tomada automáticamente justo antes de una restauración o un reinicio del mundo, como una red de seguridad en caso de que la restauración no sea lo que usted quería.

## Retención

La retención se limita **por servidor, por motivo**: se conservan las más recientes de cada grupo, las más antiguas se eliminan automáticamente después de cada copia de seguridad exitosa:

| Motivo            | Conservadas por defecto |
| ----------------- | ----------------------- |
| programada        | 10                      |
| pre-actualización | 10                      |
| manual            | 20                      |
| pre-restauración  | 5                       |

`pre-restauración` (llamadas copias de seguridad de seguridad en el panel) tiene su propio pequeño grupo precisamente para que una copia de seguridad de seguridad automática nunca pueda desalojar una copia de seguridad `manual` que usted conservó deliberadamente.

Dos límites opcionales se aplican además de los recuentos por motivo, ambos desactivados por defecto: una **antigüedad máxima** (se eliminan las copias de seguridad más antiguas de N días, independientemente de su motivo) y un **tamaño total máximo** por servidor (se eliminan las más antiguas hasta que el total encaje: primero las copias de seguridad de seguridad, luego las programadas y luego el resto). La copia de seguridad más reciente de un servidor nunca se elimina por ninguno de los dos límites.

### Cambiarlo

Los administradores establecen la política general del panel en la tarjeta **Retención de copias de seguridad** de la página **Configuración** (**Rellenar incorporados** devuelve los valores predeterminados anteriores al formulario, listos para guardar). Un servidor puede diferir en cualquiera de los seis valores: abra su pestaña **Copias de seguridad** y expanda **Retención para este servidor**. Cada campo está en blanco a menos que ese servidor lo establezca, y un campo en blanco sigue el valor general del panel (que se muestra dentro de él). Por lo tanto, un servidor puede, por ejemplo, conservar 3 copias de seguridad programadas y utilizar los valores generales del panel para todo lo demás; borrar un campo lo devuelve al valor general del panel.

![La tarjeta Retención de copias de seguridad en Configuración](/docs/images/settings-retention.png)

![Retención para este servidor en la pestaña Copias de seguridad de un servidor](/docs/images/server-retention.png)

Guardar nunca elimina nada por sí solo. Si los nuevos límites dejaran copias de seguridad existentes por encima del límite, el panel enumera, por servidor, cuántas copias de seguridad de cada tipo se eliminarían, cuánto espacio liberaría y cuál sería la antigüedad de la más antigua. También indica cuándo un servidor ya estaba por encima de sus límites antes de este cambio (por ejemplo, después de una **Desde la próxima copia de seguridad** anterior), ya que la aplicación ahora recorta todo lo que está por encima del límite, no solo lo que añade esta edición. Luego pregunta cómo aplicarlos:

- **Eliminar ahora** elimina exactamente las copias de seguridad que acaba de enumerar, nada más: una copia de seguridad realizada mientras tanto espera el próximo recorte. Desde la página de Configuración, se omite un servidor que se encuentra en medio de una restauración, copia de seguridad o acción similar y se recorta después de su próxima copia de seguridad; en la pestaña Copias de seguridad de un servidor, se le pide que lo intente de nuevo una vez que finalice esa acción. Mientras se eliminan las copias de seguridad antiguas de un servidor (generalmente segundos), otras acciones en ese servidor tienen que esperar: una copia de seguridad o inicio programado que ocurra entonces lo intenta de nuevo cada minuto hasta que pueda (hasta 30 minutos), un servidor que se bloqueó se reinicia aproximadamente 20 segundos después de que finalice (hasta 30 minutos), y un reinicio o parada programada que colisiona con él se omite hasta su próxima vez.
- **Desde la próxima copia de seguridad** las conserva por ahora; cada servidor recorta sus copias de seguridad la próxima vez que realiza una, como siempre lo ha hecho.

![El diálogo que enumera lo que eliminarían los nuevos límites](/docs/images/retention-preview.png)

Una copia de seguridad que se está restaurando nunca se elimina mientras se ejecuta la restauración: la retención la ignora (y no elimina otras copias de seguridad para hacerle sitio), y se niega su eliminación manual hasta que finalice la restauración.

La misma configuración está disponible para scripts como puntos finales de la API de administración: `GET`/`POST /api/backups/retention` y `/api/servers/:id/backups/retention`. Los valores generales del panel no pueden ser `null`. Para un servidor, un valor de `null` (o `""`) elimina esa clave única, de modo que sigue el valor general del panel nuevamente, y `{ "reset": true }` los elimina a todos. Debajo de cada una de esas dos rutas, `POST …/preview` informa lo que un cambio eliminaría sin eliminarlo (`backups`, `bytes`, `servers`, `ids` y un desglose por servidor `byServer`), y `POST …/apply` aplica la política guardada ahora y responde `{ deleted, skipped }` a nivel de panel (`skipped` cuenta los servidores ocupados) o `{ deleted }` para un servidor. Envíe el `{ "token": "..." }` de la vista previa (conservado durante 10 minutos) o su `{ "ids": [...] }` para eliminar solo esos; sin ninguno de los dos, se elimina todo lo que supera el límite. Una aplicación por servidor en un servidor ocupado responde 409.

Las copias de seguridad se pueden **renombrar** desde la lista de copias de seguridad (el botón de renombrar en cada fila). El archivo en disco y el registro del panel se mueven juntos, por lo que la descarga, la restauración y la retención siguen funcionando con el nuevo nombre.

![Renombrar una copia de seguridad](/docs/images/backup-rename.png)

> La retención está limitada automáticamente, pero los archivos grandes modificados todavía cuentan para la [cuota de disco](/docs/storage/) de un servidor, así que preste atención al total de los paquetes grandes.

## Restauración

Restaurar una copia de seguridad detiene el servidor (verificando que el contenedor realmente se detuvo antes de tocar ningún archivo), toma una copia de seguridad de seguridad `pre-restauración`, reemplaza **todo el directorio del servidor** con la instantánea y lo deja detenido para que lo inicie de nuevo. El archivo se desempaqueta a un lado primero y solo se intercambia una vez que se ha extraído por completo, por lo que una restauración que falla a mitad de camino deja los archivos actuales intactos. Debido a que las actualizaciones de paquetes siempre toman primero una copia de seguridad `pre-actualización`, siempre puede revertir una actualización fallida.

## La propia base de datos del panel

Las copias de seguridad del servidor solo cubren la carpeta de cada servidor. La propia base de datos del panel (`panel.db`, que contiene usuarios, roles, secretos de 2FA, programas, pines de paquetes e historial) se copia en instantáneas por separado en el temporizador de mantenimiento diario:

- `VACUUM INTO` escribe una copia consistente y desfragmentada en `backups/_panel/` en la carpeta de datos; se conservan las **14** más recientes.
- Al arrancar, el panel ejecuta `PRAGMA integrity_check` y registra ruidosamente si falla, indicándole `backups/_panel` para la copia buena más reciente.

Haga una copia de seguridad de toda la carpeta de datos (que también contiene `.secret-key`, la clave de cifrado en reposo) y habrá hecho una copia de seguridad de todo.
