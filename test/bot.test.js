const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Exercise the real command handlers without opening Telegram, HTTP, or DB
// connections. Keep Node's real EventEmitter behavior for conversation cleanup.
function loadBot(environment = {}) {
  let bot;
  const queries = [];
  const messages = [];
  const handlers = [];
  const dotenv = { config() {} };

  class TelegramBot extends EventEmitter {
    constructor() {
      super();
      bot = this;
    }

    onText(pattern, handler) {
      handlers.push({ pattern, handler });
    }

    sendMessage(chatId, text, options) {
      messages.push({ chatId, text, options });
      return Promise.resolve({ message_id: messages.length, chat: { id: chatId }, text });
    }

    async receive(text, userId = 42, chatId = 7) {
      const message = { message_id: 1, text, from: { id: userId }, chat: { id: chatId } };
      this.emit('message', message);
      for (const { pattern, handler } of handlers) {
        const match = pattern.exec(text);
        if (match) await handler(message, match);
      }
    }
  }

  class Client {
    connect(callback) {
      if (callback) callback(null);
      return Promise.resolve();
    }

    query(sql, parameters, callback) {
      queries.push({ sql, parameters: parameters ? Array.from(parameters) : undefined });
      const result = { command: 'INSERT', rowCount: 1, rows: [], fields: [] };
      if (callback) {
        callback(null, result);
        return undefined;
      }
      return Promise.resolve(result);
    }
  }

  const express = () => ({ use() {}, listen() {} });
  express.json = () => (_request, _response, next) => next();
  const helper = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../commands/functions.js'), 'utf8'), {
    exports: helper,
    require: () => dotenv,
  });
  const dependencies = {
    './commands/functions': helper,
    'node-telegram-bot-api': TelegramBot,
    express,
    'body-parser': { json: express.json },
    pg: { Client },
    dotenv,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8'), {
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: {
      BOT_TOKEN: 'your_test_bot_token',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'expenses',
      DB_USERNAME: 'expenses',
      DB_PASSWORD: 'your_test_database_password',
      ...environment,
    } },
    console: { log() {}, error() {} },
  });
  return { bot, messages, queries };
}

test('a completed transaction persists its fields and leaves unrelated messages alone', async () => {
  const { bot, messages, queries } = loadBot();
  let otherMessages = 0;
  bot.on('message', () => { otherMessages += 1; });
  for (const text of ['/add', 'spending', 'Еда', '24.50', 'weekly groceries']) {
    await bot.receive(text);
  }
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].parameters.slice(0, 4), ['spending', 'Еда', 24.5, 'weekly groceries']);
  assert.equal(queries[0].parameters[5], 42);
  assert.match(messages.at(-1).text, /successfully/i);
  const replyCount = messages.length;
  await bot.receive('an unrelated chat message');
  assert.equal(messages.length, replyCount);
  assert.equal(otherMessages, 6);
});

for (const command of ['/transactions', '/categories', '/delete Еда']) {
  test(`${command} permits the configured administrator`, async () => {
    const { bot, queries } = loadBot({ ADMIN_USER_ID: '42' });
    await bot.receive(command, 42);
    assert.equal(queries.length, 1);
  });

  test(`${command} denies another user`, async () => {
    const { bot, queries, messages } = loadBot({ ADMIN_USER_ID: '42' });
    await bot.receive(command, 99);
    assert.equal(queries.length, 0);
    assert.match(messages.at(-1).text, /permissions/i);
  });
}

test('administrator commands deny access when no administrator is configured', async () => {
  const { bot, queries } = loadBot();
  for (const command of ['/transactions', '/categories', '/delete Еда']) {
    await bot.receive(command);
  }
  assert.equal(queries.length, 0);
});
