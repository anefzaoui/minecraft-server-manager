---
title: 'Actualizaciones'
description: 'La página de Actualizaciones rastrea lo que está desactualizado en toda tu flota en un solo lugar:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Volver al índice de documentación](/docs/)

La página **Actualizaciones** rastrea lo que está desactualizado en toda tu flota en un solo lugar:

- Versiones de **Modpack** ([modpacks](/docs/modpacks/)) contra Modrinth / CurseForge / el índice de lanzamientos de GTNH.
- **Contenido personalizado** que añadiste tú mismo: mods, datapacks, resource packs, plugins, cada uno contra su fuente: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) o GitHub Releases. Las búsquedas de GitHub utilizan la revalidación ETag, por lo que las comprobaciones diarias apenas afectan su límite de tasa.
- Desactualización de la **imagen de Docker**: el ID de imagen de cada contenedor en ejecución contra una etiqueta recién descargada (deduplicada entre servidores con la misma etiqueta), ofrecida como una actualización que solo recrea el contenedor.
- **Fijaciones de versión independientes**: para un servidor sin un pack gestionado, una fijación explícita de `mc_version` contra el manifiesto de Mojang, y una variable de entorno explícita del loader-build (`PAPER_BUILD`, `FORGE_VERSION`, y similares) contra el registro del loader. Las compilaciones de Paper provienen de la **API Fill v3** actual de PaperMC (el punto final heredado v2 dejó de recibir nuevas versiones de Minecraft).

![Actualizaciones](/docs/images/updates.png)

## Cómo funciona

El panel comprueba las versiones fijadas de cada servidor contra la fuente externa y lista cualquier cosa con un lanzamiento más reciente. Un recuento coincidente también aparece en la ficha "Actualizaciones disponibles" del [panel principal](/docs/dashboard/).

Las comprobaciones se ejecutan bajo demanda y se pueden programar ([Programaciones](/docs/schedules/)). La **política** de actualización es por servidor: tú decides si el panel solo te notifica o si deja todo manual.

## Aplicar una actualización

Las actualizaciones nunca son silenciosas. Cuando eliges actualizar un pack, el panel:

1. Realiza una **copia de seguridad previa a la actualización** (para que sea reversible; se conservan las últimas 10 copias de seguridad previas a la actualización por servidor).
2. Vuelve a fijar la versión nueva exacta.
3. Recrea el contenedor, resolviendo el tiempo de ejecución de Java si es necesario.
4. Monitoriza el primer arranque, con un presupuesto de tiempo por plataforma.

Si no arranca correctamente, se revierte a la copia de seguridad previa a la actualización. A un servidor que sigue versiones estables nunca se le ofrece una beta, y el enlace al registro de cambios apunta a la diferencia real por versión donde la fuente la proporciona. Una actualización fallida también activa una [alerta](/docs/integrations/) de Discord si la integración está configurada.
