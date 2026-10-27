# The website

The public site at **https://minecraft-server-manager.com** lives in [`website/`](../website/) and is
built from this repository. It is the marketing hub plus a rendered copy of these docs, in 30
languages, deployed as static files to GitHub Pages.

## What it is made of

| Piece                 | Where                                                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static site generator | [Astro](https://astro.build) 7                                          | Zero client JavaScript by default; images resized to WebP at build time.                                                                                                                                                                                                                                                                                                                                 |
| Docs shell            | [Starlight](https://starlight.astro.build)                              | Sidebar, search (Pagefind, offline), per-locale UI strings, RTL support.                                                                                                                                                                                                                                                                                                                                 |
| Styling               | Tailwind v4, `website/src/styles/site.css`                              | The game's own UI language, drawn from scratch: bevelled stone buttons, inventory-slot panels, tiled block textures, an XP-bar divider, item-tooltip callouts. Jersey 15 (OFL, a pixel face that stays legible at label sizes) for headings and labels, IBM Plex Sans body. No gradients, no rounded corners. Day is the default; `data-theme="dark"` is night (shares the docs' `starlight-theme` key). |
| Copy                  | `website/src/i18n/en.json`                                              | English is the source of truth. Other locales are translations of it, committed next to it.                                                                                                                                                                                                                                                                                                              |
| Locales               | `website/src/i18n/locales.js`                                           | The one list every other piece derives from (routing, sitemap hreflang, language menu, translation script).                                                                                                                                                                                                                                                                                              |
| Docs pages            | generated from `docs/*.md`                                              | `website/scripts/sync-docs.js` copies them on every build, adds front matter, rewrites GitHub-relative links. Never edit the copies.                                                                                                                                                                                                                                                                     |
| Changelog page        | generated from `CHANGELOG.md`                                           | Same script. English only.                                                                                                                                                                                                                                                                                                                                                                               |
| Screenshots           | `docs/screenshots/*.png`, `docs/images/mobile/*.png`                    | Imported straight from the docs so there is one copy.                                                                                                                                                                                                                                                                                                                                                    |
| Landing pages         | `website/src/components/LandingPage.astro`, `website/src/lib/routes.js` | Server types, guides and comparisons. One component renders every page from its `en.json` key; `HUBS` in `routes.js` lists them. See "Landing pages" below.                                                                                                                                                                                                                                              |
| Social cards          | `website/src/lib/og.js`, `website/src/pages/og/[...card].png.js`        | A 1200x630 PNG per page, drawn at build time in the site's look (satori lays it out with the bundled OFL fonts in `src/assets/og-fonts/`, sharp rasterises). English copy; every locale of a page shares its card.                                                                                                                                                                                       |
| Install tutorial      | `website/src/components/InstallTutorial.astro`                          | Four tabs (Compose, Portainer/Dockge, source, PM2/systemd), numbered steps, copy buttons. Two inputs (data folder, host) rewrite every command and the panel URL live; tabs are radios so they work without JavaScript. Commands live in the component, the prose in `en.json` under `tutorial`.                                                                                                         |
| Illustrations         | `website/src/assets/gen/*.webp`, `website/scripts/gen-images.js`        | Original art generated through OpenRouter (see below) and committed as WebP. `website/src/data/art.js` looks them up by id; a missing picture just renders nothing.                                                                                                                                                                                                                                      |
| Textures              | `website/public/textures/*.png`, `website/scripts/textures.js`          | Procedural 16x16 tiles (grass, dirt, stone, planks, cloud, heart) in the palette, byte-identical on every run. No Mojang assets anywhere on the site.                                                                                                                                                                                                                                                    |
| Hosting               | GitHub Pages                                                            | `website/public/CNAME` holds the domain. `.github/workflows/website.yml` builds and deploys on push to `main`.                                                                                                                                                                                                                                                                                           |

## URL layout

- `/` `/features/` `/screenshots/` `/install/` `/faq/` `/changelog/`: marketing pages.
- `/servers/…` (Paper, Fabric, Forge, Vanilla, Modpacks), `/guides/…` (Raspberry Pi, home server, leaving
  paid hosting, several servers), `/compare/…` (Pterodactyl, Crafty Controller, AMP, MCSManager): landing
  pages, each group with a hub page at its root.
- `/docs/…`: one page per file in `docs/`, `docs/README.md` becomes `/docs/`.
- Every locale except English is prefixed: `/ar/`, `/fr/docs/backups/`, … English has no prefix.
- `/og/<page>.png`, `/og/<hub>-<slug>.png`, `/og/docs/<slug>.png`: social cards.
- `/sitemap-index.xml`, `/robots.txt`, `/404.html`, `/site.webmanifest`, `/apple-touch-icon.png`, `/icon-512.png`.

Every page carries a canonical URL, `hreflang` alternates for all locales plus `x-default`, Open
Graph and Twitter card tags with its own card image, and JSON-LD: `WebSite` and `Organization`
everywhere, `SoftwareApplication` on the product pages, and `BreadcrumbList`, `FAQPage`, `HowTo`,
`ItemList` and `TechArticle` where they apply. Docs pages get theirs from the Starlight route
middleware in `website/src/routeData.js`. The sitemap repeats the alternates. Titles drop the
" · Minecraft Server Manager" suffix when it would push them past 65 characters.

## Commands (from the repo root)

```bash
pnpm run site:dev        # dev server with hot reload (syncs docs first)
pnpm run site:build      # production build into website/dist
pnpm run site:preview    # serve website/dist locally
pnpm run site:check      # astro check (types + template errors)
pnpm run site:verify     # post-build checks: SEO tags, cards, hreflang, JSON-LD, sitemap, links, title length
pnpm run site:translate  # translate changed English source into every locale (see below)
```

`website/dist/`, the synced docs copies and the Astro cache are gitignored. The build is fully
offline: no fonts, scripts or translations are fetched at build or run time.

## Translations

Translations are produced by `website/scripts/translate.js` and **committed**, so the build never
needs an API key and every string can be reviewed in a pull request.

- Provider: OpenRouter, `google/gemini-2.5-flash-lite` by default (`--model=<id>` to override; a unit
  that hits the token cap is retried once on `google/gemini-2.5-flash`). The whole site is well under
  a dollar. Key: `OPENROUTER_API_KEY` in `website/.env`.
- Source units: each top-level key of `en.json`, the docs sidebar group labels, and for each synced
  doc two units: the body (markdown, no front matter) and the front matter (title + description) as
  a small JSON unit, written to `website/src/i18n/docs-meta/<lang>.json` and merged into the file.
  Sending the front matter inline made the model rewrite it as a code block, so it never is.
- `website/src/i18n/translation-manifest.json` stores the hash of the English text each translation
  came from. Only units whose English changed are re-sent, so a typo fix costs cents.
- `--dry-run` prints the pending work and the estimate, `--locales=ar,fr` and `--only=docs` narrow
  the run; eight requests run in flight.
- Every result is validated before it is written: identical JSON shape, same code fences, same link
  targets, same headings. A result that fails is reported and skipped; re-run to retry only those.
- `UNTRANSLATED_DOCS` in the script lists docs that stay English on purpose (today only this
  page: its wide tables make every model loop, and its readers are maintainers).
- A locale with no translation yet still renders: marketing pages fall back to English key by key
  and show a one-line notice; Starlight shows its own "not translated yet" notice on docs pages.

Workflow after editing English copy or a doc: commit the English change, run
`pnpm run site:translate`, review the diff, commit the translations.

## Brands and pills (the "boast, don't bury" rule)

Anything the panel works with is never listed inside a sentence. `website/src/data/brands.js` holds
one entry per registry, server type, modpack source, platform, integration and checksum; `Pill`,
`PillRow` and the `WorksWith` strip under the hero render from it. Logos come from
[Simple Icons](https://simpleicons.org) (CC0) where one exists; everything else gets a generated
pixel item icon (`icon-<id>`). Copy items carry a `pills: [ids]` array instead of naming things in
their `body`. Brand names are never translated.

## Generated illustrations

`website/scripts/gen-images.js` creates every illustration (hero panoramas, card scenes, section
banners, sprites, the 404 scene) through OpenRouter's image models and writes them to
`website/src/assets/gen/` as WebP (sprites lossless, scenes at quality 86). The files are
**committed**, so builds never call the API.

- Key: `OPENROUTER_API_KEY` in `website/.env` (gitignored). Rotate it if it ever leaks.
- Idempotent: `manifest.json` stores the prompt hash per image; a re-run only regenerates images
  whose prompt changed or whose file is missing. `--force` redoes everything, `--only=id,id` narrows.
- Sprites are asked for on a flat magenta background and chroma-keyed to transparency in the
  script, so any model works.
- Every prompt insists on original blocky characters and scenery; nothing is a likeness of an
  existing game character, texture or logo.
- Cost is printed per image (about $0.07 each at the time of writing).

## Landing pages

A landing page is data, not a new template. Its copy is one top-level key in `en.json` (one key per
page, so the translator sends each page as its own request), with this shape; every block is
optional except the meta, title and intro:

```jsonc
{
  "meta": { "title": "≤ 60 characters, search phrase first", "description": "≤ 160 characters" },
  "eyebrow": "short label above the title",
  "title": "the H1",
  "intro": "one or two sentences",
  "pills": ["brand ids"],
  "sections": [{ "title": "", "body": "", "points": [""], "pills": [""], "shot": "screenshot key" }],
  "steps": { "title": "", "items": [{ "title": "", "body": "" }] },
  "table": {
    "title": "",
    "columns": ["", "Minecraft Server Manager", "Other"],
    "rows": [{ "label": "", "values": ["", ""] }],
    "note": "",
  },
  "faq": { "title": "", "items": [{ "q": "", "a": "" }] },
  "related": ["other page keys"],
  "cta": { "title": "", "body": "" },
}
```

Hubs (`serversHub`, `guidesHub`, `compareHub`) add `cards: { "<pageKey>": "summary" }`. To add a
page: write its key in `en.json`, add `{ key, slug, sprite }` to its hub in `HUBS`, run the
translator. Comparison pages state only facts checked against the other project's own docs, carry
the date they were checked in `table.note`, and always say when the other panel is the better pick.

## Doc page descriptions

A doc's search description is the opening of its first paragraph (whole sentences, 70 to 160
characters). A doc whose opening makes a poor summary sets one explicitly, anywhere in the file:

```md
<!-- description: How much RAM a Minecraft server needs, by server type and player count. -->
```

GitHub does not render the comment, and the site strips it from the page.

## Adding a page, a locale, or a screenshot

- **Marketing page:** add `website/src/pages/[...locale]/<name>.astro` (copy an existing one), the
  route in `website/src/lib/routes.js` (`header: true` to show it in the top bar), its copy under
  `meta.<name>` and `nav.<name>` in `en.json`. Its social card is generated from the meta.
- **Locale:** one line in `website/src/i18n/locales.js` (`code`, native `label`, `dir`, optional
  BCP-47 `lang`). Then run the translator for it. Jersey 15 only covers Latin scripts; headings in any
  other script fall back to IBM Plex Sans or the system font on their own.
- **Screenshot:** drop the PNG in `docs/screenshots/` and register it in
  `website/src/data/screenshots.js` with a caption key in `en.json`.
- **Illustration:** add an entry to `IMAGES` in `website/scripts/gen-images.js`, run it, reference
  the id through `art('<id>')`. After regenerating a hero panorama, run
  `node website/scripts/hero-extend.js` and copy the sky colour it prints into `--color-sky` in
  `site.css`, so the headers and the hero stay one blue.

## Hosting checklist (one-time)

1. Repository settings → Pages → Source: **GitHub Actions**.
2. Cloudflare DNS for `minecraft-server-manager.com`: `CNAME` at the apex (Cloudflare flattens it)
   and for `www`, both pointing at `anefzaoui.github.io`. Proxy off (DNS only) or SSL mode
   **Full (strict)**; anything else causes redirect loops.
3. After the first deploy, Pages → Custom domain shows the domain from `CNAME`; enable
   **Enforce HTTPS** once the certificate is issued.

Custom domains are per repository, so other projects on the same account can have their own
domains pointing at the same `anefzaoui.github.io` host.

## Gotcha: the site is nested inside the app

Node resolves packages from the built site upward into the app's `node_modules`. A package the
app pins at a different major than Astro or Starlight use (today: `js-yaml`, app v5 vs v4) must be
bundled rather than externalised, see `NESTED_REPO_NO_EXTERNAL` in `website/astro.config.mjs`. A
build failure of the shape "module X does not provide an export named Y" during "generating static
routes" is this, and the fix is one more entry in that list.
