---
title: 'Mover un servidor de Minecraft a otro host'
description: 'Mover un mundo es fácil. Mover un servidor al que los jugadores aún puedan conectarse, con sus inventarios, casas y permisos intactos, es la parte que suele salir mal.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Volver al índice de documentación](/docs/)

Mover un mundo es fácil. Mover un servidor al que los jugadores aún puedan conectarse, con sus inventarios, casas
y permisos intactos, es la parte que sale mal. El orden a continuación mantiene el tiempo de inactividad en unos pocos
minutos y conserva una forma de regresar si la nueva máquina decepciona.

## Haz un inventario primero

Anota esto antes de tocar nada. Cualquiera de estos puntos ha arruinado una migración cuando se asumió en lugar de verificarse:

- **Versión y cargador de Minecraft**, exactamente. 1.20.1 NeoForge no es 1.20.1 Forge.
- **La lista de mods o plugins con sus versiones.** El mundo no se cargará sin los mods que lo crearon.
- **Versión de Java**, que sigue a la versión de Minecraft.
- **`level-name`** de `server.properties`. La carpeta del mundo a menudo no se llama `world`.
- **Modo en línea.** Si el servidor antiguo se ejecutó con `online-mode=false` y el nuevo se ejecuta con él activado, o
  al revés, cada jugador obtiene un UUID diferente y, por lo tanto, un inventario completamente nuevo y vacío. Este es
  el error más doloroso de esta página.
- **Cualquier cosa que viva fuera de la carpeta del servidor**, como una base de datos MySQL de un plugin.

## Copia mientras se ejecuta, luego copia de nuevo mientras está detenido

El truco para un tiempo de inactividad corto es hacer la copia lenta primero.

1. **Con el servidor en ejecución**, copia todo el directorio del servidor a la nueva máquina. En un mundo grande
   esto puede llevar una hora; nadie se da cuenta, porque nada se ha detenido.
2. **Anuncia un reinicio, luego detén el servidor correctamente.** Una parada elegante hace que el juego guarde el
   mundo; matar el proceso no lo hace.
3. **Copia de nuevo.** Esta vez solo se mueven los archivos que cambiaron, por lo que lleva de segundos a minutos.
4. **Inícialo en la nueva máquina**, en un puerto no público si puedes, y conéctate tú mismo. Comprueba una
   base que conozcas, tu propio inventario y que los plugins o mods se cargaron sin errores.
5. **Luego** dirige a los jugadores hacia él.

`rsync -a --delete` es la herramienta habitual para los pasos 1 y 3. Conserva los permisos y las marcas de tiempo: un mundo
copiado por el usuario incorrecto es un servidor que no se iniciará, y el error no lo dirá claramente.

## No elimines el antiguo todavía

Mantén la máquina antigua, detenida pero intacta, durante al menos unos días. Es el único retroceso real. Mantenla
apagada en lugar de en ejecución, para que nadie se conecte accidentalmente a la copia abandonada y construya allí
durante una semana.

## Haz que la dirección sobreviva a la mudanza

Si los jugadores se conectan a una dirección IP desnuda, cada mudanza obliga a cada jugador a editar su lista de servidores, y
algunos de ellos nunca lo hacen.

Usa un nombre de host que controles, apuntando al servidor. Moverse entonces se convierte en un cambio de DNS, y la dirección
en el cliente de todos permanece igual. Reduce el tiempo de vida (TTL) del registro un día antes de la mudanza para que el
cambio se propague rápidamente.

Si quieres que los jugadores escriban un dominio desnudo mientras el servidor se ejecuta en un puerto no estándar, un registro SRV hace
eso. Es el mismo mecanismo que usan los hosts comerciales para entregar `play.something.net`.

## Comprueba la nueva máquina antes de confiar en ella

Tres cosas que difieren entre hosts y que causan problemas después de la mudanza:

- **El firewall.** Tu puerto de juego debe estar abierto, y solo tu puerto de juego. No expongas un panel de administración
  o un mapa a Internet solo porque funcionaba en localhost.
- **Velocidad de un solo núcleo.** Minecraft se preocupa mucho más por la velocidad de un núcleo que por cuántos hay.
  Ocho núcleos lentos se sentirán peor que dos rápidos.
- **Disco.** Un mundo en almacenamiento giratorio o en un volumen muy compartido tartamudeará durante la carga de fragmentos.

## Dejar un panel administrado

Si vienes de un host que te dio un panel de control en lugar de una máquina, busca el gestor de descargas o archivos,
y toma todo el directorio del servidor en lugar de solo el mundo. Obtén los archivos JAR de plugins y mods en sí, no una lista:
las versiones importan, y "latest" es un archivo diferente al mes siguiente.

Comprueba también que tus copias de seguridad sean tuyas. Una copia de seguridad que solo existe dentro del panel que estás dejando no es
una copia de seguridad que poseas.

## En Minecraft Server Manager

Todo el panel es un directorio. Copiarlo a otra máquina e iniciar el panel allí trae consigo cada servidor, mundo, copia de seguridad y configuración,
lo que hace que mover el panel en sí sea una copia en lugar de una migración.

Para un solo servidor en lugar de todos ellos, un plano captura su configuración, conjunto de mods y versión de paquete fijada (y, si lo marcas, el mundo activo)
como un único archivo `.mcserver.zip` que se puede importar en otro panel para reconstruir el mismo servidor. Los mundos se pueden descargar e instalar por separado cuando
solo el mundo necesita viajar.

Si el puerto de juego que usaba un servidor ya está ocupado en la nueva máquina, o quieres probar en un puerto no público primero, cámbialo en
**Settings → Configuration**: la tarjeta **Game Port** tiene **Use Next Free Port** (Usar Siguiente Puerto Libre), un servidor en ejecución pregunta antes de reiniciarse en el nuevo puerto, y si no puede iniciarse allí, vuelve al anterior. Cámbialo al puerto público cuando dirijas a los jugadores hacia él.

Relacionado: [planos](/docs/blueprints/), [copias de seguridad que realmente restauran](/docs/guide-backups/),
[mundos y archivos](/docs/worlds-and-files/).
