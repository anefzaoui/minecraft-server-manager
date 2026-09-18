# The website

The public site at **https://minecraft-server-manager.com** lives in [`website/`](../website/) and is
built from this repository. It is the marketing hub plus a rendered copy of these docs, in 30
languages, deployed as static files to GitHub Pages.

## What it is made of

| Piece                 | Where                                                            | Notes                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static site generator | [Astro](https://astro.build) 7                                   | Zero client JavaScript by default; images resized to WebP at build time.                                                                                                                                                                                                                                                                          |
| Docs shell            | [Starlight](https://starlight.astro.build)                       | Sidebar, search (Pagefind, offline), per-locale UI strings, RTL support.                                                                                                                                                                                                                                                                          |
| Styling               | Tailwind v4, `website/src/styles/site.css`                       | The game's own UI language, drawn from scratch: bevelled stone buttons, inventory-slot panels, tiled block textures, an XP-bar divider, item-tooltip callouts. Pixelify Sans (OFL) for headings, IBM Plex Sans body. No gradients, no rounded corners. Day is the default; `data-theme="dark"` is night (shares the docs' `starlight-theme` key). |
| Copy                  | `website/src/i18n/en.json`                                       | English is the source of truth. Other locales are translations of it, committed next to it.                                                                                                                                                                                                                                                       |
| Locales               | `website/src/i18n/locales.js`                                    | The one list every other piece derives from (routing, sitemap hreflang, language menu, translation script).                                                                                                                                                                                                                                       |
| Docs pages            | generated from `docs/*.md`                                       | `website/scripts/sync-docs.js` copies them on every build, adds front matter, rewrites GitHub-relative links. Never edit the copies.                                                                                                                                                                                                              |
| Changelog page        | generated from `CHANGELOG.md`                                    | Same script. English only.                                                                                                                                                                                                                                                                                                                        |
| Screenshots           | `docs/screenshots/*.png`, `docs/images/mobile/*.png`             | Imported straight from the docs so there is one copy.                                                                                                                                                                                                                                                                                             |
| Install tutorial      | `website/src/components/InstallTutorial.astro`                   | Four tabs (Compose, Portainer/Dockge, source, PM2/systemd), numbered steps, copy buttons. Two inputs (data folder, host) rewrite every command and the panel URL live; tabs are radios so they work without JavaScript. Commands live in the component, the prose in `en.json` under `tutorial`.                                                  |
| Illustrations         | `website/src/assets/gen/*.webp`, `website/scripts/gen-images.js` | Original art generated through OpenRouter (see below) and committed as WebP. `website/src/data/art.js` looks them up by id; a missing picture just renders nothing.                                                                                                                                                                               |
| Textures              | `website/public/textures/*.png`, `website/scripts/textures.js`   | Procedural 16x16 tiles (grass, dirt, stone, planks, cloud, heart) in the palette, byte-identical on every run. No Mojang assets anywhere on the site.                                                                                                                                                                                             |
| Hosting               | GitHub Pages                                                     | `website/public/CNAME` holds the domain. `.github/workflows/website.yml` builds and deploys on push to `main`.                                                                                                                                                                                                                                    |

## URL layout

- `/` `/features/` `/screenshots/` `/install/` `/faq/` `/changelog/`: marketing pages.
- `/docs/…`: one page per file in `docs/`, `docs/README.md` becomes `/docs/`.
- Every locale except English is prefixed: `/ar/`, `/fr/docs/backups/`, … English has no prefix.
- `/sitemap-index.xml`, `/robots.txt`, `/404.html`, `/og.png`, `/site.webmanifest`.

Every page carries a canonical URL, `hreflang` alternates for all locales plus `x-default`, Open
Graph and Twitter card tags, and JSON-LD (`WebSite`, `Organization`, `SoftwareApplication`, plus
`FAQPage`, `HowTo` and `BreadcrumbList` where they apply). The sitemap repeats the alternates.

## Commands (from the repo root)

```bash
pnpm run site:dev        # dev server with hot reload (syncs docs first)
pnpm run site:build      # production build into website/dist
pnpm run site:preview    # serve website/dist locally
pnpm run site:check      # astro check (types + template errors)
pnpm run site:verify     # post-build checks: SEO tags, hreflang, JSON-LD, sitemap, internal links
pnpm run site:translate  # translate changed English source into every locale (see below)
```

`website/dist/`, the synced docs copies and the Astro cache are gitignored. The build is fully
offline: no fonts, scripts or translations are fetched at build or run time.

## Translations

Translations are produced by `website/scripts/translate.js` and **committed**, so the build never
needs an API key and every string can be reviewed in a pull request.

- Source units: each top-level key of `en.json`, the docs sidebar group labels, and each synced doc.
- `website/src/i18n/translation-manifest.json` stores the hash of the English text each translation
  came from. Only units whose English changed are re-sent, so a typo fix costs cents.
- Runs through the Claude Batch API (`claude-opus-5`, half price, usually done within an hour).
  `--sync` makes direct calls for a handful of units, `--dry-run` prints the pending work and the
  cost estimate, `--locales=ar,fr` and `--only=docs` narrow the run, `--resume=<id>` picks up a
  submitted batch.
- Every result is validated before it is written: identical JSON shape, same code fences, same link
  targets, same headings and front matter keys. A result that fails is reported and skipped; re-run
  to retry only those.
- A locale with no translation yet still renders: marketing pages fall back to English key by key
  and show a one-line notice; Starlight shows its own "not translated yet" notice on docs pages.

Workflow after editing English copy or a doc: commit the English change, run
`pnpm run site:translate`, review the diff, commit the translations.

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

## Adding a page, a locale, or a screenshot

- **Marketing page:** add `website/src/pages/[...locale]/<name>.astro` (copy an existing one), the
  route in `website/src/lib/routes.js`, its copy under `meta.<name>` and `nav.<name>` in `en.json`.
- **Locale:** one line in `website/src/i18n/locales.js` (`code`, native `label`, `dir`, optional
  BCP-47 `lang`). Then run the translator for it. If Press Start 2P cannot render the script, leave it
  out of `PIXEL_TITLE_LOCALES` in `routes.js` so titles fall back to the bold sans.
- **Screenshot:** drop the PNG in `docs/screenshots/` and register it in
  `website/src/data/screenshots.js` with a caption key in `en.json`.
- **Illustration:** add an entry to `IMAGES` in `website/scripts/gen-images.js`, run it, reference
  the id through `art('<id>')`.

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
