// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { starlightLocales } from './src/i18n/locales.js';
import { starlightSidebar } from './src/i18n/sidebar.js';
import { lastCommitDate, docSource } from './src/lib/gitDates.js';
import { releases } from './src/lib/changelog.js';
import docImages from './src/lib/doc-images.js';
import docAnchors from './src/lib/doc-anchors.js';

// Screenshots and the changelog are imported straight from the repo root (single-sourced).
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const NESTED_REPO_NO_EXTERNAL = ['js-yaml'];

const SITE = 'https://minecraft-server-manager.com';
const REPO = 'https://github.com/anefzaoui/minecraft-server-manager';

// The sitemap Starlight would add on its own (same hreflang alternates for
// every locale), plus <lastmod> where the date is real: a docs page carries the
// last commit of its source in docs/, the changelog its newest release.
const LOCALE_CONFIG = starlightLocales();
const DOCS_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?docs\/(?:([\w-]+)\/)?$/;
function lastmod(url) {
  const path = new URL(url).pathname;
  const doc = path.match(DOCS_PATH);
  if (doc) return lastCommitDate(docSource(doc[1] || 'index'));
  if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?changelog\/$/.test(path)) {
    const newest = releases()[0];
    return newest ? new Date(`${newest.date}T00:00:00Z`) : undefined;
  }
  return undefined;
}
const siteMap = sitemap({
  i18n: {
    defaultLocale: 'root',
    locales: Object.fromEntries(Object.entries(LOCALE_CONFIG).map(([key, l]) => [key, l.lang])),
  },
  serialize(item) {
    const date = lastmod(item.url);
    return date ? { ...item, lastmod: date.toISOString() } : item;
  },
});

// Starlight owns /docs/** (every locale) and, from its `locales` table, also
// configures Astro's i18n routing + the sitemap (with hreflang alternates) for
// the whole site, including the marketing pages under src/pages/.
export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  integrations: [
    siteMap,
    docImages(),
    docAnchors(),
    starlight({
      title: 'Minecraft Server Manager',
      description: 'Free, self-hosted control panel for Minecraft servers on Docker.',
      logo: { src: './src/assets/logo.svg', alt: '' },
      favicon: '/favicon.svg',
      locales: LOCALE_CONFIG,
      social: [
        { icon: 'github', label: 'GitHub', href: REPO },
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/Ud6TrQkbDZ' },
      ],
      editLink: { baseUrl: `${REPO}/edit/main/` },
      customCss: ['./src/styles/starlight.css'],
      // Starlight emits og:title/description itself; each page's card image and
      // JSON-LD come from src/routeData.js.
      head: [
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
      ],
      routeMiddleware: './src/routeData.js',
      lastUpdated: false,
      // The site ships its own src/pages/404.astro (GitHub Pages serves /404.html).
      disable404Route: true,
      sidebar: starlightSidebar(),
      components: {
        SiteTitle: './src/components/starlight/SiteTitle.astro',
        SocialIcons: './src/components/starlight/SocialIcons.astro',
        Head: './src/components/starlight/Head.astro',
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    server: { fs: { allow: [repoRoot] } },
    // The site is nested inside the app repo, so Node resolution from the built
    // prerender chunks walks up into the app's own node_modules. Any package the
    // app pins at a different major than Astro/Starlight use must be bundled
    // here instead of externalised, or the app's copy wins at prerender time.
    // js-yaml: app v5 (no default export) vs Astro + Starlight v4.
    // Astro 7 builds through Vite environments, so the setting goes on each
    // server-side environment rather than the legacy top-level `ssr` key.
    environments: {
      ssr: { resolve: { noExternal: NESTED_REPO_NO_EXTERNAL } },
      prerender: { resolve: { noExternal: NESTED_REPO_NO_EXTERNAL } },
    },
  },
});
