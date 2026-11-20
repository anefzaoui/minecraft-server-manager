---
title: 'Creación y gestión de servidores'
description: 'Crea, inicia, detén, reconstruye y configura servidores de Minecraft en el panel: el asistente de creación, la configuración, la memoria y el puerto del juego.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Volver al índice de documentación](/docs/)

## Creación de un servidor

Haz clic en **Crear un servidor** (barra superior) o en la tarjeta **Crear un servidor** para abrir el asistente.

![Crear un servidor](/docs/images/create-wizard.png)

El asistente rellena previamente la memoria Java y la cuota de disco de **Valores predeterminados para servidores nuevos** en la página de Configuración, que un administrador puede cambiar en cualquier momento. Un servidor nuevo toma su límite de CPU de ahí también.

![Valores predeterminados para servidores nuevos](/docs/images/settings-defaults.png)

Tú eliges:

- Un **nombre** (y una descripción, icono y color de acento opcionales). Las etiquetas para organizar tu flota se añaden más tarde, en la configuración del servidor.
- Un **tipo de servidor**: Vanilla, Paper o Purpur en la pestaña **Vanilla**. Para un servidor modificado, la pestaña **Desde mods** elige el cargador (Fabric, Forge, NeoForge o Quilt), la versión de Minecraft y una compilación del cargador (la última o una específica), y luego te permite buscar mods.
- Una **versión de Minecraft**: `LATEST`, una snapshot o una versión específica (incluyendo betas y alphas).
- Un **puerto de juego**: se sugiere uno libre. La consola remota (RCON) utiliza el puerto 1000 superior (por defecto). Puedes cambiarlo más tarde (ver [Cambiar el puerto de juego](#changing-the-game-port)).
- **Recursos**: la memoria Java (el límite de memoria del contenedor se establece un 50% por encima) y una cuota de disco.

**Opciones avanzadas** abre todas las demás configuraciones que admite la imagen del servidor, además de variables de entorno adicionales y (para administradores) la configuración avanzada de Docker.

¿Prefieres un modpack? La pestaña **Desde modpack** instala un pack de CurseForge, Modrinth o GT New Horizons en su lugar (ver [Modpacks](/docs/modpacks/)), o toma un **zip personalizado que subes**: un `.mrpack` de Modrinth, una exportación de modpack de CurseForge (`manifest.json`), o cualquier zip de archivos jar de mods. El manifiesto (o una votación mayoritaria entre los archivos jar identificados) rellena el cargador y la versión de Minecraft, y cada mod se instala en una tarea. También puedes empezar desde un [Blueprint](/docs/blueprints/) guardado en la pestaña **Desde Blueprint**.

El panel elige automáticamente un tiempo de ejecución de Java sensato para tu versión, descarga la imagen, crea el contenedor y lo inicia, todo desde el mismo formulario.

## La lista de servidores

La página **Servidores** lista toda tu flota con el estado y estadísticas rápidas.

![Lista de servidores](/docs/images/servers-list.png)

## Un solo servidor

![Jugadores](/docs/images/players.png)

Abrir un servidor te da un espacio de trabajo con pestañas:

- **Visión general**: la dirección para compartir con los jugadores, la descripción, el uso en vivo y quién está conectado.
- **Consola**: el flujo de registro en vivo y la entrada de comandos, el chat del juego y los [comandos de chat](/docs/console-and-chat/).
- **Jugadores**: la lista de jugadores, además del inventario y las estadísticas.
- **Mods**: la lista de mods instalados, el [explorador de mods](/docs/modpacks/) y las actualizaciones de contenido. En un servidor modificado, su subpestaña **Versiones** comprueba para qué versiones futuras de Minecraft tienen compilaciones tus mods ([actualizaciones](/docs/updates/#minecraft-version-compatibility)).
- **Mundo**: [mundos, el mapa en vivo y el gestor de archivos](/docs/worlds-and-files/).
- **Copias de seguridad**: [instantáneas y restauración](/docs/backups/) para este servidor.
- **Monitorización**: historial por servidor y métricas en vivo, incluyendo informes de fallos (ver más abajo).
- **Configuración**: **Configuración** (todo sobre cómo se ejecuta el servidor), además de las [integraciones](/docs/integrations/) (Discord, Página de estado, Invitaciones y, para administradores, Chatbot).

Los controles de inicio, parada y reinicio se encuentran en la cabecera encima de cada pestaña. Lo que puedes hacer en cada pestaña depende de tus [permisos en ese servidor](/docs/users-and-roles/#per-server-permissions): por ejemplo, la subpestaña **Archivos** necesita el permiso Archivos, y el envío de comandos de consola necesita Consola.

![Visión general del servidor](/docs/images/server-overview.png)

La barra **Controles del mundo** se mantiene en cada pestaña: el reloj del juego, el clima, las reglas de juego comunes como chips de alternancia, y "Mostrar todas las reglas del mundo" para el resto.

![Controles del mundo](/docs/images/world-controls.png)

**Monitorización → En vivo** muestra TPS y milisegundos por tick, una tarjeta de salud y estabilidad con fallos (últimas 24 h y 7 d), reinicios forzados por falta de memoria y reinicios automáticos, y tamaños por mundo.

![Monitorización en vivo](/docs/images/monitoring-live.png)

## Configuración del servidor

**Configuración → Configuración** es la superficie de configuración completa: nombre, descripción, MOTD, icono, color y etiquetas, recursos, puerto de juego, política de actualización, inicio al arrancar el panel y reinicio automático en caso de fallo, todas las variables de entorno que admite la imagen del servidor, la configuración avanzada de Docker, y exportación, clonación, reconstrucción y eliminación de blueprints. Los cambios que solo surten efecto una vez que el servidor se reconstruye se guardan de inmediato y esperan: aparece un botón **Aplicar cambios** en la cabecera del servidor, y también se aplican la próxima vez que el servidor se inicie.

**Reinicio automático en caso de fallo** reinicia un servidor que ha fallado, esperando más tiempo entre cada intento (5, 10 y luego 20 segundos) y deteniéndose después de 3 intentos en 10 minutos. Omite los fallos que el panel reconoce como un problema de configuración (el EULA, la versión incorrecta de Java, un mundo de una versión más reciente, un puerto en uso, falta de memoria, una clave de CurseForge faltante), porque esos necesitan una solución primero. Si otra acción está ocupada con el servidor (una copia de seguridad, una restauración, un cambio de puerto), espera hasta 30 minutos y se rinde tan pronto como alguien detiene o inicia el servidor ellos mismos.

Los cambios directos de configuración siempre se mantienen en los reinicios. Un cambio de PvP o dificultad realizado con la barra **Controles del mundo**, un cambio de lista blanca en la pestaña **Jugadores**, o una edición de `server.properties` en el editor de **Archivos** elimina la variable de entorno correspondiente (si se estableció) y marca el servidor para ser reconstruido, de modo que el valor en disco prevalezca en lugar de ser reafirmado por la imagen del contenedor en el próximo inicio.

![Configuración del servidor](/docs/images/server-settings.png)

**Sobre el medidor de memoria.** "RAM (memoria Java)" se entrega a Java tanto como su montón inicial como máximo, y Java rellena un montón que se le dio por adelantado dentro del primer minuto, con o sin los ajustes preestablecidos de Aikar / MeowIce. Por lo tanto, el medidor de memoria se estabiliza alrededor del tamaño del montón y permanece allí incluso cuando nadie está jugando; la marca en el medidor indica dónde se encuentra el montón bajo el límite del contenedor, y la nota debajo lo dice. Si prefieres que la memoria siga el uso real, dale al servidor un montón inicial más pequeño con **Montón inicial** en la tarjeta Recursos en **Configuración → Configuración** (o bajo **Opciones avanzadas** en el asistente), por ejemplo, 512 MB: en un montón de 2 GB, eso redujo el uso inactivo de 2.6 GB a aproximadamente 1.3 GB en nuestras mediciones. Java también necesita memoria fuera del montón (aproximadamente 0.5 GB en vanilla, 1.5 a 2 GB en un modpack grande), que es para lo que sirve el margen del límite del contenedor. Consulta "Dos límites de memoria" en el README para ver las cifras.

> La **Configuración avanzada de Docker** (nombre del contenedor, red Docker, mapeos de puertos adicionales y enlaces de volúmenes adicionales) es **solo para administradores**, ya que un montaje de enlace más el acceso de Docker del panel es efectivamente root en el host. Ver [Usuarios y roles](/docs/users-and-roles/).

### Cambiar el puerto de juego

La tarjeta **Puerto de juego** en **Configuración → Configuración** mueve un servidor a otro puerto en cualquier momento, con su propio botón **Guardar puerto**. **Usar siguiente puerto libre** elige el más bajo libre, y la tarjeta comprueba cualquier puerto que introduzcas antes de guardarlo. RCON siempre sigue 1000 por encima del puerto de juego (el desplazamiento por defecto). Los administradores pueden elegir cualquier puerto desde 1024 hacia arriba; todos los demás eligen desde el primer puerto de juego (25565 por defecto) hacia arriba. Guardar aplica el cambio de inmediato: un servidor detenido simplemente se mueve, y uno en ejecución pregunta primero, luego se reinicia en el nuevo puerto (el mundo se guarda primero, y los jugadores se reconectan en el nuevo puerto). Si el servidor no puede iniciarse en el nuevo puerto, vuelve al anterior. El cambio se rechaza mientras otros cambios esperan **Aplicar cambios**, así que aplica esos primero. Cambiar el puerto requiere el permiso de Configuración en ese servidor.

![La tarjeta Puerto de juego](/docs/images/server-port.png)

![El aviso antes de que un servidor en ejecución se reinicie en su nuevo puerto](/docs/images/port-restart.png)

## Informes de fallos y análisis de mclo.gs

Los informes de fallos (`crash-reports/*.txt` y archivos JVM `hs_err_pid*.log`) se recogen automáticamente, se analizan en un resumen de una línea con la excepción y los mods sospechosos, y se listan en **Monitorización → Historial**:

![Tarjeta de informe de fallos](/docs/images/crash-mclogs-card.png)

Cada tarjeta de informe ofrece un visor integrado (con secciones colapsables y excepciones resaltadas), copiar-stack-trace y descarga, además de dos acciones de [mclo.gs](https://mclo.gs):

- **Compartir en mclo.gs** publica el informe como un paste público y copia el enlace: exactamente lo que piden los autores de mods y los Discords de soporte. El enlace se recuerda en el informe, por lo que nada se sube dos veces.
- **Analizar** ejecuta las estadísticas automatizadas de mclo.gs sobre el paste: problemas conocidos con soluciones sugeridas (dependencias faltantes, incompatibilidades de versión, conflictos comunes de mods), mostradas directamente en el panel.

![Estadísticas de mclo.gs](/docs/images/crash-insights.png)

Ambas acciones están detrás de una confirmación explícita, porque un paste es público: los informes de fallos pueden incluir nombres de jugadores y tu lista completa de mods. El panel nunca sube nada por sí solo.
