---
title: 'Mundos y archivos'
description: 'La página de Mundos administra los datos del mundo en tus servidores: cambia el mundo activo, sube un mundo o descárgalo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Volver al índice de documentación](/docs/)

## Mundos

La página **Mundos** administra los datos del mundo en tus servidores: cambia el mundo activo, sube o descarga uno.

![Mundos](/docs/images/worlds.png)

## El gestor de archivos

Debajo de la sección **Mundo** de un servidor, la pestaña **Archivos** es un gestor de archivos completo en el navegador para el directorio de datos de ese servidor. Lista, lee, edita, crea, renombra, mueve, copia, elimina y sube archivos: todo lo que normalmente harías por SSH, desde el navegador.

![Gestor de archivos](/docs/images/server-files.png)

Los archivos de texto se abren en un editor con un límite de 2 MB; los archivos más grandes se pueden descargar. Las subidas aceptan varios archivos a la vez.

### Manteniéndose dentro de la caja de arena

Cada operación de archivo está confinada al propio directorio de datos del servidor. El panel resuelve cada ruta y rechaza cualquier cosa que intente escapar: recorrido `..`, rutas absolutas e incluso enlaces simbólicos que apunten fuera del directorio (incluidos los colgantes que aún no existen). Un mod o plugin no puede colocar un enlace para engañar al gestor de archivos y que lea o escriba en otro lugar del host.

## Mods

Para servidores con mods, la pestaña **Mods** (su propio grupo en la barra lateral del servidor) administra el conjunto de mods: busca y añade mods, y ve qué está instalado. Las actualizaciones de mods y paquetes aparecen en la página [Actualizaciones](/docs/updates/).

### Añadiendo mods

![Mods](/docs/images/mods.png)

Cuatro formas de entrar, todas desde la barra de herramientas de la pestaña Mods:

- **Buscar mods** - busca en **Modrinth o CurseForge** (el chip de CurseForge aparece una vez que se almacena una clave API en Ajustes → Claves API), y en servidores de plugins también **Hangar** (el propio registro de plugins de PaperMC) y **SpigotMC** (a través del proxy CDN de Spiget) - ambos sin clave. Todo se filtra según el cargador y la versión de Minecraft del servidor; los servidores Quilt ven automáticamente las compilaciones etiquetadas como fabric, ya que Quilt ejecuta mods de Fabric. Los resultados que ya están en el servidor muestran una insignia de **Instalado**. Si un autor de CurseForge prohíbe las descargas automáticas, o un recurso de SpigotMC está alojado externamente, el panel lo indica claramente y ofrece una ruta de **Abrir página** + **Subir jar** en lugar de fallar a mitad de la instalación.

  ![Búsqueda en Hangar](/docs/images/mods-search-hangar.png)

- **Importar zip** - un botón, tres formas, detección automática:
  - Un **modpack de Modrinth (`.mrpack`)**: cada archivo fijado se canoniza de nuevo en su proyecto de Modrinth mediante la búsqueda de hash (para que los mods importados conserven nombres reales, iconos y sigan siendo comprobables para actualizaciones; los archivos que Modrinth no conoce se instalan desde la URL propia del pack), se verifica contra las sumas de verificación sha512 del pack al descargar, y se previsualiza con veredictos de ajuste. Los archivos solo para cliente se omiten visiblemente, y ambos árboles de anulación (`overrides/`, luego `server-overrides/` - la copia específica del servidor gana) se pueden aplicar.

    ![Importación de mrpack](/docs/images/mrpack-import.png)

  - Una **exportación de modpack de CurseForge** (el zip que produce la aplicación de CurseForge, con `manifest.json`): cada mod fijado se resuelve en bloque, se previsualiza con advertencias (cargador/MC incorrecto para este servidor, archivos que ya no están en CurseForge, mods que necesitan una descarga manual), y se instala con progreso real. Los `overrides/` del pack (configuraciones, scripts) también se pueden aplicar opcionalmente; cualquier archivo que se vaya a sobrescribir se respalda primero en `.import-backups/<timestamp>/` dentro de la carpeta del servidor.
  - Un **zip plano de jars** que recopilaste tú mismo: cada jar se identifica (coincidencia de hash de Modrinth → huella digital de CurseForge → metadatos del propio jar) y se juzga contra el servidor - _encaja / cargador incorrecto / versión de MC incorrecta / ya instalado / no identificado_ - para que elijas lo que realmente pertenece antes de que se instale nada.
- **Añadir por enlace** - pega casi cualquier cosa: páginas de proyectos de Modrinth, CurseForge, Hangar o SpigotMC, una URL de repositorio o lanzamiento de GitHub (un simple `owner/repo` también funciona - las instalaciones de GitHub prefieren la versión estable más reciente y omiten los jars `sources`/`javadoc` complementarios), un slug simple de Modrinth, o cualquier URL directa de `.jar`. El panel resuelve la compilación correcta para el cargador y la versión de MC del servidor.

  ![Añadir por enlace](/docs/images/mods-add-by-link.png)

- **Subir jar** (desde la opción de reserva de búsqueda o el resolvedor de descargas pendientes) - los jars subidos se identifican de la misma manera, por lo que conservan su nombre real, versión, icono y se vuelven comprobables para actualizaciones.

Cada instalación de registro se **verifica mediante checksum mientras se descarga**: el flujo se comprueba contra el resumen más potente que publica el registro (sha512 → sha256 → sha1 → md5) y una discrepancia aborta antes de que nada aterrice en el servidor.

Un zip completo (`.mrpack` incluido) también puede **crear un servidor**: en la pestaña _Desde modpack_ del asistente, súbelo y el manifiesto del pack (o una mayoría simple entre los jars identificados) rellenará el cargador, la versión de Minecraft y la compilación del cargador.
