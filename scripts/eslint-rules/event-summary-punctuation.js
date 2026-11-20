'use strict';

// House style: every history summary written through recordEvent() is a
// sentence and ends in ".", "!", "?" or "…" (CONTRIBUTING.md, user-facing
// copy). The rule follows the ways a summary is built in this codebase -
// string and template literals, a ternary between two of them, a trailing
// "+" - and reports any ending it can see that lacks the punctuation. A
// summary that ends in an interpolated variable it cannot follow is left
// alone rather than guessed at.

const PUNCT = /[.!?…]["')\]]*$/;

/** Every literal text the expression can end with, or null when unknowable. */
function endings(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
  if (node.type === 'TemplateLiteral') {
    const tail = node.quasis[node.quasis.length - 1].value.cooked;
    if (tail) return [tail];
    return node.expressions.length ? endings(node.expressions[node.expressions.length - 1]) : [''];
  }
  if (node.type === 'ConditionalExpression') {
    const a = endings(node.consequent);
    const b = endings(node.alternate);
    return a && b ? [...a, ...b] : null;
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') return endings(node.right);
  return null;
}

function isRecordEvent(callee) {
  if (callee.type === 'Identifier') return callee.name === 'recordEvent';
  return callee.type === 'MemberExpression' && !callee.computed && callee.property.name === 'recordEvent';
}

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'History summaries passed to recordEvent() end in sentence punctuation.' },
    schema: [],
    messages: {
      missing: 'A recordEvent summary must end in ".", "!", "?" or "…" (this one can end with {{ending}}).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const arg = node.arguments[0];
        if (!isRecordEvent(node.callee) || !arg || arg.type !== 'ObjectExpression') return;
        for (const prop of arg.properties) {
          if (prop.type !== 'Property' || prop.computed) continue;
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
          if (key !== 'summary') continue;
          const bad = (endings(prop.value) || []).find((e) => !PUNCT.test(e));
          if (bad !== undefined) {
            context.report({
              node: prop.value,
              messageId: 'missing',
              data: { ending: JSON.stringify(bad.slice(-24)) },
            });
          }
        }
      },
    };
  },
};
