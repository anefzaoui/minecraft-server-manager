---
title: '¿Cuánta RAM necesita un servidor de Minecraft?'
description: '¿Cuánta RAM necesita un servidor de Minecraft para vanilla, Paper, mods ligeros y modpacks grandes, y cuánta dejar para la máquina?'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Volver al índice de documentación](/docs/)

Respuesta corta, para un servidor que se vaya a jugar realmente:

| Lo que estás ejecutando                       | Montón de Java (heap) | Dale a la máquina |
| --------------------------------------------- | --------------------- | ----------------- |
| Vanilla o Paper, hasta 10 jugadores           | 2 GB                  | 4 GB              |
| Paper con plugins, de 10 a 30 jugadores       | 4 GB                  | 6 GB              |
| Un modpack ligero, de 40 a 80 mods            | 4 GB                  | 6 GB              |
| Un pack "cocina-fregadero", de 150 a 300 mods | 6 a 8 GB              | 10 GB             |
| GregTech New Horizons y monstruos similares   | 8 a 12 GB             | 16 GB             |

Dos números, no uno. Esa es la parte que la mayoría de las guías omiten, y es la razón por la que la gente compra un servidor de 4 GB, le da 4 GB a Java, y luego lo ve morir.

## El montón (heap) y la máquina son números diferentes

El montón de Java (`-Xmx`) es la cantidad de memoria que el propio juego puede usar para el mundo, entidades y datos de mods. La máquina, o el contenedor, tiene que albergar ese montón **además** de todo lo que Java necesita: metadatos de clases, pilas de hilos, contabilidad del recolector de basura, búferes de red y la propia JVM. Esa sobrecarga es aproximadamente de 0.5 a 1.5 GB para un servidor con mods.

Si el montón es igual a la memoria de la máquina, el kernel mata el servidor en el momento en que Java intenta usar esa sobrecarga. En Docker, esto aparece como código de salida 137, y en los logs como nada en absoluto: el proceso simplemente desaparece a mitad de frase. La gente suele culpar a un mod.

Una regla segura: **montón más un 25 por ciento, y al menos un gigabyte de sobra.** Un montón de 8 GB necesita una máquina de 10 GB.

## Más RAM no es más rendimiento

Minecraft está limitado por un solo hilo en la mayor parte de lo que hace. Darle a un pack de 40 mods 16 GB no hace que los chunks se generen más rápido; hace que cada pausa de recolección de basura sea más larga, porque hay más que recorrer. Un servidor que tartamudea cada treinta segundos es a menudo un servidor con demasiado montón, no muy poco.

Aumenta el montón cuando veas esto, y no de otra manera:

- `java.lang.OutOfMemoryError: Java heap space` en el log.
- Repetidos "Can't keep up! Is the server overloaded?" con pausas de recolección de basura en los timings.
- Uso de memoria que sube hasta el techo y se queda ahí fijado durante horas.

## Por qué tu servidor muestra 12 GB usados mientras nadie está conectado

Porque se lo dijiste. Dos valores predeterminados conspiran:

1. La imagen común de Docker establece el montón inicial igual al máximo, por lo que `-Xms` y `-Xmx` son ambos tu número. Java lo reclama por adelantado en lugar de crecer hacia él.
2. El popular conjunto de flags de Aikar incluye `-XX:+AlwaysPreTouch`, que recorre cada página de ese montón al inicio para que las páginas se asignen realmente. Es deliberado: intercambia un arranque más lento y una cifra ociosa alta por menos pausas más tarde.

Medido en Paper 1.21.1 con un montón de 2 GB en un contenedor de 4 GB, muestreado durante tres minutos después de que el mundo terminara de cargarse:

| Configuración                                  | Memoria residente |
| ---------------------------------------------- | ----------------- |
| Sin flags                                      | 2.60 GiB          |
| Flags de Aikar                                 | 2.59 GiB          |
| Flags de Aikar sin `AlwaysPreTouch`            | 1.95 GiB          |
| Flags de Aikar con un montón inicial de 512 MB | 1.38 GiB          |
| Sin flags con un montón inicial de 512 MB      | 1.25 GiB          |

Así que un servidor "usando" 12 GB en inactivo suele ser un montón de 12 GB que ha sido pre-tocado, no una fuga. Tu monitorización lo está leyendo correctamente; el número simplemente no significa lo que parece.

Si quieres una cifra de inactividad honesta, establece el montón inicial más bajo que el máximo. Lo pagas con algunas colecciones más al principio. Si prefieres tiempos de fotogramas planos, déjalo estar y deja de mirar el gráfico.

## Los jugadores importan menos de lo que crees

Duplicar de 10 a 20 jugadores cuesta mucho menos que añadir cincuenta mods. Los jugadores añaden principalmente entidades y chunks cargados, que escalan suavemente. Los mods añaden datos de clases, registros, características de generación de mundos y sus propias cachés, que no lo hacen. El tamaño del pack primero, luego añade aproximadamente 100 a 200 MB por jugador regular en un servidor con mods.

La distancia de visión es la otra palanca importante. Bajar de 12 a 8 chunks puede ahorrar un gigabyte en un servidor concurrido y apenas se nota en el juego.

## En Minecraft Server Manager

Cada servidor tiene dos campos separados, **Montón de Java** y **Límite de memoria del contenedor**, precisamente porque son preguntas diferentes. El asistente de creación establece el límite del contenedor un 50 por ciento por encima del montón por ti, y el panel se niega a guardar un servidor cuyo límite de contenedor no esté por encima de su montón, porque esa combinación termina en código de salida 137 en lugar de un mensaje de error.

El medidor de memoria de un servidor muestra lo que el contenedor está usando realmente, con una nota cuando el montón se reclamó por adelantado, para que un montón pre-tocado no se lea como descontrolado. Un servidor que el kernel mató por falta de memoria se registra exactamente así en el historial, en lugar de como un fallo misterioso.

Relacionado: [creación y gestión de servidores](/docs/servers/),
[informes de fallos](/docs/servers/#crash-reports--mclogs-analysis), [almacenamiento y cuotas](/docs/storage/).
