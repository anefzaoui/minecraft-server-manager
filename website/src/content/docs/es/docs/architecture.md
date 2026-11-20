---
title: 'Arquitectura'
description: 'Minecraft Server Manager es una aplicación Node.js renderizada en servidor y de un solo proceso.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Volver al índice de documentación](/docs/)

Minecraft Server Manager es una aplicación Node.js renderizada en el servidor y de proceso único. Gestiona
servidores de Minecraft que se ejecutan como contenedores Docker utilizando la imagen
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicándose con el
demonio Docker a través de su API (nunca ejecutando el CLI `docker` externamente).

## Forma de ejecución

- **Express + Handlebars** renderizan páginas en el lado del servidor. No hay SPA; el JS del navegador en `public/js/`
  es una mejora progresiva escrita a mano. Un paso de esbuild (`pnpm run build:js`) lo empaqueta y
  minifica en `public/dist/js/`; la aplicación sirve ese paquete cuando está presente y la fuente sin procesar
  de lo contrario, por lo que una ejecución de desarrollo sin compilación todavía funciona.
- **`node:sqlite`** (integrado en Node; el panel requiere Node ≥ 24) es la base de datos: síncrona,
  sin módulos nativos, modo WAL. Un pequeño ejecutor de migraciones versionadas aplica `src/db/migrations/*` al
  arrancar. Las sentencias preparadas se almacenan en caché en `src/db/index.js` con la clave del texto SQL.
- **`ws`** transporta los flujos de consola y estadísticas en vivo. Ambos son **intermediados**: una conexión
  `docker logs --follow` (o `docker stats`) por servidor, desmultiplexada una vez y distribuida a cada
  pestaña conectada, en lugar de una conexión por espectador. El intermediario de consola mantiene un pequeño búfer de repetición
  para las pestañas que se unen tarde y descarta a un suscriptor cuyo socket se retrasa demasiado en lugar de
  bloquear el flujo compartido.
- **dockerode** es la única forma en que la aplicación se comunica con Docker. El punto final se detecta automáticamente por plataforma
  (tubería con nombre de Windows vs. socket Unix).
- **Todo el estado persistente vive en un solo directorio** (`$DATA_DIR`, por defecto `./data`). Copiar ese
  directorio migra todo el panel.

## Capas

Las dependencias fluyen en una dirección:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   analiza y valida la entrada, da forma a las respuestas
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   lógica de dominio (las funcionalidades reales)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infraestructura
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - un enrutador por dominio (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` monta los de nivel superior (`api.js`, la API JSON de sesión que también contiene las rutas principales del servidor
  y monta los enrutadores de dominio por servidor; `index.js`, las páginas; `auth`, `account`,
  `tasks`, …). Los enrutadores validan con zod, llaman a un servicio y devuelven JSON
  o renderizan una vista. La lógica de negocio no pertenece aquí. Dos enrutadores se montan en la **zona pública
  **, antes de `requireAuth`: `routes/status.js` (páginas de estado por servidor opcionales) y
  `routes/apiV1.js` (`/api/v1`, una API JSON de solo lectura autenticada por un token Bearer emitido por el administrador
  de `services/apiTokens.js`, desactivada a menos que esté habilitada en Configuración; consulte `docs/public-api.md`).
- **`services/`** - el corazón de la aplicación. Cada servicio posee un dominio y puede depender de
  la infraestructura y de otros servicios.
- **`docker/`** - envoltorios de dockerode: `connect` (detección de punto final + salud del demonio), `containers`
  (crear/iniciar/detener/recrear con montajes de enlace, límites de memoria/CPU y etiquetas), `logs`, `stats`,
  `images`, `networks` (descubrimiento de red del host), `hostPath` (re-enraíza las rutas de enlace bajo
  `DATA_DIR_HOST`), y un `watcher` que convierte los eventos de Docker en historial + detección de fallos.
- **`db/`** - el envoltorio de SQLite y el ejecutor de migraciones.
- **`storage/`** - el arranque de `./data`, el **guardián de rutas** (`safeJoin`, la columna vertebral de seguridad de archivos),
  y el indexador de tamaño en segundo plano + aplicación de cuotas.

Transversal:

- **`config/`** - configuración del entorno más el **catálogo de campos**: la única fuente de verdad para
  la configuración del servidor. Cada variable de entorno de itzg está catalogada (etiqueta, ayuda, tipo, unidad, valor predeterminado,
  validación, sección, indicadores de peligro). El asistente, los formularios de configuración y la validación de zod se derivan
  de él, por lo que exponer una nueva configuración es un cambio de datos, no una nueva canalización de UI.
- **`events/`** - `recordEvent()` es el único punto de entrada para el registro de historial; los eventos del ciclo de vida también
  capturan extractos de registros de contenedores en `data/logs/<id>/events/`.
- **`ws/`** - WebSockets de consola + estadísticas autenticados (cookie de sesión verificada al actualizar, `Origin`
  comprobado para bloquear secuestro entre sitios), intermediados por servidor (ver "Forma de ejecución").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` devuelve un registrador
  [Pino](https://getpino.io) por módulo; nivel de `LOG_LEVEL`, `makeFailureThrottle()` mantiene un bucle en segundo plano que falla persistentemente a una sola línea de registro más una línea de "recuperado".
  `src/utils/logSanitize.js` redacta claves con forma de credenciales y tokens de webhook de los metadatos estructurados; `src/config/logLevel.js` es la lista blanca de niveles compartida (mantenida separada para evitar un ciclo de require con `config`). `src/instrument.js` es una costura Sentry inactiva, cargada primero en
  `src/server.js`. `src/web/middleware/requestLog.js` escribe una línea de registro de acceso por solicitud
  (omitiendo `/healthz` y activos estáticos). ESLint aplica `no-console` en `src/**`, con
  `preflight.js`, `instrument.js`, y `config/index.js` exentos (se ejecutan antes de que exista el registrador).
- **Limitación de velocidad** - `src/web/middleware/rateLimit.js` coloca `express-rate-limit` delante de `/api`
  (`RATE_LIMIT_API_PER_MIN`, por defecto 1200) y las publicaciones de inicio de sesión / 2FA / configuración
  (`RATE_LIMIT_AUTH_PER_15MIN`, por defecto 100); `0` deshabilita un limitador. Clave por `req.ip`, por lo que
  `TRUST_PROXY` importa detrás de un proxy. `/api/v1` tiene sus propios limitadores: un límite por IP de cliente
  (cinco veces el presupuesto por token) que se ejecuta antes de verificar el token, luego un presupuesto por token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, por defecto 120) con clave por el ID del token verificado. Un
  contador suave separado por cuenta en
  `src/web/middleware/auth.js` maneja el bloqueo de inicio de sesión (por IP y global de cuenta, decayendo).
- **Autorización**: dos capas. El rol global (`requireAuth` → `requireRole` / `requireWrite` en
  `src/web/middleware/auth.js`) controla las acciones de todo el panel y es el predeterminado en cada servidor. Los permisos por servidor
  (`src/services/permissions.js`, nueve capacidades almacenadas como una lista JSON por
  `(usuario, servidor)` en `user_server_permissions`) refinan el predeterminado para un servidor; cada
  ruta `/api/servers/:id`, montaje de subenrutador, página, WebSocket y listado de toda la flota pasan por
  `src/web/middleware/serverAccess.js` (`serverScope`, montado en el prefijo `/servers/:id` tanto de
  la API como del enrutador de páginas, oculta un servidor sin `view` como un 404; `requireCap(cap)` nombra
  la capacidad que necesita una ruta). Las escrituras que nombran su servidor en el cuerpo (programaciones, extracción e instalación de mundos, exportación de planos) se abren para los espectadores solo por `requireWrite` para ese servidor, y cada una de esas rutas verifica la capacidad en sí misma. `test/permissions-routes.test.js` recorre las pilas de enrutadores en vivo y falla si una ruta de escritura con ámbito de servidor, montaje o página no tiene una puerta de enlace.

## Comportamientos clave del dominio

- **Los modpacks siempre están fijados.** La imagen actualiza automáticamente los paquetes no fijados en cada reinicio, por lo que el panel resuelve "latest" a un ID de versión concreto en el momento de la instalación y lo fija. Las actualizaciones son un flujo orquestado explícito (`updates/`): vista previa → copia de seguridad previa a la actualización → parada elegante → re-fijación → recreación → monitor de salud → reversión con un clic.
- **La superposición de mods personalizados** es administrada por el panel: los mods añadidos por el usuario aterrizan en la biblioteca deduplicada y se enlazan físicamente al servidor para que sobrevivan a las actualizaciones del paquete. La deshabilitación es consciente de la clase. Debido a que la biblioteca conserva cada compilación que ha descargado, una actualización registra la compilación que reemplazó (`server_content.previous_*`) y se puede revertir solo desde archivos locales. Deshabilitar un mod del paquete escribe la variable de entorno de exclusión del paquete en su lugar; `packs.applyPack` transporta eso y el resto de la afinación del paquete (`PACK_TUNING_KEYS`) a través de un cambio de versión del mismo paquete, y lo elimina cuando el paquete cambia.
- **Una actualización de versión de Minecraft tiene que ganarse.** `services/compat.js` escanea los mods de un servidor, resueltos a partir de filas instaladas por el panel, luego del manifiesto del paquete CurseForge, y luego por hash de contenido contra Modrinth/CurseForge, y construye una matriz de soporte (cargador, versión de Minecraft) por proyecto a partir de `latestFilesIndexes` de CurseForge (200 proyectos por solicitud) y la lista de versiones por proyecto de Modrinth (una solicitud por proyecto, que es lo que mantiene el cargador y la versión emparejados). El verificador de actualizaciones solo ofrece la versión más reciente que CADA mod admite, y no ofrece nada en absoluto cuando la respuesta no se puede establecer: sin escaneo, un escaneo para una versión o cargador diferente, uno que nunca terminó, o un jar que ningún registro reconoce. Los escaneos son solo manuales, y su progreso y resultados parciales viven en `version_compat` (no en el `services/tasks.js` en memoria), por lo que una actualización o un reinicio del panel se reanudan en lugar de quedarse colgados en un spinner; `reconcileScans()` marca los escaneos huérfanos por un apagado al arrancar.
- **La versión del cargador de mods es una fijación, como todo lo demás.** `services/loaderPin.js` lee la compilación instalada del propio manifiesto de instalación de la imagen (`.forge-manifest.json` y similares) y escribe la fijación: la variable itzg del cargador en un servidor normal (`FORGE_VERSION`, …), o `CF_MOD_LOADER_VERSION` en un paquete CurseForge de Forge o Fabric, que anula la versión que declara el paquete. El instalador de CurseForge de la imagen ignora esa anulación para NeoForge, y los paquetes Modrinth y FTB no tienen ninguna, por lo que su cargador sigue al paquete. `packs.applyPack` elimina todas las variables `CF_` en una actualización o reversión de paquete, lo que elimina una anulación con el resto. Una compilación tipificada se verifica primero contra la lista completa del registro (`services/loaderVersions.js`; la de Forge proviene de sus metadatos de maven, que omite números; un error se vuelve a verificar una vez contra el registro en sí), luego el cambio es copia de seguridad → fijación (sobre el entorno tal como está después de la copia de seguridad) → reconstrucción.
- **Los puertos** se asignan a partir de un esquema base (juego desde `PORT_GAME_START` hacia arriba, RCON = juego + `PORT_RCON_OFFSET`, Bedrock desde `PORT_BEDROCK_START`), se sondean para ver si están disponibles y se reservan en la DB. "Ocupado" es la unión de las reclamaciones de cada servidor (puertos activos, más un par pendiente a continuación), cada puerto de host que publica cualquier contenedor Docker (`containers.publishedHostPorts`: enlaces activos de contenedores en ejecución más los configurados de cada contenedor detenido, porque una sonda de enlace del sistema operativo desde dentro del propio contenedor del panel solo ve el espacio de red de ese contenedor), y la sonda del sistema operativo. La parte de Docker se almacena en caché durante 3 segundos y tiene límites: una lista que no responde en 2.5 segundos descarta solo la parte de Docker, y una inspección lenta cuesta solo los puertos de ese contenedor. La creación de servidores y `servers.changeGamePort` eligen puertos a través de una cadena de serialización que solo cubre la elección y su reclamación (la escritura de la fila para una creación, la reserva en memoria para un cambio de puerto); el selector de puertos de BlueMap y las anulaciones de puertos adicionales no están en él y no consultan Docker. Un cambio de puerto en un servidor existente (`servers.changeGamePort`, bajo el bloqueo de operación del servidor) se aplica de una vez, porque Docker corrige los enlaces de puertos en la creación del contenedor: el nuevo par (RCON siempre juego + `PORT_RCON_OFFSET`) se verifica y reserva en memoria (`ports.reserve`, tanto el antiguo como el nuevo par, honrado por cada otra elección) bajo el bloqueo de puertos. Se rechaza (409 `PENDING_CHANGES`) mientras otras configuraciones esperan una reconstrucción, por lo que solo reconstruye un contenedor que ya se ejecutó, en un nuevo puerto; y un servidor en ejecución solo se cambia cuando la solicitud dice `restart: true` (de lo contrario, 409 `NEEDS_CONFIRM`). La imagen se extrae y se verifica el nombre de contenedor personalizado antes de tocar nada. Se detiene un servidor en ejecución; luego se escribe el nuevo par con `pending_recreate = 1` (para que un fallo del panel desde allí deje un "reconstrucción pendiente" honesto), se elimina el contenedor, se reconstruye en el nuevo par y se inicia. Si algún paso después de la parada falla, `putBackOnOldPort` escribe el par antiguo de nuevo, lo reconstruye (y lo reinicia, si estaba en ejecución) y registra qué paso falló; el historial y las alertas dicen si incluso eso falló, lo que deja el servidor detenido hasta que alguien lo inicie. La capacidad `settings` es suficiente, incluido el servidor en ejecución. Los no administradores solo pueden elegir entre `PORT_GAME_START` hacia arriba.
  (Las columnas `port_*_pending` de la migración 029 pertenecen a un diseño anterior, no publicado, y no se utilizan; 031 las borra.) Una colisión de bloqueo responde 409 con `code: 'BUSY'`, que los llamadores que reintentan verifican en lugar de la redacción. Un reinicio automático tras fallo (`watcher.restartAfterCrash`) y una copia de seguridad programada o inicio (`scheduler.runTaskWithRetry`) que encuentran el servidor ocupado con otra acción intentan de nuevo cada 20 s / 60 s durante hasta 30 minutos, y una actualización o reversión de paquete reintenta sus pasos bloqueados de la misma manera (`opLock.retryWhileBusy`); un reinicio tras fallo o un inicio programado en espera se rinden una vez que alguien ha detenido, matado o iniciado el servidor desde entonces (`events.lifecycleActionSince`), y el reinicio tras fallo también cuando el reinicio automático está desactivado o el servidor ha desaparecido. Los reinicios programados, las paradas y los comandos no se reintentan, y un programa cuyo último ejecución todavía está esperando omite su próxima activación.
- **Las cuotas de disco** son aplicadas por el panel porque Docker no puede limitar el uso de montajes de enlace: el indexador almacena en caché los tamaños por directorio y las operaciones de crecimiento del disco están sujetas a ellos.
- **Los secretos** (contraseñas RCON, claves API, secretos TOTP, URL de webhook de Discord) se cifran en reposo con AES-256-GCM utilizando una clave aleatoria dedicada en `$DATA_DIR/.secret-key` (modo `0600`, generado automáticamente). Es independiente de `SESSION_SECRET`; una clave derivada de `SESSION_SECRET` se mantiene como una copia de seguridad solo de descifrado para valores escritos antes de que existiera la clave dedicada, y `src/services/secretsMigration.js` vuelve a cifrar esos bajo la clave dedicada una vez al arrancar.
  Un `.secret-key` que existe pero no se puede analizar es un error de arranque grave (nunca se regenera silenciosamente por encima). Los planos eliminan todos los secretos al exportar.
- **`server.properties` es propiedad del panel pero está sombreado por entorno.** La imagen itzg reafirma cada
  propiedad respaldada por entorno en cada inicio (`OVERRIDE_SERVER_PROPERTIES` por defecto verdadero), por lo que un valor que
  el panel edita directamente - PvP/dificultad de Controles del Mundo, el interruptor de lista blanca, el editor de Archivos -
  sería revertido silenciosamente en el próximo inicio a menos que la variable de entorno coincidente se elimine y el contenedor se recree. Cada escritura directa de propiedad pasa por `writeServerProperties()` (archivo completo) o `setServerProperty()` (una clave) en `src/services/servers.js`, que reescriben atómicamente el archivo, desestablecen la variable de entorno detrás de cada clave cambiada (a través del atributo `prop:` en los campos del catálogo, verificado en pruebas contra las propias definiciones de propiedades de la imagen), y marcan
  `pending_recreate`. La dificultad se escribe en el archivo y también se envía a través de RCON, porque un servidor dedicado re-aplica la propiedad `difficulty` en cada arranque. Minecraft en sí mismo vuelve a guardar server.properties a partir de sus valores de arranque en `whitelist on/off`, lo que deshace las ediciones realizadas mientras el servidor se ejecuta, por lo que el interruptor de lista blanca en ejecución captura primero el archivo y lo vuelve a escribir solo con `white-list` cambiado. El entorno
  las variables permanecen completamente configurables en la creación (el asistente las renderiza y se aplican una vez); solo se desanclan la primera vez que el panel edita la propiedad subyacente. MOTD tiene el mismo contrato: una edición directa del archivo `motd` lo desestablece, por lo que la última escritura gana.

## Formatos de datos y de cableado

- **`data/panel.db`** - la base de datos SQLite. Se captura instantáneamente a diario mediante `VACUUM INTO` a
  `data/backups/_panel/` (se conservan las 14 más recientes); `PRAGMA integrity_check` se ejecuta al arrancar.
- **`data/.session-secret`** - el secreto de firma de cookies generado automáticamente, creado en la primera ejecución si
  `SESSION_SECRET` no está establecido. Eliminarlo rota el secreto (lo que invalida las sesiones).
- **`data/.secret-key`** - la clave de cifrado dedicada de 32 bytes en reposo (modo `0600`), creada automáticamente
  en la primera ejecución. Independiente de `SESSION_SECRET`; eliminarlo hace que cada credencial almacenada
  sea indescifrable, por lo que pertenece a sus copias de seguridad.
- **Planos (`.mcserver.zip`)** - un zip con un `manifest.json` que describe la configuración, los recursos, la
  referencia del paquete fijado, el manifiesto de superposición (URL de origen + sha256), los archivos de configuración elegidos y
  opcionalmente un mundo. La importación vuelve a descargar y verifica el hash de cada mod y asigna nuevos puertos.
- **Contenedores Docker** creados por el panel se nombran y etiquetan para que el observador pueda encontrarlos;
  el panel posee todo su ciclo de vida.

## Secuencia de arranque

1. `require('./instrument')` (la costura Sentry) antes que nada, luego `require('./preflight')`
   para fallar claramente en una versión de Node no compatible.
2. Cargar configuración; asegurar/generar `.session-secret` **y** `.secret-key`.
3. `ensureDataRoot()` - crear la estructura `./data`, limpiar `tmp/`.
4. Ejecutar migraciones de DB, luego `PRAGMA integrity_check` (registra ruidosamente, apunta a `data/backups/_panel`
   en caso de fallo).
5. Volver a cifrar cualquier secreto heredado con clave `SESSION_SECRET` bajo `.secret-key` (`secretsMigration`).
6. Importar claves API del entorno una vez (`apiKeys.importFromEnvOnce()`), fijar cualquier servidor que todavía
   tenga un selector de modpack no fijado (`packPins.pinUnpinnedServers()`), marcar los escaneos de compatibilidad de versión dejados en ejecución por un proceso anterior como interrumpidos
   (`compat.reconcileScans()`), luego sembrar planos de inicio (protegidos).
7. Iniciar el servidor HTTP + WS. En un enlace expuesto, imprimir el PIN de `/setup` de la primera ejecución.
8. Instalar el guardia de tiempo de ejecución posterior al arranque (captura fallos no controlados; `MSM_EXIT_ON_FATAL=1` hace que salga de forma forzada para despliegues supervisados).
9. Iniciar servicios en segundo plano: intermediario WS, indexador de almacenamiento, observadores de fallos + inventario, programador, puente de eventos de Discord, observador de alcance de chatbot y el **temporizador de mantenimiento diario** (poda filas de análisis antiguas, transcripciones de chatbot, historial de eventos (365 días) y filas de caché de API, luego captura instantánea de `panel.db`).
10. Inicializar Docker **en segundo plano**. La UI es completamente utilizable mientras el demonio está caído;
    las funciones de Docker se activan cuando se vuelve accesible. Una vez conectado, `refreshStatuses({ boot })`
    reconcilia los estados en caché, emite un evento único `offline-after-restart` para un servidor que estaba activo antes de que el panel se reiniciara y no se recuperará, y el bucle de arranque inicia los servidores `auto_start` además de recuperar los servidores `auto_restart` encontrados fallidos durante la interrupción
    (respetando el retroceso de bucle de fallos).

> El orden instrumentar-antes-de-preflight es una compensación deliberada: permite que una futura conexión Sentry
> aplique el tiempo de ejecución primero, a costa de un mensaje ligeramente menos amigable en una versión de Node verdaderamente antigua.

## Pipeline de compilación

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM con división de código). `postinstall` ejecuta **solo CSS**. `public/css/app.css`
y `public/dist/` son artefactos de compilación ignorados por git; la etapa de compilación del Dockerfile ejecuta el `pnpm run build` completo
y copia `public/` en la imagen de tiempo de ejecución. Los activos estáticos se sirven con caché
inmutable/larga para archivos con huella digital, caché corta para CSS/JS y sin caché para HTML y
`/api`.
