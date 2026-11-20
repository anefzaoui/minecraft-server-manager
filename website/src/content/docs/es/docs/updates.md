---
title: 'Actualizaciones'
description: 'Realiza un seguimiento y aplica actualizaciones de versiones de Minecraft, modpacks, mods y plugins en todos los servidores, con una política por servidor.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Volver al índice de documentación](/docs/)

La página **Actualizaciones** rastrea lo que está desactualizado en toda tu flota en un solo lugar:

- Versiones de **Modpack** ([modpacks](/docs/modpacks/)) frente a Modrinth / CurseForge / el índice de lanzamientos de GTNH.
- **Contenido personalizado** que añadiste tú mismo (mods, datapacks, resource packs, plugins), cada uno frente a su origen: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) o GitHub Releases. Las búsquedas en GitHub utilizan la revalidación ETag, por lo que las comprobaciones diarias apenas afectan su límite de tasa.
- Desactualización de la **imagen de Docker**: el ID de imagen de cada contenedor de servidor frente a una etiqueta recién descargada (deduplicada entre servidores con la misma etiqueta), ofrecida como una actualización que solo requiere reconstrucción.
- **Fijaciones de versión independientes**: para un servidor sin un pack gestionado, una fijación explícita de `mc_version` frente al manifiesto de Mojang, y una variable de entorno explícita del loader-build (`PAPER_BUILD`, `FORGE_VERSION`, etc.) frente al registro del loader. Las compilaciones de Paper provienen de la **API Fill v3** actual de PaperMC (el punto final heredado v2 dejó de recibir nuevas versiones de Minecraft). En un servidor con mods, solo se ofrece una versión más reciente de Minecraft una vez que una [comprobación de versión](#minecraft-version-compatibility) ha demostrado que cada mod instalado tiene una compilación para ella. Un servidor Forge fijado se le ofrece la compilación recomendada de Forge, nunca una compilación anterior a la que está fijado, y a un servidor fijado a una versión de lanzamiento nunca se le ofrece una pre-lanzamiento (una que ya está en beta puede recibir una beta más nueva o el lanzamiento). La aplicación de una compilación de loader realiza una copia de seguridad previa a la actualización primero. Mover un servidor Forge o NeoForge a una nueva versión de Minecraft borra su número de compilación de loader fijado, ya que una compilación se hace para una versión de Minecraft; se mantiene una palabra clave como `latest`, ya que sigue a la versión por sí sola. Para elegir tú mismo una compilación específica, consulta [cambiar la versión del mod loader](#changing-the-mod-loader-version).

![Actualizaciones](/docs/images/updates.png)

## Cómo funciona

El panel comprueba las versiones fijadas de cada servidor frente a la fuente externa y lista cualquier cosa con un nuevo lanzamiento. Un recuento coincidente también aparece en la ficha "Actualizaciones disponibles" del [panel principal](/docs/dashboard/).

Las comprobaciones se ejecutan diariamente en un [horario](/docs/schedules/) predeterminado y bajo demanda con **Comprobar todo ahora**. **Ignorar** en una fila deja de ofrecer esa versión en particular; se ofrecerá una más nueva de nuevo. La **política** de actualización es por servidor: el panel deja todo manual (el predeterminado, que también mantiene el servidor fuera de esta página), solo te notifica, o aplica las actualizaciones del pack por sí mismo ([política de actualización](/docs/modpacks/#update-policy)).

## Compatibilidad de versiones de Minecraft

Una versión más reciente de Minecraft no es una actualización si tus mods no pueden acompañarte. Cada servidor tiene su propia pestaña **Versiones** (en Mods) que responde a esa pregunta:

- La versión que ejecuta el servidor ahora, y la **versión más alta para la que cada mod instalado tiene una compilación**.
- Una fila colapsable por cada versión futura de Minecraft, con cuántos mods están listos y cuántos no tienen nada publicado todavía. Abre una fila para ver qué mods se quedarían atrás y cuáles están bien.

![Compatibilidad de versiones](/docs/images/server-versions.png)

Pulsa **Comprobar versiones futuras** para ejecutarlo. Nada se escanea por sí solo: una comprobación lee cada jar en la carpeta de mods del servidor y pregunta a Modrinth y CurseForge sobre cada uno, por lo que solo ocurre cuando tú lo pides. El progreso y los resultados parciales se escriben a medida que avanza, por lo que cerrar la página o actualizar no pierde nada, y una comprobación interrumpida por un reinicio del panel lo indica y ofrece volver a ejecutarla. Todo lo que una comprobación interrumpida ya había resuelto se conserva, por lo que ejecutarla de nuevo no rehace ese trabajo.

Un informe solo describe el servidor para el que se hizo. Cambia la versión de Minecraft, el loader o los mods en sí (añade uno, elimina uno, actualiza uno) y el informe se marca como desactualizado y deja de usarse, hasta que vuelvas a ejecutar la comprobación.

Los mods se identifican a partir de la propia lista de archivos del modpack cuando la hay, y de lo contrario, por el contenido del archivo, de la misma manera que un launcher reconoce un jar. Dos tipos de mods no pueden ser respondidos y ninguno se adivina:

- **No se pudo identificar**: un jar hecho a mano o una compilación privada que ningún registro reconoce.
- **No se pudo comprobar**: un mod de GitHub Releases, Hangar o SpigotMC, o uno cuyo proyecto ha sido retirado. Estos no publican una lista de para qué versión de Minecraft es cada compilación.

Mientras cualquiera de ellos esté instalado, el panel no ofrecerá una actualización de versión de Minecraft con un solo clic, porque no puede decir honestamente qué se rompería. La aplicación de una versión superior a la que soportan los mods es rechazada, y nombra los mods que la bloquean.

Los mods que has **deshabilitado** no participan: el servidor no los carga, por lo que desactivar un mod es una forma real de superar un bloqueo. Activar o desactivar un mod marca el informe para que se vuelva a comprobar.

Esto cubre los servidores que ejecutan mods: Fabric, Forge, NeoForge y Quilt. Los servidores de plugins tipo Paper mantienen el comportamiento simple de la última versión y no tienen pestaña de Versiones, porque dos de los registros de los que provienen los plugins no publican nada que una comprobación pueda leer.

![Una versión abierta, mostrando qué mods se quedarían atrás](/docs/images/server-versions-expanded.png)

Abrir una versión lista primero los mods sin compilación para ella (los que deciden la respuesta) y mantiene los listos detrás de un clic. Los packs grandes cargan una página de mods a la vez, por lo que un servidor de 300 mods se abre tan rápido como uno de cinco mods.

## Cambiar la versión del mod loader

La pestaña **Versiones** también tiene una tarjeta **Versión del Loader**. Muestra qué compilación de Forge, NeoForge, Fabric o Quilt tiene instalada el servidor y, donde se puede cambiar, un selector para cambiar a otra.

- **Un servidor Forge, NeoForge, Fabric o Quilt** puede ejecutar cualquier compilación publicada. El selector lista las compilaciones recientes para la versión de Minecraft del servidor, con las compilaciones recomendadas y las últimas de Forge etiquetadas. **Otra Compilación…** toma cualquier compilación anterior por su número, y **Predeterminado** vuelve a dejar que el servidor elija.
- **Un modpack Forge o Fabric de CurseForge** instala la versión del loader que declara su propio manifiesto, por lo que la forma habitual de cambiarla es actualizar el pack. Cuando el propio pack lista la versión incorrecta (un mod dentro de él pide un Forge más nuevo que el que instala el pack), la tarjeta puede anularlo, y **La Versión del Modpack** elimina la anulación de nuevo. Actualizar el pack también la elimina, porque la nueva versión declara su propio loader. Si la nueva versión todavía lista la incorrecta, vuelve a establecer la anulación.
- **Un modpack NeoForge de CurseForge, o un modpack de Modrinth,** muestra su loader pero no puede ser anulado: la imagen del servidor solo aplica la anulación a los packs Forge y Fabric. Su loader sigue la versión del pack, así que actualiza el pack en su lugar. El loader de un pack FTB tampoco se puede cambiar aquí. Su tarjeta normalmente no aparece, porque el propio instalador de FTB mantiene registros que el panel no lee.

El panel comprueba que la compilación exista antes de preguntarte nada. Una compilación de Forge o NeoForge se hace para una versión de Minecraft, por lo que en un servidor que sigue la última versión, fijar una también mantiene el servidor en la versión de Minecraft que ejecuta ahora (la confirmación lo dice). Elegir **Predeterminado** después elimina la fijación pero mantiene esa versión de Minecraft. Un servidor que seguía la última versión también puede moverse a una imagen Java diferente cuando se reconstruye, la que esa versión necesita. A un servidor así que nunca ha arrancado se le pide que arranque primero, para que el panel sepa esa versión. Forge se salta los números de compilación (no hay 47.4.14 entre 47.4.13 y 47.4.15), por lo que un mod que "requiere 47.4.14 o superior" se satisface con la siguiente compilación superior, y el rechazo lo nombra. Un cambio realiza una copia de seguridad previa a la actualización y luego reconstruye el servidor. La nueva compilación se instala la próxima vez que el servidor arranque, y la tarjeta lo indica hasta entonces.

## Deshacer una actualización de mod

Cada compilación de la que se actualiza un mod permanece en la biblioteca compartida, por lo que una actualización que rompe algo es reversible. La fila del mod en la pestaña **Mods** obtiene un botón **Revertir** que restaura la compilación anterior. No hay descarga, por lo que funciona incluso si el proyecto ha sido retirado de su registro. La compilación de la que te revertiste deja de ofrecerse hasta que aparezca una más nueva.

![Revertir un mod a la compilación de la que se actualizó](/docs/images/mods-revert.png)

## Aplicar una actualización

Las actualizaciones nunca son silenciosas. Cuando eliges actualizar un pack (o [cambiarlo a otra versión](/docs/modpacks/#changing-the-pack-version), incluidas las anteriores), el panel:

1. Realiza una **copia de seguridad previa a la actualización** (para que sea reversible; por defecto se conservan las últimas 10 copias de seguridad previas a la actualización por servidor, consulta [retención](/docs/backups/#retention)).
2. Vuelve a fijar la nueva versión exacta.
3. Reconstruye el servidor, resolviendo de nuevo el runtime de Java si es necesario.
4. Monitoriza el primer arranque, con un presupuesto de tiempo por plataforma.

Si no arranca correctamente, te revierte a la copia de seguridad previa a la actualización. A un servidor que sigue versiones estables nunca se le ofrece una beta, y el enlace al registro de cambios apunta a la diferencia real por versión donde la fuente lo proporciona. Una actualización fallida también dispara una [alerta](/docs/integrations/) de Discord si la integración está configurada.
