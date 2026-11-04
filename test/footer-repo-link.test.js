'use strict';

// The footer links to the project's repository, taken from package.json so a
// fork that changes "repository" links to itself.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');

let cookie;
test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});
test.after(() => app.stop());

test('the footer shows the version and a GitHub link to the repository', async () => {
  const pkg = require('../package.json');
  const r = await app.req('GET', '/', { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  const footer = r.text.slice(r.text.indexOf('<footer'), r.text.indexOf('</footer>'));
  assert.ok(footer.includes(`v${pkg.version}`));
  const href = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
  assert.match(href, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  assert.ok(footer.includes(`href="${href}"`), 'links the repository page, not the .git URL');
  assert.ok(footer.includes('rel="noopener noreferrer"'));
  assert.match(footer, />GitHub<\/a>/);
});
