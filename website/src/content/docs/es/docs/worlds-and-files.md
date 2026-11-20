---
title: 'Mundos y archivos'
description: 'La biblioteca de mundos, cargas e intercambios de mundos, la pestaña de mods y plugins, y el gestor de archivos en el navegador.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Volver al índice de documentos](/docs/)

## Mundos

La página **Mundos** es la biblioteca de mundos: todos los mundos guardados en un solo lugar. **Subir mundo** toma un archivo `.zip` o `.tar` y encuentra el mundo dentro automáticamente, **Guardar en la biblioteca** toma una instantánea del mundo activo de un servidor (funciona mientras el servidor está en ejecución), y cada mundo de la biblioteca se puede descargar o instalar en cualquier servidor con **Instalar en...**. La instalación reemplaza el mundo del servidor (el servidor debe estar detenido y su mundo actual se respalda primero) o lo agrega junto, para activarlo más tarde. Se ejecuta una verificación de compatibilidad antes de cada instalación.

La pestaña **Mundo → Mundos** de un servidor enumera los mundos en ese servidor. Desde allí puedes activar otro mundo (con el servidor detenido), descargar, duplicar, renombrar o [reducir](/docs/world-shrink/) un mundo, copiarlo a otro servidor, eliminar uno inactivo y restablecer el mundo activo con una semilla nueva, conservada o personalizada (primero se ofrece una copia de seguridad de seguridad). La misma biblioteca se encuentra debajo, con **Instalar aquí**.

![Mundos](/docs/images/worlds.png)

## El gestor de archivos

En la sección **Mundo** de un servidor, la pestaña **Archivos** es un gestor de archivos completo en el navegador para el directorio de datos de ese servidor. Lista, lee, edita, renombra, mueve, copia, elimina y sube archivos, crea carpetas y busca el texto de archivos dentro de una carpeta con **Buscar en archivos**: todo lo que normalmente harías por SSH, desde el navegador.

![Gestor de archivos](/docs/images/server-files.png)

Los archivos de texto se abren en un editor con un límite de 8 MB; los archivos más grandes se pueden descargar. Las subidas aceptan hasta 20 archivos a la vez.

### Permanecer dentro del sandbox

Cada operación de archivo está confinada al propio directorio de datos del servidor. El panel resuelve cada ruta y rechaza cualquier cosa que pudiera escapar: la navegación `..`, las rutas absolutas e incluso los enlaces simbólicos que apuntan fuera del directorio (incluidos los colgantes que aún no existen). Un mod o plugin no puede plantar un enlace para engañar al gestor de archivos para que lea o escriba en otro lugar del host.

## Mods

Para servidores con mods y plugins, la pestaña **Mods** (su propio grupo en la barra lateral del servidor) gestiona el conjunto de mods: busca y añade mods, y ve lo que está instalado. Desde la fila de cada mod instalado puedes actualizarlo (o ignorar esa actualización), [revertirlo](/docs/updates/#undoing-a-mod-update), deshabilitarlo o eliminarlo, y **Actualizar todo** aplica todas las actualizaciones disponibles con un solo reinicio. Las actualizaciones de mods y packs también aparecen en la página [Actualizaciones](/docs/updates/).

### Añadir mods

![Mods](/docs/images/mods.png)

Cuatro formas de hacerlo, todas desde la barra de herramientas de la pestaña Mods:

- **Buscar mods**: busca en **Modrinth o CurseForge** (el chip de CurseForge aparece una vez que se almacena una clave API en **Ajustes → Claves API**), y en servidores de plugins también en **Hangar** (el propio registro de plugins de PaperMC) y **SpigotMC** (a través del proxy CDN de Spiget), ambos sin clave. Una pestaña **Datapacks** busca datapacks de Modrinth. Todo se filtra por el cargador y la versión de Minecraft del servidor (una casilla de verificación también muestra compilaciones no listadas como compatibles, bajo tu propio riesgo); los servidores Quilt ven automáticamente también las compilaciones etiquetadas como Fabric, ya que Quilt ejecuta mods de Fabric. Los resultados que ya están en el servidor muestran una insignia de **Instalado**. Si un autor de CurseForge no permite descargas automatizadas (o un recurso de SpigotMC está alojado fuera del sitio), el panel lo indica de antemano y ofrece una ruta **Abrir CurseForge** (o **Abrir SpigotMC**) + **Subir Jar** en lugar de fallar a mitad de la instalación.

  ![Búsqueda en Hangar](/docs/images/mods-search-hangar.png)

- **Importar Zip**: un botón, tres formas, auto-detectadas:
  - Un **modpack de Modrinth (`.mrpack`)**: cada archivo anclado se canoniza de nuevo en su proyecto de Modrinth a través de la búsqueda de hash (así los mods importados conservan nombres reales, iconos y se pueden actualizar; los archivos que Modrinth no conoce se instalan desde la propia URL del pack), se verifica contra las sumas de comprobación sha512 del pack durante la descarga y se previsualiza con veredictos de ajuste. Los archivos solo para cliente se omiten visiblemente, y se pueden aplicar ambos árboles de sobrescritura (`overrides/`, luego `server-overrides/`; la copia específica del servidor gana).

    ![Importación de mrpack](/docs/images/mrpack-import.png)

  - Una **exportación de modpack de CurseForge** (el zip que produce la aplicación de CurseForge, con `manifest.json`): cada mod anclado se resuelve en masa, se previsualiza con advertencias (cargador/MC incorrecto para este servidor, archivos que ya no están en CurseForge, mods que necesitan una descarga manual) y se instala con progreso real. Los `overrides/` del pack (configuraciones, scripts) también se pueden aplicar opcionalmente; cualquier archivo que se sobrescribiría se respalda primero en `.import-backups/<timestamp>/` dentro de la carpeta del servidor.
  - Un **zip simple de jars** que recopilaste tú mismo: cada jar se identifica (coincidencia de hash de Modrinth → huella digital de CurseForge → los propios metadatos del jar) y se juzga contra el servidor (_encaja / cargador incorrecto / versión de MC incorrecta / ya instalado / no identificado_), para que elijas lo que realmente pertenece antes de que se instale algo.
- **Añadir por URL**: pega casi cualquier cosa: páginas de proyectos de Modrinth, CurseForge, Hangar o SpigotMC, una URL de repositorio o lanzamiento de GitHub (un simple `propietario/repositorio` también funciona; las instalaciones de GitHub prefieren el lanzamiento estable más reciente y omiten los jars secundarios `-sources`/`-javadoc`), un slug de Modrinth simple o cualquier URL directa de `.jar`. El panel resuelve la compilación correcta para el cargador y la versión de MC del servidor.

  ![Añadir por enlace](/docs/images/mods-add-by-link.png)

- **Subir Jar** (desde el respaldo de búsqueda o el resolvedor de descargas pendientes): los jars subidos se identifican de la misma manera, por lo que conservan su nombre real, versión, icono y se pueden actualizar.

Cada instalación de registro se **verifica con suma de comprobación mientras se descarga**: el flujo se verifica contra el digest más fuerte que publica el registro (sha512 → sha256 → sha1 → md5) y una discrepancia aborta antes de que algo llegue al servidor.

Un zip completo (incluido `.mrpack`) también puede **crear un servidor**: en la pestaña **Desde Modpack** del asistente, súbelo y el manifiesto del pack (o una mayoría de votos entre los jars identificados) rellena el cargador, la versión de Minecraft y la compilación del cargador.
