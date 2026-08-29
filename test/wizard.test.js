'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const auth = require('../src/services/auth');
const wizard = require('../src/services/wizard');
const wizardPowers = require('../src/services/wizardPowers');

let adminCookie;
let operatorCookie;
let viewerCookie;
const serverId = 'srv_wizard01';

async function login(username, password, role) {
  auth.createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  await app.start();
  adminCookie = await app.adminCookie();
  operatorCookie = await login('wizardop', 'operatorpass123', 'operator');
  viewerCookie = await login('wizardviewer', 'viewerpass123', 'viewer');
  app.seedServer(serverId);
});

test.after(async () => {
  await app.stop();
});

test('chatbot configuration and transcripts are admin-only', async () => {
  for (const cookie of [viewerCookie, operatorCookie]) {
    assert.equal((await app.req('GET', `/api/servers/${serverId}/wizard`, { cookie })).status, 403);
    assert.equal((await app.req('GET', `/api/servers/${serverId}/wizard/transcripts`, { cookie })).status, 403);
    assert.equal((await app.req('GET', `/api/servers/${serverId}/wizard/powers/audit`, { cookie })).status, 403);
    assert.equal((await app.req('GET', '/wizard-transcripts', { cookie })).status, 403);
  }
  assert.equal((await app.req('GET', `/api/servers/${serverId}/wizard`, { cookie: adminCookie })).status, 200);
  assert.equal((await app.req('GET', '/wizard-transcripts', { cookie: adminCookie })).status, 200);

  const adminPage = await app.req('GET', `/servers/${serverId}/integrations`, { cookie: adminCookie });
  const operatorPage = await app.req('GET', `/servers/${serverId}/integrations`, { cookie: operatorCookie });
  assert.match(adminPage.text, /Chatbot settings/);
  assert.match(adminPage.text, /Basic users/);
  assert.match(adminPage.text, /Refresh this server's transcripts/);
  assert.match(adminPage.text, /Refresh power audit/);
  assert.match(adminPage.text, /Player outreach/);
  assert.match(adminPage.text, /@wizard chat/);
  assert.match(adminPage.text, /Power controllers/);
  const giftTextarea = /id="ig-wz-gifts">([\s\S]*?)<\/textarea>/.exec(adminPage.text);
  assert.ok(giftTextarea);
  assert.deepEqual(giftTextarea[1].replaceAll('&#10;', '\n').split('\n'), [
    'minecraft:bread',
    'minecraft:torch',
    'minecraft:arrow',
  ]);
  assert.doesNotMatch(operatorPage.text, /Chatbot settings/);
});

test('per-server config encrypts the API key and defaults retention to seven days', async () => {
  const initial = await app.req('GET', `/api/servers/${serverId}/wizard`, { cookie: adminCookie });
  assert.equal(initial.json.wizard.retentionDays, 7);
  assert.equal(initial.json.wizard.invocationName, 'wizard');
  assert.match(initial.json.wizard.systemPrompt, /ancient, playful wizard/);
  assert.equal(initial.json.wizard.welcomeEnabled, true);
  assert.equal(initial.json.wizard.checkinMinutes, 15);
  assert.equal(initial.json.wizard.conversationMinutes, 5);
  assert.equal(initial.json.wizard.powersEnabled, false);
  assert.equal(initial.json.wizard.powersDryRun, true);
  assert.deepEqual(initial.json.wizard.powerControllers, []);

  const saved = await app.req('POST', `/api/servers/${serverId}/wizard`, {
    cookie: adminCookie,
    body: {
      enabled: true,
      baseUrl: 'http://192.168.1.50:11434',
      model: 'llama3.2:latest',
      invocationName: 'bubba',
      apiKey: 'not-plaintext-in-db',
      systemPrompt: 'You are the test wizard.',
      retentionDays: 14,
      welcomeEnabled: true,
      welcomeMessage: 'Greetings {player}; I am {wizard}. Call {mention}.',
      checkinMinutes: 20,
      checkinMessage: '{player}, checking in after {minutes} minutes.',
      conversationMinutes: 7,
    },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.wizard.hasApiKey, true);
  assert.equal(Object.hasOwn(saved.json.wizard, 'apiKey'), false);
  const stored = db.get('SELECT * FROM wizard_configs WHERE server_id = ?', serverId);
  assert.notEqual(stored.api_key_cipher, 'not-plaintext-in-db');
  assert.equal(stored.invocation_name, 'bubba');
  assert.equal(stored.checkin_minutes, 20);
  assert.equal(saved.json.wizard.conversationMinutes, 7);
  assert.equal(wizard.getConfig(serverId, { includeSecret: true }).apiKey, 'not-plaintext-in-db');
});

test('power configuration is per-server, bounded, and admin-only', async () => {
  const saved = await app.req('POST', `/api/servers/${serverId}/wizard`, {
    cookie: adminCookie,
    body: {
      enabled: true,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen:test',
      invocationName: 'bubba',
      systemPrompt: 'Test wizard',
      retentionDays: 7,
      powersEnabled: true,
      powersDryRun: true,
      powerTesters: ['Gleep52'],
      powerControllers: ['Gleep52'],
      powerFlags: { heal: true, feed: true, spawn: true, time: false, weather: true, gift: true },
      giftItems: ['minecraft:bread', 'minecraft:torch'],
      giftMaxCount: 8,
      powerCooldownSec: 45,
    },
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.json.wizard.powerTesters, ['Gleep52']);
  assert.deepEqual(saved.json.wizard.powerControllers, ['Gleep52']);
  assert.deepEqual(saved.json.wizard.giftItems, ['minecraft:bread', 'minecraft:torch']);
  assert.equal(saved.json.wizard.giftMaxCount, 8);
  assert.equal(saved.json.wizard.powerFlags.time, false);

  const excessive = await app.req('POST', `/api/servers/${serverId}/wizard`, {
    cookie: adminCookie,
    body: {
      enabled: false,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen:test',
      systemPrompt: 'Test',
      retentionDays: 7,
      giftMaxCount: 17,
    },
  });
  assert.equal(excessive.status, 400);
});

test('power tools can only affect the caller and reject injected arguments', () => {
  const cfg = wizard.getConfig(serverId);
  const selfOnlyCfg = { ...cfg, powerControllers: [] };
  const tools = wizardPowers.toolsFor(selfOnlyCfg, 'Gleep52');
  assert.ok(tools.length > 0);
  assert.equal(wizardPowers.toolsFor(selfOnlyCfg, 'SomeoneElse').length, 0);
  const serialized = JSON.stringify(tools);
  assert.doesNotMatch(serialized, /target|selector|command|rcon/i);

  const gift = wizardPowers.parseToolCall(
    {
      tool_calls: [
        {
          id: 'call-1',
          function: { name: 'give_self', arguments: '{"item":"minecraft:bread","count":2}' },
        },
      ],
    },
    cfg,
    'Gleep52'
  );
  assert.deepEqual(gift.args, { item: 'minecraft:bread', count: 2 });
  const duplicate = wizardPowers.parseToolCall(
    {
      tool_calls: [
        { function: { name: 'give_self', arguments: '{"item":"minecraft:bread","count":2}' } },
        { function: { name: 'give_self', arguments: { item: 'minecraft:bread', count: 2 } } },
      ],
    },
    cfg,
    'Gleep52'
  );
  assert.deepEqual(duplicate.args, { item: 'minecraft:bread', count: 2 });
  assert.throws(
    () =>
      wizardPowers.parseToolCall(
        {
          tool_calls: [
            { function: { name: 'heal_self', arguments: '{}' } },
            { function: { name: 'give_self', arguments: '{"item":"minecraft:bread","count":1}' } },
          ],
        },
        cfg,
        'Gleep52'
      ),
    /more than one different power/
  );
  assert.throws(
    () =>
      wizardPowers.parseToolCall(
        {
          tool_calls: [
            {
              function: {
                name: 'give_self',
                arguments: '{"item":"minecraft:bread","count":2,"target":"NotTheCaller"}',
              },
            },
          ],
        },
        cfg,
        'Gleep52'
      ),
    /outside the allowlist/
  );
});

test('power controllers receive only bounded cross-player tools with exact targets', () => {
  const cfg = wizard.getConfig(serverId);
  const names = (prompt, override = cfg) =>
    wizardPowers.toolsFor(override, 'Gleep52', prompt).map((tool) => tool.function.name);
  assert.deepEqual(names('teleport @PlayerA to me'), ['teleport_player_to_self']);
  assert.deepEqual(names('teleport me to PlayerA'), ['teleport_self_to_player']);
  assert.deepEqual(names('heal PlayerA'), ['heal_player']);
  assert.deepEqual(names('feed PlayerA'), ['feed_player']);
  assert.deepEqual(names('give PlayerA four torches'), ['give_player']);

  const controllerOnly = { ...cfg, powerTesters: [] };
  assert.deepEqual(names('heal me', controllerOnly), []);
  assert.deepEqual(names('heal PlayerA', controllerOnly), ['heal_player']);
  assert.deepEqual(names('give PlayerA a red bed', { ...controllerOnly, giftItems: [] }), ['give_player']);

  const request = wizardPowers.parseToolCall(
    { tool_calls: [{ function: { name: 'teleport_player_to_self', arguments: '{"target":"@PlayerA"}' } }] },
    cfg,
    'Gleep52',
    'teleport @PlayerA to me'
  );
  assert.deepEqual(request.args, { target: 'PlayerA' });
  const gift = wizardPowers.parseToolCall(
    {
      tool_calls: [
        {
          function: {
            name: 'give_player',
            arguments: '{"target":"PlayerA","item":"minecraft:torch","count":4}',
          },
        },
      ],
    },
    cfg,
    'Gleep52',
    'give PlayerA four torches'
  );
  assert.deepEqual(gift.args, { target: 'PlayerA', item: 'minecraft:torch', count: 4 });
  const unrestrictedGift = wizardPowers.parseToolCall(
    {
      tool_calls: [
        {
          function: {
            name: 'give_player',
            arguments: '{"target":"PlayerA","item":"minecraft:diamond","count":4}',
          },
        },
      ],
    },
    cfg,
    'Gleep52',
    'give PlayerA four diamonds'
  );
  assert.deepEqual(unrestrictedGift.args, { target: 'PlayerA', item: 'minecraft:diamond', count: 4 });
  assert.throws(
    () =>
      wizardPowers.parseToolCall(
        {
          tool_calls: [
            {
              function: {
                name: 'give_player',
                arguments: '{"target":"PlayerA","item":"minecraft:diamond; op Gleep52","count":1}',
              },
            },
          ],
        },
        cfg,
        'Gleep52',
        'give PlayerA a diamond'
      ),
    /invalid target, item ID, or quantity/
  );
  assert.throws(
    () =>
      wizardPowers.parseToolCall(
        { tool_calls: [{ function: { name: 'teleport_player_to_self', arguments: '{"target":"@a"}' } }] },
        cfg,
        'Gleep52',
        'teleport @a to me'
      ),
    /selectors/
  );
  assert.throws(
    () =>
      wizardPowers.parseToolCall(
        { tool_calls: [{ function: { name: 'heal_player', arguments: '{"target":"Gleep52"}' } }] },
        cfg,
        'Gleep52',
        'heal Gleep52'
      ),
    /one other player/
  );
  assert.equal(wizardPowers.matchOnlineTarget('playera', ['Gleep52', 'PlayerA']), 'PlayerA');
  assert.throws(() => wizardPowers.matchOnlineTarget('PlayerB', ['PlayerA']), /not online/);
});

test('power intent requires an explicit action and keeps recipe questions conversational', () => {
  const cfg = wizard.getConfig(serverId);
  const names = (prompt) => wizardPowers.toolsFor(cfg, 'Gleep52', prompt).map((tool) => tool.function.name);
  assert.deepEqual(names('how do I craft myself a fishing pole using a crafting table?'), []);
  assert.deepEqual(names('what is the recipe for a torch?'), []);
  assert.deepEqual(names('how do I make it rain in Minecraft?'), []);
  assert.deepEqual(names('give me one torch please'), ['give_self']);
  assert.deepEqual(names('can I have a light?'), ['give_self']);
  assert.deepEqual(names('make it rain please'), ['set_weather']);
  assert.deepEqual(names('teleport me home'), ['teleport_self_to_spawn']);
  assert.deepEqual(names('teleport PlayerA to me'), ['teleport_player_to_self']);

  assert.throws(
    () =>
      wizardPowers.parseToolCall(
        {
          tool_calls: [{ function: { name: 'give_self', arguments: '{"item":"minecraft:torch","count":1}' } }],
        },
        cfg,
        'Gleep52',
        'how do I craft a torch?'
      ),
    /disabled or unavailable/
  );
});

test('eligible model requests receive only structured tools and unsupported models fall back to chat', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    if (requests.length === 1) {
      return new Response(JSON.stringify({ error: { message: 'tools are not supported' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Only conversation.' } }] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };
  try {
    const result = await wizard.completionMessage(serverId, 'Gleep52', 'Give me two pieces of bread.', {
      allowPowers: true,
    });
    assert.equal(result.message.content, 'Only conversation.');
    assert.ok(requests[0].tools.length > 0);
    assert.equal(Object.hasOwn(requests[1], 'tools'), false);
    assert.match(requests[1].messages[0].content, /No gameplay tools are available/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('dry-run powers write a complete audit event without executing RCON', async () => {
  const cfg = wizard.getConfig(serverId);
  await assert.rejects(
    wizardPowers.execute(serverId, 'Gleep52', { name: 'set_time', args: { value: 'day' } }, cfg),
    /disabled or unavailable/
  );
  const result = await wizardPowers.execute(serverId, 'Gleep52', { name: 'heal_self', args: {} }, cfg);
  assert.equal(result.dryRun, true);
  const immediateSecondDryRun = await wizardPowers.execute(serverId, 'Gleep52', { name: 'heal_self', args: {} }, cfg);
  assert.equal(immediateSecondDryRun.dryRun, true);
  const crossPlayer = await wizardPowers.execute(
    serverId,
    'Gleep52',
    { name: 'teleport_player_to_self', args: { target: 'PlayerA' } },
    cfg
  );
  assert.match(crossPlayer.message, /teleport PlayerA to Gleep52/);
  const audit = wizardPowers.listAudit(serverId, 10);
  assert.match(audit[0].summary, /Dry run: Gleep52 would teleport PlayerA to Gleep52/);
  assert.equal(audit[0].details.power, 'teleport_player_to_self');
  assert.equal(audit[0].details.caller, 'Gleep52');
  assert.equal(audit[0].details.target, 'PlayerA');
  assert.equal(audit[0].details.dryRun, true);
});

test('model discovery supports OpenAI-compatible model lists and free-text trigger parsing', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(String(url), 'http://127.0.0.1:11434/v1/models');
    return new Response(JSON.stringify({ data: [{ id: 'qwen:test' }, { id: 'llama:test' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    assert.deepEqual(await wizard.listModels(serverId, { baseUrl: 'http://127.0.0.1:11434', apiKey: '' }), [
      'llama:test',
      'qwen:test',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(wizard.TRIGGER_RE.test('ordinary player chat'), false);
  assert.equal(wizard.TRIGGER_RE.test('@wizard what mysteries await?'), true);
  assert.equal(wizard.invocationPattern('bubba').test('@wizard what mysteries await?'), false);
  assert.equal(wizard.invocationPattern('bubba').test('@BUBBA what mysteries await?'), true);
  assert.equal(wizard.assistantLabel('bubba'), 'Bubba');
});

test('conversational replies unwrap story envelopes and never end mid-word', () => {
  assert.equal(
    wizard.cleanReply('{"name":"tell_a_story","parameters":{"story":"Finley found a pearl and swam home."}}'),
    'Finley found a pearl and swam home.'
  );
  const long = wizard.cleanReply('Finley crossed the bright reef. '.repeat(30));
  assert.ok(long.length <= 350);
  assert.match(long, /\. …$/);
  assert.throws(() => wizard.cleanReply('{"name":"tell_a_story","parameters":{"length":300}}'), /tool-shaped response/);
});

test('invocation names reject ambiguous or unsafe values', async () => {
  for (const invocationName of ['two words', '@wizard', '9lives', 'wizard!']) {
    const res = await app.req('POST', `/api/servers/${serverId}/wizard`, {
      cookie: adminCookie,
      body: {
        enabled: false,
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen:test',
        invocationName,
        systemPrompt: 'Test',
        retentionDays: 7,
      },
    });
    assert.equal(res.status, 400, invocationName);
  }
});

test('join greetings and playtime check-ins send once per player session', async () => {
  wizard.saveConfig(serverId, {
    enabled: true,
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen:test',
    invocationName: 'bubba',
    systemPrompt: 'Test',
    retentionDays: 7,
    welcomeEnabled: true,
    welcomeMessage: 'Welcome {player}; I am {chatbot}. Use {mention}.',
    checkinMinutes: 15,
    checkinMessage: '{player}, it has been {minutes} minutes. Need help from {wizard}?',
    conversationMinutes: 5,
  });
  const sent = [];
  const send = async (id, cfg, target, text) => sent.push({ id, cfg, target, text });
  const joinedAt = '2026-08-28T12:00:00.000Z';
  assert.equal(await wizard.handleJoin(serverId, 'Gleep52', joinedAt, { send }), true);
  assert.equal(await wizard.handleJoin(serverId, 'Gleep52', joinedAt, { send }), false);
  assert.deepEqual(sent[0], {
    id: serverId,
    cfg: wizard.getConfig(serverId),
    target: '@a',
    text: 'Welcome Gleep52; I am Bubba. Use @bubba.',
  });
  assert.equal(
    wizard.renderOutreachMessage('Legacy name: {wizard}.', wizard.getConfig(serverId), 'Gleep52'),
    'Legacy name: Bubba.'
  );

  db.run('INSERT INTO player_sessions (server_id, player, started_at) VALUES (?, ?, ?)', serverId, 'Gleep52', joinedAt);
  const now = new Date('2026-08-28T12:16:00.000Z');
  assert.equal(await wizard.processCheckins({ now, send }), 1);
  assert.equal(await wizard.processCheckins({ now, send }), 0);
  assert.equal(sent[1].target, 'Gleep52');
  assert.equal(sent[1].text, 'Gleep52, it has been 15 minutes. Need help from Bubba?');
  db.run(
    'UPDATE player_sessions SET ended_at = ? WHERE server_id = ? AND ended_at IS NULL',
    now.toISOString(),
    serverId
  );
});

test('outreach timing is bounded by the admin-only API', async () => {
  const invalid = await app.req('POST', `/api/servers/${serverId}/wizard`, {
    cookie: adminCookie,
    body: {
      enabled: true,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen:test',
      systemPrompt: 'Test',
      retentionDays: 7,
      checkinMinutes: 1441,
      conversationMinutes: 61,
    },
  });
  assert.equal(invalid.status, 400);
});

test('conversation mode is explicitly opened, expires, and closes when the player leaves', async () => {
  assert.equal(wizard.conversationCommand('chat'), 'open');
  assert.equal(wizard.conversationCommand("let's talk"), 'open');
  assert.equal(wizard.conversationCommand('bye'), 'close');
  assert.equal(wizard.conversationCommand('how are you?'), null);
  const start = Date.parse('2026-08-28T12:00:00.000Z');
  assert.equal(wizard.conversationActive(serverId, 'Gleep52', start), false);
  wizard.openConversation(serverId, 'Gleep52', 5, start);
  assert.equal(wizard.conversationActive(serverId, 'Gleep52', start + 299_999), true);
  assert.equal(wizard.conversationActive(serverId, 'Gleep52', start + 300_000), false);
  wizard.openConversation(serverId, 'Gleep52', 5, start);
  wizard.handleLeave(serverId, 'Gleep52');
  assert.equal(wizard.conversationActive(serverId, 'Gleep52', start + 1), false);
});

test('retention pruning preserves recent rows and removes expired rows', () => {
  wizard.saveConfig(serverId, {
    enabled: false,
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen:test',
    systemPrompt: 'Test',
    retentionDays: 7,
  });
  db.run(
    "INSERT INTO wizard_transcripts (server_id, server_name, player, role, content, created_at) VALUES (?, 'Test', 'Alex', 'user', 'old', datetime('now', '-8 days'))",
    serverId
  );
  db.run(
    "INSERT INTO wizard_transcripts (server_id, server_name, player, role, content) VALUES (?, 'Test', 'Alex', 'assistant', 'recent')",
    serverId
  );
  wizard.pruneTranscripts(serverId);
  const rows = wizard.listTranscripts({ serverId });
  assert.equal(
    rows.some((r) => r.content === 'old'),
    false
  );
  assert.equal(
    rows.some((r) => r.content === 'recent'),
    true
  );
  assert.equal(rows.find((r) => r.content === 'recent').speaker, 'Bubba');
});

test('transcripts remain available after the server is soft-deleted', () => {
  db.run("UPDATE servers SET deleted_at = datetime('now') WHERE id = ?", serverId);
  const rows = wizard.listTranscripts({ serverId });
  assert.equal(
    rows.some((r) => r.content === 'recent'),
    true
  );
  db.run('UPDATE servers SET deleted_at = NULL WHERE id = ?', serverId);
});

test('link-local metadata endpoints are rejected while LAN endpoints are accepted', () => {
  assert.throws(() => wizard.normalizeBaseUrl('http://169.254.169.254/latest'), /not allowed/);
  assert.equal(wizard.normalizeBaseUrl('http://10.0.0.25:11434/'), 'http://10.0.0.25:11434');
});
