'use strict';

// The lint rule that keeps every history summary a punctuated sentence. It has
// to catch each way a summary is built here, and stay quiet on the endings it
// cannot see (a summary that ends in a variable).

const test = require('node:test');
const { RuleTester } = require('eslint');
const rule = require('../scripts/eslint-rules/event-summary-punctuation');

RuleTester.describe = (name, fn) => fn();
RuleTester.it = (name, fn) => test(name, fn);
RuleTester.itOnly = RuleTester.it;

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs' } });

tester.run('event-summary-punctuation', rule, {
  valid: [
    "recordEvent({ type: 'x', summary: 'Server started.' })",
    "recordEvent({ summary: 'Is it running?' })",
    "recordEvent({ summary: 'Done!' })",
    "recordEvent({ summary: 'Restoring backup…' })",
    'recordEvent({ summary: `Folder created: ${name}.` })',
    "recordEvent({ summary: on ? 'Turned on.' : 'Turned off.' })",
    "recordEvent({ summary: 'Pack upgraded to ' + name + '.' })",
    'recordEvent({ summary: `Server crashed: ${diag.summary}` })', // ends in a value it can't see
    'recordEvent({ summary: `Folder created: ${name}` })', // same shape: a value, so not guessed at
    'recordEvent({ summary })',
    "events.recordEvent({ summary: 'Backup created.' })",
    "somethingElse({ summary: 'no period' })",
  ],
  invalid: [
    { code: "recordEvent({ summary: 'Server started' })", errors: [{ messageId: 'missing' }] },
    { code: 'recordEvent({ summary: `Folder created: ${name} ok` })', errors: [{ messageId: 'missing' }] },
    { code: "recordEvent({ summary: on ? 'Turned on.' : 'Turned off' })", errors: [{ messageId: 'missing' }] },
    {
      code: "recordEvent({ summary: `Configuration changed: ${keys}${rebuild ? ' (rebuild required)' : ''}` })",
      errors: [{ messageId: 'missing' }],
    },
    { code: "events.recordEvent({ summary: 'Backup created' })", errors: [{ messageId: 'missing' }] },
  ],
});
