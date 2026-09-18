---
title: 'Planos'
description: 'Un plano captura toda la configuración de un servidor (tipo, versión, recursos, entorno, pin del pack y, opcionalmente, su configuración y mundo) en un único archivo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Volver al índice de documentación](/docs/)

Un **blueprint** (plantilla) captura toda la configuración de un servidor (tipo, versión, recursos, entorno, pin del pack y, opcionalmente, su configuración y mundo) en un único archivo portátil del que puedes crear nuevos servidores.

![Blueprints](/docs/images/blueprints.png)

## Exportación

Desde un servidor, exporta un blueprint y elige qué incluir: la configuración siempre, y opcionalmente archivos incrustados y el mundo. El resultado se guarda en tu biblioteca de blueprints y se puede descargar para compartir.

## Importación y creación a partir de un blueprint

Importa un archivo de blueprint (o elige uno de la biblioteca) para crear un nuevo servidor preconfigurado exactamente igual al original. Es la forma más rápida de:

- Crear servidores idénticos (una red de servidores de minijuegos, copias de staging de producción).
- Mover un servidor entre paneles.
- Mantener una plantilla conocida y fiable a la que siempre puedes recurrir.

Dado que un blueprint registra el [pin del pack](/docs/modpacks/) exacto, un servidor de modpack recreado a partir de un blueprint instala la misma versión fijada, sin sorpresas de actualizaciones.
