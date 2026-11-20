---
title: 'API Pública'
description: 'Una pequeña API HTTP de solo lectura para obtener el estado del servidor desde fuera del panel: un panel de estado, un monitor de tiempo de actividad, un bot de Discord, una regla de automatización del hogar.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Volver al índice de documentación](/docs/)

Una API HTTP pequeña y de solo lectura para obtener el estado del servidor desde fuera del panel: un
panel de estado, un monitor de tiempo de actividad, un bot de Discord, una regla de automatización del hogar. Es
servida por el propio panel y devuelve los mismos datos en vivo que muestran las páginas del panel
(desde la caché en memoria), por lo que consultarla nunca toca Docker.

Está **desactivada hasta que un administrador la use** y está **restringida a administradores**. Nada se expone
hasta que exista un token.

## Habilitarla

**Configuración → API Pública → Nueva Clave**. Asígnale un nombre, elige qué puede ver (todos los
servidores o un subconjunto específico) y, opcionalmente, una fecha de caducidad. La clave completa (un token Bearer) se muestra **una sola vez**, en un cuadro de diálogo; cópiala ahora, porque solo se conserva un prefijo corto
después, para su identificación en la lista.

![Configuración de la API Pública](/docs/images/settings-public-api.png)

Crear la primera clave activa la API automáticamente (el interruptor **Permitir que aplicaciones externas lean el estado** es un control de pausa: desactívalo para dejar de servir sin cancelar ninguna clave). Cancela una clave desde la misma tabla en cualquier momento; los clientes que la usen pierden
acceso inmediatamente.

Los tokens se almacenan como un hash SHA-256 (nunca en texto plano), sobreviven a un reinicio del panel
y sobreviven a los servidores a los que están limitados (un servidor eliminado simplemente
se excluye de los resultados de ese token).

## Autenticación

Envía el token como una credencial Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

No hay cookies y **no hay CORS**: esto es para llamadores de servidor a servidor y de línea de comandos,
no para aplicaciones del navegador de otro origen. Si el panel está detrás de un proxy inverso,
asegúrate de que el proxy reenvíe la cabecera `Authorization`.

Los fallos devuelven `401` con `{ "ok": false, "error": "..." }`. Cualquier cosa que no sea `GET`
(o `HEAD`) devuelve `405`. Las rutas desconocidas devuelven `404`. Cuando la API está deshabilitada, cada ruta
devuelve `404`.

## Límite de tasa

Cada token obtiene su propio presupuesto, `RATE_LIMIT_PUBLIC_API_PER_MIN` (por defecto `120`
solicitudes/minuto; `0` deshabilita el limitador). Superar el límite devuelve `429`. Cada solicitud,
antes de que se verifique su token, también cuenta para un límite por IP del cliente de cinco veces ese número,
por lo que sondear con tokens faltantes, mal formados, revocados o caducados no puede eludir el presupuesto
rotándolos.

## Endpoints

### `GET /api/v1/servers`

Todos los servidores a los que está limitado el token.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

Un servidor, el mismo objeto bajo una clave `server`. Devuelve `404` para un id desconocido
**y** para un servidor al que el token no está limitado (sin oráculo de existencia), y `400`
para un id mal formado.

## Campos de respuesta

| Campo           | Significado                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `total`         | Cuántos servidores son visibles para este token (después de su filtro de alcance).             |
| `online`        | Cuántos de ellos están en estado: `running`.                                                   |
| `id`            | ID de servidor estable (`srv_...`).                                                            |
| `name`          | Nombre para mostrar.                                                                           |
| `type`          | Tipo de servidor de itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                          |
| `state`         | `running`, `starting`, `stopped` o `crashed`: un resumen estable del estado interno del panel. |
| `cpuPct`        | Porcentaje de CPU reciente, o `null` cuando el servidor no se está ejecutando.                 |
| `memoryMb`      | Memoria residente en MB, o `null`.                                                             |
| `memoryLimitMb` | Límite de memoria del contenedor configurado en MB, o `null`.                                  |
| `uptimeSeconds` | Segundos desde que se inició el contenedor, o `null`.                                          |
| `players`       | `{ online, max }`, o `null` hasta que el servidor informe una lista de jugadores.              |

## Ejemplo

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
