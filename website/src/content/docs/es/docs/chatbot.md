---
title: 'Chatbot de Minecraft por servidor'
description: 'Esta bifurcación añade un chatbot configurado por el administrador a cada servidor de Minecraft gestionado.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Volver al índice de documentación](/docs/)

Este fork añade un chatbot configurado por el administrador a cada servidor de Minecraft gestionado. Se conecta a un
endpoint de finalización de chat compatible con OpenAI, incluido Ollama en otro host de la LAN. Cada servidor tiene
su propio endpoint, modelo, nombre de invocación, personalidad, política de transcripción, mensajes de alcance y política de poder. La invocación predeterminada es `@wizard`, y la personalidad predeterminada demuestra un mago antiguo y juguetón dentro del juego; ambos son editables.

![Configuración del chatbot](/docs/images/integrations-chatbot.png)

## Experiencia del jugador

- Cualquier jugador puede usar `@wizard <mensaje>` (o la invocación configurada) para conversar y
  obtener ayuda con recetas vanilla determinista y consciente de la versión de Minecraft.
- Los saludos al unirse y una notificación única y configurable de registro de sesión de juego recuerdan a los jugadores que el chatbot está disponible. `@wizard chat` abre una breve ventana de conversación de opción; `@wizard bye` la cierra.
- Los **usuarios básicos** pueden invocar poderes de auto/mundo habilitados. Los **controladores de poder** pueden invocar acciones validadas por separado que afectan a otro jugador en línea. Los jugadores que no pertenecen a ninguno de estos grupos permanecen solo para conversación.
- Los autogalos de usuarios básicos utilizan una lista de elementos permitidos. Los controladores pueden dar a otro jugador cualquier elemento vanilla o modificado válido con espacio de nombres, sujeto al límite de cantidad y otras salvaguardas de poder.

![Transcripciones del chatbot](/docs/images/chatbot-transcripts.png)

## Diseño y seguridad

La configuración y las transcripciones son solo para administradores. El modelo nunca recibe RCON en bruto ni ejecución de comandos arbitraria. Un mensaje expone solo la única herramienta fija que coincide con su intención explícita;
el código del servidor valida la autorización, los argumentos, las banderas, las cantidades, los tiempos de espera y los nombres exactos de los jugadores en línea antes de ejecutar una operación de servicio existente. Se rechazan los selectores de Minecraft, las acciones entre jugadores no pueden dirigirse al llamador, los poderes comienzan en modo de simulación y cada poder intentado se audita. Los modelos de llamada de herramientas no compatibles vuelven a la conversación solamente.

Las respuestas están limitadas para el chat de Minecraft. Las recetas vanilla conocidas provienen de datos de recetas versionados incluidos y se renderizan como filas estables de 2x2/3x3; no se confía en que el LLM invente diseños de recetas. Las recetas desconocidas o modificadas dirigen al jugador a JEI/REI en lugar de fabricar una respuesta.

## Archivos principales de implementación

- `src/services/wizard.js`: configuración por servidor, solicitudes compatibles con OpenAI, manejo de chat,
  alcance, retención de transcripciones y límites de respuesta.
- `src/services/wizardPowers.js`: comprobaciones de roles, esquemas de herramientas específicos de intención, validación, ejecución,
  tiempos de espera y auditoría de poderes.
- `src/services/wizardRecipes.js`: búsqueda determinista de recetas versionadas y formato de cuadrícula. Los datos de recetas y elementos provienen del paquete incluido [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Un borrador anterior de este documento apuntaba a una carpeta `src/data/recipes/` que nunca se confirmó; no existe tal carpeta y los datos residen en el paquete. Consulte "Huella de dependencia".)
- `src/analytics/ingest.js`: reenvía las uniones, salidas y chats de jugadores analizados al chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` y
  `views/partials/server/integrations.hbs`: API de administración e interfaz de usuario de integraciones por servidor.
- `src/db/migrations/011_wizard_chat.js` a `019_wizard_power_controllers.js`: esquema persistente.
- `test/wizard.test.js`: pruebas de autorización, límites de herramientas, retención, alcance y comportamiento del chat.

Los nombres internos de ruta/módulo/tabla `wizard` se conservan para compatibilidad de actualización y API;
"chatbot" es el término del producto visible para el usuario. Del mismo modo, el campo almacenado `power_testers_json` se mapea al grupo **Usuarios básicos** de la interfaz de usuario.

## Huella de dependencia (`minecraft-data`)

La ayuda con recetas utiliza el paquete `minecraft-data`. Es grande en disco (aproximadamente 429 MB instalado) y se incluye dentro de la imagen de producción porque es una dependencia en tiempo de ejecución, no de desarrollo. Lo mantenemos a propósito para que la ayuda con recetas funcione sin conexión para cada versión de Minecraft sin llamadas de red.

Notas para quien revise esto a continuación (humano o IA), para que el tamaño no sea una sorpresa:

- Actualmente solo se utilizan los datos de Java (`pc`). `wizardRecipes.js` lee `minecraftData.versions.pc`
  y las tablas `recipes`, `items` y `blocks` por versión. Los archivos que realmente toca suman aproximadamente 15 MB en todas las versiones de pc.
- Alrededor de 330 MB del paquete son `data/bedrock`, y nada aquí lo lee todavía. Lo dejamos en su lugar a propósito. Si el panel alguna vez añade soporte para servidores de Minecraft Bedrock, los datos de recetas y elementos de Bedrock ya están aquí, por lo que la función de recetas puede crecer para cubrir servidores Bedrock sin añadir una nueva dependencia. Empiece desde `minecraftData.versions.bedrock` y siga la misma forma que la ruta de pc.
- Si el tamaño tiene que reducirse antes de que llegue el soporte de Bedrock, ya existe un patrón para ello en este repositorio. `src/services/itemRegistry.js` obtiene archivos de `minecraft-data` del CDN de jsDelivr cuando los necesita y los almacena en caché en `api_cache`. Cualquiera de esos enfoques, o un pequeño subconjunto de `src/data/recipes/` seleccionado a mano que cubra algunas versiones comunes, reduciría mucho la imagen.

## Almacenamiento local e inspección manual

Toda la configuración y las transcripciones conservadas residen en la base de datos SQLite del panel en `/data/panel.db` dentro del contenedor del panel. Con el montaje Compose estándar, la ruta del host es
`${DATA_DIR_HOST}/panel.db` (por ejemplo, `/opt/msm/data/panel.db`). Las tablas relevantes son
`wizard_configs`, `wizard_transcripts` y `wizard_outreach`; las auditorías de poder son filas en la tabla `events` con el tipo `wizard-power`. La clave API opcional del LLM está cifrada con AES-256-GCM utilizando el `SESSION_SECRET` del panel, normalmente persistido como `${DATA_DIR_HOST}/.session-secret`.

Haga una copia de seguridad de la base de datos y detenga el panel antes de editar SQLite directamente para que su WAL se maneje de forma segura.
Se prefiere usar la interfaz/API de administración porque aplica validación y cifrado. Mantenga los
archivos `panel.db`, `panel.db-wal` y `panel.db-shm` juntos al copiar una base de datos en vivo.
