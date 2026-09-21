'use strict';

// deploy/install.sh, the one installer every host and provider deployment uses.
//
// The pure helpers are exercised here by sourcing the script in bash, which
// needs no Docker and runs anywhere the suite does. The end-to-end scenarios
// (a real filesystem, a mocked docker CLI, install / upgrade / uninstall) live
// in test/deploy/install-scenarios.sh, because they have to run on Linux:
// `pnpm run test:deploy` starts them in a container, and they run from here too
// when MSM_DEPLOY_E2E=1 is set.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');

const SCRIPT = path.join(__dirname, '..', 'deploy', 'install.sh');

/**
 * Single-quote a value for the shell. Double quotes would let bash expand `$HOME`
 * or run a `backtick` substitution before the function under test ever sees the
 * string, which is exactly what these tests check for.
 */
function q(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** Run a snippet with the installer sourced, and return its stdout. */
function sh(snippet) {
  return execFileSync('bash', ['-c', `source ${JSON.stringify(SCRIPT)}; ${snippet}`], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

/** Same, but for snippets expected to fail: returns { status, out }. */
function shStatus(snippet) {
  try {
    return { status: 0, out: sh(snippet) };
  } catch (err) {
    return { status: err.status ?? 1, out: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

test('the script is executable and passes a syntax check', () => {
  assert.ok(fs.statSync(SCRIPT).mode & 0o111, 'has the executable bit');
  execFileSync('bash', ['-n', SCRIPT]);
  const source = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(source, /^#!\/usr\/bin\/env bash/, 'starts with a portable shebang');
  assert.match(source, /set -euo pipefail/, 'fails fast rather than limping on');
});

test('sourcing the script runs nothing', () => {
  // The guard at the bottom is what lets this file test the pieces in isolation.
  const out = sh('printf "sourced-only"');
  assert.equal(out, 'sourced-only');
});

test('normalize_arch maps what uname reports onto the published images', () => {
  assert.equal(sh('normalize_arch x86_64'), 'amd64');
  assert.equal(sh('normalize_arch amd64'), 'amd64');
  assert.equal(sh('normalize_arch aarch64'), 'arm64');
  assert.equal(sh('normalize_arch arm64'), 'arm64');
  assert.equal(shStatus('normalize_arch armv7l').status, 1, 'refuses an architecture with no image');
  assert.equal(shStatus('normalize_arch i386').status, 1);
});

test('valid_port accepts real ports and nothing else', () => {
  for (const port of ['1', '80', '25564', '65535']) {
    assert.equal(shStatus(`valid_port ${q(port)}`).status, 0, `${port} is valid`);
  }
  for (const port of ['0', '65536', '-1', '25564x', 'abc', '', '12 34']) {
    assert.equal(shStatus(`valid_port ${q(port)}`).status, 1, `${port || '(empty)'} is refused`);
  }
});

test('valid_dir refuses paths that would be unsafe to write to or delete', () => {
  for (const dir of ['/opt/msm', '/srv/minecraft', '/home/user/msm']) {
    assert.equal(shStatus(`valid_dir ${q(dir)}`).status, 0, `${dir} is allowed`);
  }
  // Relative paths, the filesystem root, and anything the shell would reinterpret.
  for (const dir of ['/', 'relative/path', '', '/opt/my msm', '/opt/$HOME', '/opt/`id`', '/opt/"x"']) {
    assert.equal(shStatus(`valid_dir ${q(dir)}`).status, 1, `${dir || '(empty)'} is refused`);
  }
});

test('render_compose produces valid YAML that matches the flags', () => {
  const out = sh('render_compose ghcr.io/example/panel v1.2.3 127.0.0.1 8080');
  const doc = yaml.load(out);
  const panel = doc.services.panel;
  assert.equal(panel.image, 'ghcr.io/example/panel:v1.2.3');
  assert.equal(panel.container_name, 'minecraft-server-manager');
  assert.equal(panel.restart, 'unless-stopped');
  assert.deepEqual(panel.ports, ['127.0.0.1:8080:25564'], 'host side follows --bind and --port');
  assert.ok(panel.extra_hosts.includes('host.docker.internal:host-gateway'), 'live map fallback route');
  assert.ok(panel.volumes.includes('/var/run/docker.sock:/var/run/docker.sock'), 'the panel needs the host daemon');
  assert.ok(
    panel.volumes.some((v) => v.startsWith('${DATA_DIR_HOST}:')),
    'data comes from .env'
  );
  assert.match(String(panel.environment.DATA_DIR_HOST), /^\$\{DATA_DIR_HOST:\?/, 'unset DATA_DIR_HOST fails loudly');
});

test('render_compose keeps the container port fixed at what the image listens on', () => {
  // Only the host side is configurable: the panel inside the image is 25564.
  const doc = yaml.load(sh('render_compose img tag 0.0.0.0 9999'));
  assert.deepEqual(doc.services.panel.ports, ['0.0.0.0:9999:25564']);
});

test('render_env writes an absolute data path under the install directory', () => {
  const out = sh('render_env /opt/msm');
  assert.match(out, /^DATA_DIR_HOST=\/opt\/msm\/data$/m);
  assert.match(sh('render_env /srv/panel'), /^DATA_DIR_HOST=\/srv\/panel\/data$/m);
});

test('parse_args maps every flag, and a trailing slash on --dir is dropped', () => {
  const out = sh(
    'parse_args --dir /srv/msm/ --port 8080 --bind 127.0.0.1 --tag v0.14.0 --image example/panel ' +
      '--skip-docker --no-start --health-timeout 42 --yes; ' +
      'printf "%s|%s|%s|%s|%s|%s|%s|%s|%s" "$DIR" "$PORT" "$BIND" "$TAG" "$IMAGE" "$SKIP_DOCKER" "$NO_START" "$HEALTH_TIMEOUT" "$ASSUME_YES"'
  );
  assert.equal(out, '/srv/msm|8080|127.0.0.1|v0.14.0|example/panel|1|1|42|1');
});

test('parse_args understands the uninstall pair and rejects anything unknown', () => {
  assert.equal(sh('parse_args --uninstall --purge; printf "%s|%s" "$ACTION" "$PURGE"'), 'uninstall|1');
  const bad = shStatus('parse_args --wat');
  assert.equal(bad.status, 1);
  assert.match(bad.out, /unknown option '--wat'/);
  assert.match(bad.out, /--help lists them/);
});

test('environment variables set the same defaults as the flags', () => {
  const out = execFileSync(
    'bash',
    ['-c', `source ${JSON.stringify(SCRIPT)}; printf "%s|%s|%s" "$DIR" "$PORT" "$TAG"`],
    { encoding: 'utf8', env: { ...process.env, MSM_DIR: '/srv/x', MSM_PORT: '9', MSM_TAG: 'v1' } }
  );
  assert.equal(out, '/srv/x|9|v1');
});

test('--help documents every flag the parser accepts', () => {
  const help = sh('usage');
  for (const flag of [
    '--dir',
    '--port',
    '--bind',
    '--tag',
    '--image',
    '--skip-docker',
    '--no-start',
    '--health-timeout',
    '--uninstall',
    '--purge',
    '--yes',
    '--help',
  ]) {
    assert.ok(help.includes(flag), `${flag} is documented`);
  }
  const source = fs.readFileSync(SCRIPT, 'utf8');
  const parsed = [...source.matchAll(/^\s{6}(--[a-z-]+|-y \| --yes|-h \| --help)\)/gm)].map((m) => m[1]);
  assert.ok(parsed.length >= 12, `found ${parsed.length} parsed flags`);
  for (const entry of parsed) {
    const flag = entry.split(' | ').pop();
    assert.ok(help.includes(flag), `${flag} is parsed and documented`);
  }
});

test('the installer refuses to run on a machine it does not support', () => {
  const result = shStatus('uname() { printf "Darwin"; }; require_linux');
  assert.equal(result.status, 1);
  assert.match(result.out, /for Linux hosts/);
  assert.match(result.out, /run MSM from source/, 'points at the alternative');
  const arch = shStatus('uname() { printf "riscv64"; }; detect_arch');
  assert.equal(arch.status, 1);
  assert.match(arch.out, /unsupported architecture riscv64/);
});

// ---------------------------------------------------------------------------
// The full install / upgrade / uninstall scenarios need Linux and a fake docker
// on PATH. `pnpm run test:deploy` runs them in a container; this only reaches
// for them when asked, so the unit suite stays fast and Docker-free.

test('end-to-end scenarios', { skip: process.env.MSM_DEPLOY_E2E !== '1' }, () => {
  const out = execFileSync('bash', [path.join(__dirname, 'deploy', 'install-scenarios.sh')], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.match(out, /\d+ passed, 0 failed/);
});
