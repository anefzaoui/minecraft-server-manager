'use strict';

// One-shot at-rest re-encryption, run once on boot.
//
// Values written before $DATA_DIR/.secret-key existed were encrypted under a
// SESSION_SECRET-derived key. secrets.decrypt() still opens them via the
// decrypt-only fallback, but a value stays bound to SESSION_SECRET until it is
// re-saved - so rotating SESSION_SECRET would lose every credential that was
// never rewritten, defeating the point of the dedicated key. This walks each
// store and rewrites anything still on the legacy key.

const path = require('node:path');
const db = require('../db');
const secrets = require('./secrets');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

// Every column that holds a secrets.encrypt() ciphertext.
const STORES = [
  { table: 'servers', idCol: 'id', cipherCol: 'rcon_password_cipher' },
  { table: 'users', idCol: 'id', cipherCol: 'totp_secret' },
  { table: 'api_keys', idCol: 'provider', cipherCol: 'key_cipher' },
  { table: 'integrations', idCol: 'rowid', cipherCol: 'config_cipher' },
];

function migrateLegacySecrets() {
  if (!secrets.hasLegacyFallback()) return; // no legacy key -> nothing to migrate

  let migrated = 0;
  for (const { table, idCol, cipherCol } of STORES) {
    let rows;
    try {
      rows = db.all(`SELECT ${idCol} AS id, ${cipherCol} AS cipher FROM ${table} WHERE ${cipherCol} IS NOT NULL`);
    } catch (err) {
      // A table this build doesn't have (yet) - skip quietly.
      logger.debug('Skipped a secret store during migration.', {
        table,
        err: serializeError(err, { includeStack: false }),
      });
      continue;
    }
    for (const r of rows) {
      let fresh;
      try {
        fresh = secrets.reEncryptIfLegacy(r.cipher);
      } catch {
        continue; // reEncryptIfLegacy is defensive, but never let one bad row stop the sweep
      }
      if (!fresh) continue;
      try {
        db.run(`UPDATE ${table} SET ${cipherCol} = ? WHERE ${idCol} = ?`, fresh, r.id);
        migrated += 1;
      } catch (err) {
        logger.warn('Could not rewrite a legacy-encrypted secret.', { table, err: serializeError(err) });
      }
    }
  }

  if (migrated) {
    logger.info('Re-encrypted stored secrets under the dedicated at-rest key.', { migrated });
  }
}

module.exports = { migrateLegacySecrets };
