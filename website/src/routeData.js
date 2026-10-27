// Starlight route middleware: per-page SEO for the docs. Each doc page gets
// its own social card (/og/docs/<slug>.png, shared by every locale), JSON-LD
// for the article and its breadcrumb trail, and a title short enough for
// search results.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCopy } from './i18n/index.js';
import { DEFAULT_LOCALE, langTag } from './i18n/locales.js';
import { SITE_URL, breadcrumbLd } from './lib/routes.js';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const locale = route.locale || DEFAULT_LOCALE;
  const id = route.entry.id.replace(/^[a-z]{2}(-[a-z]{2})?\//, '');
  if (!/^docs(\/|$)/.test(id)) return;
  const slug = id === 'docs' ? 'index' : id.slice('docs/'.length);
  const card = new URL(`/og/docs/${slug}.png`, SITE_URL).href;
  const copy = getCopy(locale);
  const path = slug === 'index' ? '/docs/' : `/docs/${slug}/`;
  const trail = [
    [copy.nav.home, '/'],
    [copy.nav.docs, '/docs/'],
    ...(slug === 'index' ? [] : [[route.entry.data.title, path]]),
  ];
  const article = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: route.entry.data.title,
    description: route.entry.data.description,
    inLanguage: langTag(locale),
    url: new URL(context.url.pathname, SITE_URL).href,
    image: card,
    author: { '@type': 'Organization', name: copy.site.name, url: SITE_URL },
    publisher: { '@type': 'Organization', name: copy.site.name, url: SITE_URL },
    isPartOf: { '@type': 'WebSite', name: copy.site.name, url: SITE_URL },
  };
  // Search results cut titles near 60 characters: keep the brand suffix only
  // while the whole title still fits.
  const title = route.head.find((t) => t.tag === 'title');
  if (title && title.content.length > 65) title.content = route.entry.data.title;
  route.head.push(
    { tag: 'meta', attrs: { property: 'og:image', content: card } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: card } },
    { tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify(article) },
    { tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify(breadcrumbLd(locale, trail)) }
  );
});
