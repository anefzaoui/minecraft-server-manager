'use strict';

// Advanced Docker settings: YAML round-trip for the "Preview as YAML" editor,
// and the authoritative server-side validation for the 4 editable knobs
// (container name, network, extra ports, extra volume binds). Never requires
// ./servers - servers.js requires this module, and a cycle would break it.

const path = require('node:path');
const yaml = require('js-yaml');
const httpError = require('../utils/httpError');
const { isPortFree } = require('./ports');
const networks = require('../docker/networks');

const HEADER =
  '# Advanced Docker settings.\n' +
  '# Only these fields are read back when you Apply: containerName, network,\n' +
  '# ports.extra, volumes.extra. Everything else here (image, standard ports,\n' +
  '# resources, env) is read-only context - edit it from the other wizard/\n' +
  '# settings sections instead.\n\n';

function toYaml(spec) {
  return HEADER + yaml.dump(spec, { noRefs: true, lineWidth: 100 });
}

/** Parse edited YAML back into just the 4 editable override fields. */
function fromYaml(text) {
  let obj;
  try {
    obj = yaml.load(text);
  } catch (err) {
    throw httpError(400, `Invalid YAML: ${err.message}`);
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw httpError(400, 'Invalid YAML: expected a mapping at the top level');
  }
  return {
    containerName: obj.containerName || null,
    networkName: obj.network || null,
    extraPorts: (obj.ports && Array.isArray(obj.ports.extra) ? obj.ports.extra : []).map((p) => ({
      hostPort: Number(p.hostPort),
      containerPort: Number(p.containerPort),
      protocol: p.protocol,
      label: p.label || undefined,
    })),
    extraBinds: (obj.volumes && Array.isArray(obj.volumes.extra) ? obj.volumes.extra : []).map((b) => ({
      hostPath: b.hostPath,
      containerPath: b.containerPath,
      mode: b.mode || 'rw',
    })),
  };
}

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;

/**
 * Authoritative validation for the 4 override fields - must be run on every
 * path that can persist them (creation, and the Settings-tab PATCH), even
 * when the values came from a server-generated preview: the user can type
 * anything into the YAML textarea before Apply.
 *
 * `previousExtraPorts` lets an update skip the free-port probe for ports the
 * server already legitimately holds (its own running container has them
 * bound, so isPortFree would otherwise - wrongly - report a collision).
 */
async function validateOverrides(
  { containerName, networkName, extraPorts = [], extraBinds = [] },
  { previousExtraPorts = [] } = {}
) {
  const errors = [];

  if (containerName != null && !NAME_RE.test(containerName)) {
    errors.push(
      `Container name "${containerName}" is invalid - use letters, digits, "_", ".", "-", starting with a letter or digit, up to 63 characters.`
    );
  }
  // getContainer() resolves servers WITHOUT a custom name as msm-<id> - a
  // custom name in that namespace could shadow another server's container and
  // route every lifecycle action (stop, kill, exec…) to the wrong instance.
  if (containerName != null && /^msm-/i.test(containerName)) {
    errors.push(
      `Container name "${containerName}" is reserved - the "msm-" prefix is used for the panel's own naming.`
    );
  }

  if (networkName) {
    const exists = await networks.networkExists(networkName);
    if (!exists) errors.push(`Docker network "${networkName}" does not exist.`);
  }

  const previousHostPorts = new Set((previousExtraPorts || []).map((p) => p.hostPort));
  const seenPorts = new Set();
  for (const p of extraPorts || []) {
    const hostPort = Number(p.hostPort);
    const containerPort = Number(p.containerPort);
    if (!Number.isInteger(hostPort) || hostPort < 1024 || hostPort > 65535) {
      errors.push(`Extra port mapping has an invalid host port: ${p.hostPort}`);
      continue;
    }
    if (!Number.isInteger(containerPort) || containerPort < 1 || containerPort > 65535) {
      errors.push(`Extra port mapping has an invalid container port: ${p.containerPort}`);
      continue;
    }
    if (!['tcp', 'udp'].includes(p.protocol)) {
      errors.push(`Extra port mapping protocol must be "tcp" or "udp", got "${p.protocol}"`);
      continue;
    }
    if (seenPorts.has(hostPort)) {
      errors.push(`Host port ${hostPort} is used by more than one extra port mapping.`);
      continue;
    }
    seenPorts.add(hostPort);
    if (previousHostPorts.has(hostPort)) continue; // unchanged from this server's own current config
    if (!(await isPortFree(hostPort))) errors.push(`Host port ${hostPort} is already in use.`);
  }

  for (const b of extraBinds || []) {
    if (!b.hostPath || typeof b.hostPath !== 'string' || b.hostPath.includes('\0') || !path.isAbsolute(b.hostPath)) {
      errors.push(`Extra volume bind has an invalid host path: "${b.hostPath || ''}" - must be an absolute path.`);
    }
    if (
      !b.containerPath ||
      typeof b.containerPath !== 'string' ||
      b.containerPath.includes('\0') ||
      !b.containerPath.startsWith('/')
    ) {
      errors.push(
        `Extra volume bind has an invalid container path: "${b.containerPath || ''}" - must be an absolute path.`
      );
    }
    if (b.mode && !['rw', 'ro'].includes(b.mode)) {
      errors.push(`Extra volume bind mode must be "rw" or "ro", got "${b.mode}"`);
    }
  }

  if (errors.length) throw httpError(400, errors.join(' '));
}

module.exports = { toYaml, fromYaml, validateOverrides };
