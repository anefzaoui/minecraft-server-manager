---
title: 'Creación y gestión de servidores'
description: 'Haz clic en Crear un servidor (barra superior) o en la tarjeta Crear un servidor para abrir el asistente.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Volver al índice de documentación](/docs/)

## Creación de un servidor

Haz clic en **Crear un servidor** (barra superior) o en la tarjeta **Crear un servidor** para abrir el asistente.

![Crear un servidor](/docs/images/create-wizard.png)

El asistente rellena previamente los campos de memoria, CPU y cuota de disco de **Valores predeterminados para servidores nuevos** en la página de Configuración, que un administrador puede cambiar en cualquier momento.

![Valores predeterminados para servidores nuevos](/docs/images/settings-defaults.png)

Tú eliges:

- Un **nombre** (y un icono opcional, color de acento y etiquetas para organizar tu flota).
- Un **tipo de servidor**: vanilla, Paper, Fabric, Forge, NeoForge y más, cada uno mapeado a la imagen `itzg` correcta en segundo plano.
- Una **versión de Minecraft**: `LATEST`, una snapshot o una versión específica.
- **Recursos**: RAM (heap), límite de memoria del contenedor, CPU y una cuota de disco.

¿Prefieres un modpack? La pestaña **Desde modpack** instala un pack de CurseForge, Modrinth, FTB o GT New Horizons en su lugar (ver [Modpacks](/docs/modpacks/)), o toma un **zip personalizado que subas**: una exportación de modpack de CurseForge (`manifest.json`) o cualquier zip de archivos mod. El manifiesto (o una mayoría simple entre los archivos identificados) rellena el cargador y la versión de Minecraft, y cada mod se instala en una sola tarea. También puedes empezar desde un [Blueprint](/docs/blueprints/) guardado.

El panel elige automáticamente un tiempo de ejecución de Java sensato para tu versión, descarga la imagen, crea el contenedor y (opcionalmente) lo inicia, todo desde un solo formulario.

## La lista de servidores

La página **Servidores** lista toda tu flota con el estado y estadísticas rápidas.

![Lista de servidores](/docs/images/servers-list.png)

## Un servidor individual

![Jugadores](/docs/images/players.png)

Abrir un servidor te da un espacio de trabajo con pestañas:

- **Visión general**: estado, estadísticas en vivo, tiempo de actividad y los controles principales de inicio/parada/reinicio.
- **Consola**: el flujo de registro en vivo y la entrada de comandos, además del chat del juego ([detalles](/docs/console-and-chat/)).
- **Jugadores**: quién está en línea, además del inventario, estadísticas y [comandos de chat](/docs/console-and-chat/).
- **Mods**: la lista de mods instalados, el [explorador de mods](/docs/modpacks/) y las actualizaciones de contenido.
- **Mundo**: [mundos, el mapa en vivo y el gestor de archivos](/docs/worlds-and-files/).
- **Copias de seguridad**: [snapshots y restauración](/docs/backups/) para este servidor.
- **Monitorización**: historial por servidor y métricas en vivo, incluidos informes de fallos (ver más abajo).
- **Configuración**: todo sobre cómo se ejecuta el servidor, además de las [integraciones](/docs/integrations/) (Discord, página de estado, invitaciones, chatbot).

![Visión general del servidor](/docs/images/server-overview.png)

La barra **Controles del mundo** se desplaza en cada pestaña: el reloj del juego, el clima, las gamerules comunes como chips de alternancia y "Mostrar todas las reglas del mundo" para el resto.

![Controles del mundo](/docs/images/world-controls.png)

**Monitorización → En vivo** muestra TPS y milisegundos por tick, una tarjeta de salud y estabilidad con las últimas 24 horas / 7 días de fallos y reinicios, y tamaños por mundo.

![Monitorización en vivo](/docs/images/monitoring-live.png)

## Configuración del servidor

La pestaña **Configuración** es la superficie de configuración completa: renombrar, recursos, política de actualización, inicio/reinicio automático, variables de entorno y anulaciones avanzadas de Docker. Los campos que cambian cómo se ejecuta el contenedor están claramente marcados como que requieren un reinicio.

![Configuración del servidor](/docs/images/server-settings.png)

**Sobre el medidor de memoria.** "RAM (heap de Java)" se entrega a Java como su heap inicial y máximo, y Java rellena un heap que se le dio por adelantado en el primer minuto, con o sin los presets de flags de Aikar / MeowIce. Por lo tanto, el medidor de memoria se estabiliza alrededor del tamaño del heap y permanece allí incluso cuando nadie está jugando; la marca en el medidor indica dónde se sitúa el heap bajo el límite del contenedor, y la nota debajo dice eso. Si prefieres ver la memoria seguir el uso real, establece un **Heap inicial** más pequeño (avanzado): en un heap de 2 GB eso redujo el uso en reposo de 2.6 GB a aproximadamente 1.3 GB en nuestras mediciones. Java también necesita memoria fuera del heap (aproximadamente 0.5 GB en vanilla, 1.5 a 2 GB en un modpack grande), que es para lo que sirve el margen del límite del contenedor. Consulta "Dos límites de memoria" en el README para ver los números.

> Los campos de anulación avanzada de Docker (nombre de contenedor personalizado, puertos y montajes de enlace adicionales, y anulaciones brutas) son **solo para administradores**, porque un montaje de enlace más el acceso de Docker del panel es efectivamente root en el host. Ver [Usuarios y roles](/docs/users-and-roles/).

## Informes de fallos y análisis de mclo.gs

Los informes de fallos (`crash-reports/*.txt` y archivos `hs_err_pid*.log` de JVM) se recogen automáticamente, se analizan en un resumen de una línea con la excepción y los mods sospechosos, y se listan en **Monitorización → Historial**:

![Tarjeta de informe de fallos](/docs/images/crash-mclogs-card.png)

Cada tarjeta de informe ofrece un visor integrado (con secciones colapsables y excepciones resaltadas), copiar-stack-trace y descarga, además de dos acciones de [mclo.gs](https://mclo.gs):

- **Compartir en mclo.gs** publica el informe como un paste público y copia el enlace, exactamente lo que piden los autores de mods y los Discords de soporte. El enlace se recuerda en el informe, por lo que nada se sube dos veces.
- **Analizar** ejecuta las estadísticas automatizadas de mclo.gs sobre el paste: problemas conocidos con soluciones sugeridas (dependencias faltantes, incompatibilidades de versión, conflictos de mods comunes), mostradas directamente en el panel.

![Estadísticas de mclo.gs](/docs/images/crash-insights.png)

Ambas acciones están detrás de una confirmación explícita, porque un paste es público: los informes de fallos pueden incluir nombres de jugadores y tu lista completa de mods. El panel nunca sube nada por sí solo.
