// One social card per page, rendered at build time (src/lib/og.js). English
// copy only: every locale of a page shares its card, which keeps the build to
// about sixty images and needs no fonts for other scripts.
//   /og/<page>.png          marketing pages and hubs (key from routes.js)
//   /og/<hub>-<slug>.png    landing pages
//   /og/docs/<slug>.png     docs pages (index for /docs/)
import { getCollection } from 'astro:content';
import { renderCard } from '../../lib/og.js';
import { getCopy } from '../../i18n/index.js';
import { PAGES, HUBS, landingPages } from '../../lib/routes.js';

const SPRITE = (id) => `src/assets/gen/${id}.webp`;
const SHOT = (file) => `../docs/screenshots/${file}`;

/** The first sentence when it fits on three lines, else whole words and an ellipsis. */
function clamp(text = '', max = 150) {
  const first = text.match(/^.+?[.!?](?=\s|$)/)?.[0] || text;
  if (first.length <= max) return first;
  return `${first.slice(0, 110).replace(/\s+\S*$/, '')}…`;
}

export async function getStaticPaths() {
  const copy = getCopy('en');
  const cards = [];
  const art = {
    features: 'sprite-chest',
    install: 'sprite-clock',
    faq: 'sprite-shield',
    changelog: 'sprite-map',
    docs: 'sprite-map',
  };
  for (const p of PAGES) {
    if (p.key === 'home') {
      cards.push({
        card: 'home',
        props: { title: copy.hero.title, subtitle: clamp(copy.site.tagline), screenshot: SHOT('01-dashboard.png') },
      });
      continue;
    }
    const hub = HUBS.find((h) => h.id === p.key);
    if (hub) {
      const c = copy[hub.hubKey];
      cards.push({
        card: p.key,
        props: { title: c.title, eyebrow: c.eyebrow, subtitle: clamp(c.intro), sprite: SPRITE(hub.sprite) },
      });
      continue;
    }
    const meta = copy.meta[p.key] || {};
    cards.push({
      card: p.key,
      props: {
        title: meta.title || copy.nav[p.key],
        subtitle: clamp(meta.description),
        ...(p.key === 'screenshots'
          ? { screenshot: SHOT('03-server-overview.png') }
          : { sprite: SPRITE(art[p.key] || 'sprite-server') }),
      },
    });
  }
  for (const entry of landingPages()) {
    const c = copy[entry.key];
    cards.push({
      card: `${entry.hub.id}-${entry.slug}`,
      props: { title: c.title, eyebrow: c.eyebrow, subtitle: clamp(c.intro), sprite: SPRITE(entry.sprite) },
    });
  }
  const docs = (await getCollection('docs')).filter((d) => /^docs\//.test(d.id) || d.id === 'docs');
  for (const d of docs) {
    const slug = d.id === 'docs' ? 'index' : d.id.slice('docs/'.length);
    cards.push({
      card: `docs/${slug}`,
      props: {
        title: d.data.title,
        eyebrow: 'Docs',
        subtitle: clamp(d.data.description),
        sprite: SPRITE('sprite-map'),
      },
    });
  }
  return cards.map(({ card, props }) => ({ params: { card }, props }));
}

export async function GET({ props }) {
  const png = await renderCard(props);
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
