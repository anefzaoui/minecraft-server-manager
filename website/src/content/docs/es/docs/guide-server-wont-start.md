---
title: 'Tu servidor de Minecraft no se inicia'
description: 'Un servidor de Minecraft que no se inicia, solucionado por orden de probabilidad: el registro, la versión de Java, la memoria, el EULA y el puerto, y los mods.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Volver al índice de documentación](/docs/)

Trabaja en esta lista. Está ordenada por la frecuencia con la que cada una es la respuesta, y las cuatro primeras cubren la mayoría de los casos.

## 1. Lee las últimas veinte líneas, no las primeras

Desplázate hasta el **final** del registro. Una traza de pila de Java se imprime primero desde el interior, por lo que la parte superior del muro de texto es la menos interesante. Lo que buscas es la última línea `Caused by:` y lo que sigue. Esa única línea suele nombrar el problema.

Dos formas te indican dónde estás:

- `Exception in thread "main"` o una ruta de informe de fallos cerca del final significa que el propio juego falló.
- El registro simplemente se detiene a mitad de línea, sin ninguna excepción, significa que algo mató el proceso desde el exterior. Salta al punto 3.

## 2. UnsupportedClassVersionError significa la Java incorrecta

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

El archivo de clase 52 es Java 8, 60 es 16, 61 es 17, 65 es 21, 69 es 25. El mensaje significa que el servidor necesita una Java más nueva de la que está ejecutando; lo contrario, un paquete antiguo en una Java nueva, suele fallar con un error de mixin o reflexión en su lugar.

| Versión de Minecraft | Java |
| -------------------- | ---- |
| 1.16.5 y anteriores  | 8    |
| 1.17                 | 16   |
| 1.18 y 1.19          | 17   |
| 1.20 a 1.20.4        | 17   |
| 1.20.5 a 1.21.x      | 21   |
| 26.1 y posteriores   | 25   |

Los paquetes antiguos realmente necesitan Java 8. Una versión más nueva no es mejor aquí.

## 3. El código de salida 137 es el kernel, no un mod

El registro se detiene a mitad de frase, no hay informe de fallos y el contenedor informa 137. Esa es una terminación por falta de memoria: el proceso solicitó memoria que la máquina no tenía, por lo que fue terminado.

Casi siempre la pila de Java se estableció en el mismo número que la memoria de la máquina. La pila necesita la memoria de la máquina **menos** la sobrecarga propia de la JVM, que es de 0.5 a 1.5 GB en un servidor con mods. Reduce la pila o aumenta la máquina. [Cuánta RAM necesita un servidor](/docs/guide-server-memory/) tiene los números.

## 4. El EULA y el puerto

Dos clásicos con soluciones de una línea:

- `You need to agree to the EULA in order to run the server.` Establece `eula=true`, en `eula.txt` o con la variable de entorno que tu configuración utilice.
- `Address already in use` o `FAILED TO BIND TO PORT`. Algo más está ocupando el puerto 25565, a menudo una copia anterior del mismo servidor que nunca se detuvo por completo. Encuéntrala y detenla en lugar de cambiar el puerto, o terminarás con dos.

## 5. A un mod le falta su dependencia

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Los mods de Fabric abrumadoramente necesitan Fabric API como un archivo separado. Los mods de Forge y NeoForge listan sus dependencias en el propio error. Instala la versión nombrada, no la más reciente: "requires 0.91.x" significa esa línea, y 0.92 fallará la misma comprobación.

A veces, la dependencia que falta es el propio cargador:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

La solución es una compilación más reciente del cargador, no un mod diferente. "47.4.14 o superior" significa cualquier compilación a partir de ahí, y Forge no publica todos los números, por lo que la compilación a instalar puede ser la siguiente. En un modpack, actualiza primero el paquete: un paquete cuya propia versión de cargador sea demasiado antigua para sus mods es un error que su autor debe corregir.

## 6. Un mod es para el cargador o la versión incorrectos

Un jar para un cargador diferente no falla educadamente. Espera un error de mixin, un `NoClassDefFoundError`, o un fallo dentro de una clase de la que nunca has oído hablar. Comprueba la página del jar: tanto el cargador como la versión de Minecraft deben coincidir exactamente. 1.20.1 y 1.20.4 son juegos diferentes en lo que respecta a los mods.

## 7. El mundo es de una versión más reciente

```
This world was created by a newer version of Minecraft
```

Los mundos se actualizan hacia adelante y nunca hacia atrás. Restaura la copia de seguridad de antes de la actualización, o ejecuta la versión que espera el mundo. No hay una ruta de degradación que mantenga los trozos intactos.

## Cuando falló después de funcionar bien durante semanas

Pregunta diferente, respuesta normalmente diferente:

- **Falló bajo carga**, con tiempos que muestran largas pausas: recolección de basura, así que mira el tamaño de la pila antes de los mods.
- **Falló en el mismo punto del mundo**: un trozo corrupto o una entidad rota. El informe de fallos suele nombrar las coordenadas.
- **Falló justo después de una actualización**: el mod que se actualizó es el sospechoso, incluso si la traza apunta a otro lugar. Reviértelo y compruébalo.
- **Falló al reiniciar, habiendo estado bien antes**: comprueba el disco. Un disco lleno produce errores espectaculares y engañosos.

## Obtener ayuda que realmente ayude

Publica el **registro completo**, no la última línea, y di qué cambiaste antes de que se rompiera. Pégalo en un lugar diseñado para ello, como [mclo.gs](https://mclo.gs), en lugar de en el chat. Incluye la versión de Minecraft, el cargador, el paquete y su versión, y cuánta pila tiene el servidor. Un informe con esos cuatro datos se responde en una sola respuesta; sin ellos, se necesitan cinco.

## En Minecraft Server Manager

Los fallos se detectan a partir de la propia salida del contenedor, por lo que un servidor que muere a las tres de la mañana se registra con su extracto de registro en lugar de encontrarse al día siguiente. Los sospechosos habituales de esta página (el EULA, la Java incorrecta, un mundo de una versión más reciente, un puerto ya en uso, la Java quedándose sin memoria) se reconocen en ese registro y se nombran en la entrada del historial con qué hacer al respecto, y el reinicio automático los deja en paz, ya que reiniciar no los solucionará. Los informes de fallos se analizan al recibirlos: la excepción se resalta, la pila es colapsable y los mods que aparecen en la traza se enumeran como sospechosos.

Cualquier informe se puede compartir en mclo.gs desde su tarjeta cuando necesites ayuda (después de una confirmación, ya que la publicación es pública), y el menú **Descargar** de la consola tiene todos los archivos de registro en un solo zip, por lo que "publicar el registro completo" es una descarga en lugar de un proyecto de arqueología. Una terminación por falta de memoria se registra como tal, lo que ahorra la hora habitual de culpar a un mod. Si algo más necesita genuinamente el puerto, la tarjeta **Puerto del juego** en **Configuración → Configuración** mueve el servidor a uno libre.

Un cargador que es demasiado antiguo se cambia desde la pestaña **Versiones** del servidor, que comprueba que la compilación existe y hace una copia de seguridad antes de reconstruir el servidor ([cambiar la versión del cargador de mods](/docs/updates/#changing-the-mod-loader-version)).

Relacionado: [cuánta RAM necesita un servidor](/docs/guide-server-memory/), [elegir un cargador](/docs/guide-choosing-a-loader/), [crear y gestionar servidores](/docs/servers/).
