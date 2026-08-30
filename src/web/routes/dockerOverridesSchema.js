'use strict';

// Shared "Advanced Docker Settings" fields, spread into every request schema
// that can create or update a server (wizard, from-pack, from-mods, blueprint
// import, PATCH /api/servers/:id) so the 4 new knobs aren't redefined 5 times.
// Shape validation only - existence/collision checks run server-side in
// services/dockerSpec.js#validateOverrides, since those need async Docker/DB
// calls a zod schema can't make.

const { z } = require('zod');
const httpError = require('../../utils/httpError');

const dockerOverridesSchema = {
  // '' is accepted (and only meaningful in a PATCH) as "clear it, go back to msm-<id>".
  containerName: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .max(63)
        .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/),
    ])
    .optional(),
  networkName: z.string().trim().max(128).optional(),
  extraPorts: z
    .array(
      z.object({
        hostPort: z.coerce.number().int().min(1024).max(65535),
        containerPort: z.coerce.number().int().min(1).max(65535),
        protocol: z.enum(['tcp', 'udp']),
        label: z.string().trim().max(40).optional(),
      })
    )
    .max(20)
    .optional(),
  extraBinds: z
    .array(
      z.object({
        hostPath: z.string().trim().min(1).max(500),
        containerPath: z.string().trim().min(1).max(300),
        mode: z.enum(['rw', 'ro']).optional(),
      })
    )
    .max(20)
    .optional(),
};

/**
 * True when a request carries ANY of the 4 override fields - even to clear
 * them. Every entry point admin-gates on this: extra binds mount arbitrary
 * host paths into a container, which is host-root-equivalent, so operators
 * (who keep every other server control) must not reach these. The UI omits
 * untouched fields, so a non-admin request never trips this by accident.
 */
function overridesPresent(input) {
  return (
    input.containerName !== undefined ||
    input.networkName !== undefined ||
    input.extraPorts !== undefined ||
    input.extraBinds !== undefined
  );
}

/** Throw 403 unless override-carrying input comes from an admin. Call after zod parse at EVERY entry point. */
function requireAdminForOverrides(req, input) {
  if (overridesPresent(input) && req.user.role !== 'admin') {
    throw httpError(
      403,
      'Advanced Docker settings (container name, network, extra ports/binds) require the admin role.'
    );
  }
}

module.exports = { dockerOverridesSchema, overridesPresent, requireAdminForOverrides };
