'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'data/', 'data-*/', 'public/css/', 'docker-minecraft-server/', 'discovery/'] },
  js.configs.recommended,
  {
    // Node.js server code + build/QA scripts + tests (CommonJS).
    files: ['src/**/*.js', 'scripts/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Errors, not warnings - problems fail the build honestly instead of being
      // promoted by a --max-warnings flag. `_`-prefixed and rest-sibling
      // (destructure-to-omit) vars are the standard "intentionally unused" opt-out;
      // `next` is Express's error-forwarding param that asyncHandler drives.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_|^next$', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Off (not lazily): several input-sanitization regexes match control chars
      // on purpose; enabling this would force noise-only disable comments on each.
      'no-control-regex': 'off',
      'no-useless-escape': 'error',
    },
  },
  {
    // Shipped server code must go through src/logger.js - no stray console.* in
    // request/boot/background paths where it would bypass structured logging.
    files: ['src/**/*.js'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    // These three run before the logger is usable: preflight runs before
    // anything (writes straight to stderr), instrument loads before config, and
    // config/index.js prints its first-run secret notice before the logger
    // exists. They are allowed console/stdout/stderr.
    files: ['src/preflight.js', 'src/instrument.js', 'src/config/index.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Browser client code (ES modules).
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Intentional: ANSI/control-char handling in console + MOTD rendering.
      'no-control-regex': 'off',
    },
  },
];
