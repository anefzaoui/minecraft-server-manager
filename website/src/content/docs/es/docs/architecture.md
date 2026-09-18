---
title: 'Arquitectura'
description: 'Minecraft Server Manager es una aplicación Node.js renderizada en servidor y de un solo proceso.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Volver al índice de documentación](/docs/)

Minecraft Server Manager es una aplicación Node.js renderizada en el servidor, de un solo proceso. Gestiona
servidores de Minecraft que se ejecutan como contenedores Docker utilizando la imagen
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), comunicándose con el
demonio de Docker a través de su API (nunca ejecutando el CLI `docker` externamente).

## Forma de ejecución

- **Express + Handlebars** renderizan páginas en el servidor. No hay SPA; el JS del navegador en `public/js/`
  es una mejora progresiva escrita a mano. Un paso de esbuild (`pnpm run build:js`) lo empaqueta y
  minifica en `public/dist/js/`; la aplicación sirve ese paquete cuando está presente y el código fuente
  sin procesar en caso contrario, por lo que una ejecución de desarrollo sin compilación sigue funcionando.
- **`node:sqlite`** (integrado en Node; el panel requiere Node ≥ 24) es la base de datos: síncrona,
  sin módulos nativos, modo WAL. Un pequeño ejecutor de migraciones versionadas aplica `src/db/migrations/*`
  al arrancar. Las sentencias preparadas se almacenan en caché en `src/db/index.js` con la clave del texto SQL.
- **`ws`** transporta los flujos de consola y estadísticas en vivo. Ambos son **intermediados**: una conexión
  upstream `docker logs --follow` (o `docker stats`) por servidor, desmultiplexada una vez y distribuida a cada
  pestaña conectada, en lugar de una conexión upstream por espectador. El intermediario de consola mantiene un
  pequeño búfer de repetición para las pestañas que se unen tarde y descarta a un suscriptor cuyo socket se retrasa
  demasiado en lugar de detener el flujo compartido.
- **dockerode** es la única forma en que la aplicación se comunica con Docker. El punto final se detecta
  automáticamente por plataforma (tubería con nombre de Windows frente a socket Unix).
- **Todo el estado persistente vive en un solo directorio** (`$DATA_DIR`, por defecto `./data`). Copiar ese
  directorio migra todo el panel.

## Capas

Las dependencias fluyen en una sola dirección:

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

- **`web/routes/`** - un enrutador por dominio (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), montado en `web/app.js`. Los enrutadores validan con zod, llaman a un servicio y devuelven JSON
  o renderizan una vista. La lógica de negocio no pertenece aquí. Dos enrutadores se montan en la **zona pública**,
  antes de `requireAuth`: `routes/status.js` (páginas de estado HTML por servidor, opcionales) y
  `routes/apiV1.js` (`/api/v1`, una API JSON de solo lectura autenticada por un token Bearer emitido por el administrador
  desde `services/apiTokens.js`, desactivada a menos que se habilite en Configuración; ver `docs/public-api.md`).
- **`services/`** - el corazón de la aplicación. Cada servicio posee un dominio y puede depender de la
  infraestructura y de otros servicios.
- **`docker/`** - envoltorios de dockerode: `connect` (detección de punto final + estado del demonio), `containers`
  (crear/iniciar/detener/recrear con montajes de enlace, límites de memoria/CPU y etiquetas), `logs`, `stats`,
  `images`, y un `watcher` que convierte eventos de Docker en historial + detección de fallos.
- **`db/`** - el envoltorio de SQLite y el ejecutor de migraciones.
- **`storage/`** - el arranque de `./data`, el **guardián de rutas** (`safeJoin`, la columna vertebral de seguridad de archivos),
  y el indexador de tamaño en segundo plano + aplicación de cuotas.

Transversal:

- **`config/`** - configuración del entorno más el **catálogo de campos**: la única fuente de verdad para la configuración
  del servidor. Cada variable de entorno de itzg está catalogada (etiqueta, ayuda, tipo, unidad, valor predeterminado,
  validación, sección, indicadores de peligro). El asistente, los formularios de configuración y la validación zod se derivan
  todos de él, por lo que exponer una nueva configuración es un cambio de datos, no una nueva canalización de UI.
- **`events/`** - `recordEvent()` es el único punto de entrada para el registro de historial; los eventos del ciclo de vida también
  capturan fragmentos de registros de contenedores en `data/logs/<id>/events/`.
- **`ws/`** - WebSockets de consola + estadísticas autenticados (cookie de sesión verificada al actualizar, `Origin` comprobado para
  bloquear secuestro entre sitios), intermediados por servidor (ver "Forma de ejecución").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` devuelve un registrador
  [Pino](https://getpino.io) por módulo; nivel de `LOG_LEVEL`, `makeFailureThrottle()` mantiene un bucle en segundo plano
  que falla persistentemente en una línea de registro más una línea de "recuperado".
  `src/utils/logSanitize.js` redacta claves con formato de credenciales y tokens de webhook de los metadatos estructurados;
  `src/config/logLevel.js` es la lista de permitidos de nivel compartida (mantenida separada para evitar un ciclo de require con
  `config`). `src/instrument.js` es una costura Sentry inactiva, cargada primero en `src/server.js`.
  `src/web/middleware/requestLog.js` escribe una línea de registro de acceso por solicitud (omitiendo `/healthz` y activos estáticos).
  ESLint aplica `no-console` en `src/**`, con `preflight.js`, `instrument.js`, y `config/index.js` exentos (se ejecutan antes de que exista el registrador).
- **Limitación de velocidad** - `src/web/middleware/rateLimit.js` coloca `express-rate-limit` delante de `/api`
  (`RATE_LIMIT_API_PER_MIN`, predeterminado 1200) y las publicaciones de inicio de sesión / 2FA / configuración
  (`RATE_LIMIT_AUTH_PER_15MIN`, predeterminado 100); `0` deshabilita un limitador. Se basa en `req.ip`, por lo que
  `TRUST_PROXY` es importante detrás de un proxy. `/api/v1` tiene su propio limitador por token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, predeterminado 120), basado en un hash del token Bearer con una opción de respaldo de IP.
  Un contador suave separado por cuenta en `src/web/middleware/auth.js` maneja el bloqueo de inicio de sesión (por IP y global por cuenta,
  disminuyendo).

## Comportamientos clave del dominio

- **Los Modpacks siempre se fijan.** La imagen actualiza automáticamente los paquetes no fijados en cada reinicio, por lo que
  el panel resuelve "latest" a un ID de versión concreto en el momento de la instalación y lo fija. Las actualizaciones son un
  flujo orquestado explícito (`updates/`): vista previa → copia de seguridad previa a la actualización → parada elegante →
  re-fijación → recreación → monitor de estado → reversión con un clic.
- **La superposición de mods personalizados** es gestionada por el panel: los mods añadidos por el usuario aterrizan en la biblioteca
  deduplicada y se enlazan físicamente al servidor para que sobrevivan a las actualizaciones del paquete. La desactivación es consciente de la clase.
- **Los puertos** se asignan a partir de un esquema base (juego desde `PORT_GAME_START` hacia arriba, RCON = juego +
  `PORT_RCON_OFFSET`, Bedrock desde `PORT_BEDROCK_START`), se sondean para ver su disponibilidad y se reservan en la
  base de datos.
- **Las cuotas de disco** son aplicadas por el panel porque Docker no puede limitar el uso de montajes de enlace: el indexador
  almacena en caché los tamaños por directorio y las operaciones de crecimiento de disco están sujetas a ellos.
- **Los secretos** (contraseñas RCON, claves API, secretos TOTP, la URL del webhook de Discord) se cifran en reposo
  con AES-256-GCM utilizando una clave aleatoria dedicada en `$DATA_DIR/.secret-key` (modo `0600`,
  generada automáticamente). Es independiente de `SESSION_SECRET`; se mantiene una clave derivada de `SESSION_SECRET` como
  respaldo solo de descifrado para valores escritos antes de que existiera la clave dedicada, y
  `src/services/secretsMigration.js` las vuelve a cifrar bajo la clave dedicada una vez al arrancar.
  Un `.secret-key` que existe pero no se puede analizar es un error de arranque grave (nunca se regenera silenciosamente
  por encima). Los planos eliminan todos los secretos al exportar.

## Formatos de datos y de cableado

- **`data/panel.db`** - la base de datos SQLite. Se instantánea diariamente a través de `VACUUM INTO` a
  `data/backups/_panel/` (se conservan las 14 más recientes); `PRAGMA integrity_check` se ejecuta al arrancar.
- **`data/.session-secret`** - el secreto de firma de cookies generado automáticamente, creado en la primera ejecución si
  `SESSION_SECRET` no está establecido. Eliminarlo rota el secreto (lo que invalida las sesiones).
- **`data/.secret-key`** - la clave de cifrado dedicada en reposo de 32 bytes (modo `0600`), creada automáticamente
  en la primera ejecución. Independiente de `SESSION_SECRET`; eliminarla hace que cada credencial almacenada sea
  indescifrable, por lo que pertenece a tus copias de seguridad.
- **Planos (`.mcserver.zip`)** - un zip con un `manifest.json` que describe la configuración, los recursos, la
  referencia del paquete fijado, el manifiesto de superposición (URLs de origen + sha256), los archivos de configuración elegidos y
  opcionalmente un mundo. La importación vuelve a descargar y verifica el hash de cada mod y asigna puertos nuevos.
- **Contenedores Docker** creados por el panel se nombran y etiquetan para que el observador pueda encontrarlos;
  el panel posee su ciclo de vida completo.

## Secuencia de arranque

1. `require('./instrument')` (la costura Sentry) antes que nada, luego `require('./preflight')`
   para fallar claramente en una versión de Node no compatible.
2. Cargar configuración; asegurar/generar `.session-secret` **y** `.secret-key`.
3. `ensureDataRoot()` - crear la estructura de `./data`, limpiar `tmp/`.
4. Ejecutar migraciones de la base de datos, luego `PRAGMA integrity_check` (registra ruidosamente, apunta a `data/backups/_panel`
   en caso de fallo).
5. Volver a cifrar cualquier secreto heredado con clave `SESSION_SECRET` bajo `.secret-key` (`secretsMigration`).
6. Sembrar planos de inicio (protegidos).
7. Iniciar el servidor HTTP + WS. En un enlace expuesto, imprimir el PIN de `/setup` de la primera ejecución.
8. Instalar el guardia de tiempo de ejecución posterior al arranque (captura fallos no controlados; `MSM_EXIT_ON_FATAL=1` hace que salga
   forzosamente para despliegues supervisados).
9. Iniciar servicios en segundo plano: intermediario WS, indexador de almacenamiento, observadores de fallos e inventario, programador,
   puente de eventos de Discord y el **temporizador de mantenimiento diario** (poda filas de análisis antiguas + instantánea de
   `panel.db`).
10. Inicializar Docker **en segundo plano**. La UI es completamente utilizable mientras el demonio está caído;
    las funciones de Docker se activan cuando se vuelve accesible. Una vez conectado, `refreshStatuses({ boot })`
    reconcilia los estados en caché, emite un evento único `offline-after-restart` para un servidor que estaba activo antes de que el panel se reiniciara y no se volverá a iniciar, y el bucle de arranque inicia los servidores `auto_start` más recupera los servidores `auto_restart` encontrados fallidos durante la interrupción
    (respetando el retroceso de bucle de fallos).

> El orden de instrumentación-antes-preflight es una compensación deliberada: permite que una futura conexión Sentry
> aplique primero el tiempo de ejecución, a costa de un mensaje ligeramente menos amigable en una versión de Node verdaderamente antigua.

## Pipeline de compilación

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM con división de código). `postinstall` ejecuta **solo CSS**. `public/css/app.css`
y `public/dist/` son artefactos de compilación ignorados por git; la etapa de compilación de Dockerfile ejecuta el `pnpm run build` completo
y copia `public/` en la imagen de tiempo de ejecución. Los activos estáticos se sirven con caché
inmutable/larga para archivos con huella digital, caché corta para CSS/JS y sin caché para HTML y
`/api`.
