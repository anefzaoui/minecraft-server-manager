// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { starlightLocales } from './src/i18n/locales.js';
import { starlightSidebar } from './src/i18n/sidebar.js';

// Screenshots and the changelog are imported straight from the repo root (single-sourced).
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const NESTED_REPO_NO_EXTERNAL = ['js-yaml'];

const SITE = 'https://minecraft-server-manager.com';
const REPO = 'https://github.com/anefzaoui/minecraft-server-manager';

// Starlight owns /docs/** (every locale) and, from its `locales` table, also
// configures Astro's i18n routing + the sitemap (with hreflang alternates) for
// the whole site, including the marketing pages under src/pages/.
export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Minecraft Server Manager',
      description: 'Free, self-hosted control panel for Minecraft servers on Docker.',
      logo: { src: './src/assets/logo.svg', alt: '' },
      favicon: '/favicon.svg',
      locales: starlightLocales(),
      social: [
        { icon: 'github', label: 'GitHub', href: REPO },
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/Ud6TrQkbDZ' },
      ],
      editLink: { baseUrl: `${REPO}/edit/main/` },
      customCss: ['./src/styles/starlight.css'],
      // Starlight emits og:title/description itself; the card image is site-wide.
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE}/og.png` } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${SITE}/og.png` } },
      ],
      lastUpdated: false,
      // The site ships its own src/pages/404.astro (GitHub Pages serves /404.html).
      disable404Route: true,
      sidebar: starlightSidebar(),
      components: {
        SiteTitle: './src/components/starlight/SiteTitle.astro',
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
