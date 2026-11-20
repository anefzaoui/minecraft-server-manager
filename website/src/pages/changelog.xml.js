// Atom feed of the releases in CHANGELOG.md, newest first, linked from every
// page's <head> and from /changelog/. Feed readers and search engines pick up a
// new version without anyone visiting the site.
import { releases, toHtml } from '../lib/changelog.js';
import { SITE_URL, REPO_URL } from '../lib/routes.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** First sentence of an entry, as plain text, for the feed summary. */
function summary(md) {
  const para = md.split(/\n{2,}/).find((b) => !/^(#|\s*[-*]\s)/.test(b)) || '';
  const plain = para
    .replace(/\s+/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`_]/g, '')
    .trim();
  return plain.match(/^.+?[.!?](?=\s|$)/)?.[0] || plain;
}

export function GET() {
  const all = releases();
  const page = `${SITE_URL}/changelog/`;
  const entries = all.map((r) => {
    const updated = `${r.date}T00:00:00Z`;
    return `  <entry>
    <title>Minecraft Server Manager ${esc(r.version)}</title>
    <id>${REPO_URL}/releases/tag/v${esc(r.version)}</id>
    <link rel="alternate" type="text/html" href="${page}#${r.anchor}"/>
    <published>${updated}</published>
    <updated>${updated}</updated>
    <summary>${esc(summary(r.markdown))}</summary>
    <content type="html">${esc(toHtml(r.markdown))}</content>
  </entry>`;
  });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <title>Minecraft Server Manager releases</title>
  <subtitle>Release notes for the free, self-hosted Minecraft server panel.</subtitle>
  <id>${SITE_URL}/changelog.xml</id>
  <link rel="self" type="application/atom+xml" href="${SITE_URL}/changelog.xml"/>
  <link rel="alternate" type="text/html" href="${page}"/>
  <updated>${all[0] ? `${all[0].date}T00:00:00Z` : '1970-01-01T00:00:00Z'}</updated>
  <author><name>Minecraft Server Manager</name><uri>${REPO_URL}</uri></author>
  <icon>${SITE_URL}/icon-192.png</icon>
${entries.join('\n')}
</feed>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
