'use strict';

// Quilt runs Fabric mods (Quilt Loader ships Fabric API compatibility), so
// everywhere builds are filtered by loader a Quilt server must also accept
// fabric-tagged builds - otherwise Quilt users see a near-empty catalog, since
// most projects only tag their builds "fabric".

/** The loader tags a server accepts, server's own loader first. */
function compatibleLoaders(loader) {
  const l = String(loader || '').toLowerCase();
  if (!l) return [];
  return l === 'quilt' ? ['quilt', 'fabric'] : [l];
}

/** Does a build tagged with `buildLoaders` run on a `serverLoader` server? */
function loaderAccepts(serverLoader, buildLoaders) {
  const accepted = new Set(compatibleLoaders(serverLoader));
  return (buildLoaders || []).some((l) => accepted.has(String(l).toLowerCase()));
}

module.exports = { compatibleLoaders, loaderAccepts };
