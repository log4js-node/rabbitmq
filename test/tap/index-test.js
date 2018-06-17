'use strict';

const test = require('tap').test;
const sandbox = require('@log4js-node/sandboxed-module');
const appenderModule = require('../../lib');

function setupLogging(category, options) {
  const fakeRabbitmq = {
    msgs: [],
    connect: function (conn) {
      this.port = conn.port;
      this.host = conn.hostname;
      this.username = conn.username;
      this.password = conn.password;
      this.routing_key = conn.routing_key;
      this.exchange = conn.exchange;
      this.mq_type = conn.mq_type;
      this.durable = conn.durable;
      return {
        publish: function (client, message) {
          fakeRabbitmq.msgs.push(message);
        }
      };
    }
  };

  const fakeConsole = {
    errors: [],
    error: function (msg) {
      this.errors.push(msg);
    }
  };

  const appender = sandbox.require('../../lib', {
    requires: {
      amqplib: fakeRabbitmq,
    },
    globals: {
      console: fakeConsole
    }
  }).configure(options, {
    layout: () => () => 'cheese %m',
    messagePassThroughLayout: evt => evt.data[0]
  });

  return {
    logger: msg => appender({ data: [msg] }),
    fakeRabbitmq: fakeRabbitmq,
    fakeConsole: fakeConsole
  };
}

test('log4js rabbitmqAppender', (batch) => {
  batch.test('should export a configure function', (t) => {
    t.type(appenderModule.configure, 'function');
    t.end();
  });

  batch.test('rabbitmq setup', (t) => {
    const result = setupLogging('rabbitmq setup', {
      host: '123.123.123.123',
      port: 5672,
      username: 'guest',
      password: 'guest',
      routing_key: 'logstash',
      exchange: 'exchange_logs',
      mq_type: 'direct',
      durable: true,
      type: '@log4js-node/rabbitmq',
      layout: {
        type: 'pattern',
        pattern: 'cheese %m'
      }
    });

    result.logger('Log event #1');

    t.test('rabbitmq credentials should match', (assert) => {
      assert.equal(result.fakeRabbitmq.host, '123.123.123.123');
      assert.equal(result.fakeRabbitmq.port, 5672);
      assert.equal(result.fakeRabbitmq.username, 'guest');
      assert.equal(result.fakeRabbitmq.password, 'guest');
      assert.equal(result.fakeRabbitmq.routing_key, 'logstash');
      assert.equal(result.fakeRabbitmq.exchange, 'exchange_logs');
      assert.equal(result.fakeRabbitmq.mq_type, 'direct');
      assert.equal(result.fakeRabbitmq.durable, true);
      assert.equal(result.fakeRabbitmq.msgs.length, 1, 'should be one message only');
      assert.equal(result.fakeRabbitmq.msgs[0], 'cheese %m');
      assert.end();
    });

    t.end();
  });

  batch.test('default values', (t) => {
    const setup = setupLogging('defaults', {
      type: '@log4js-node/rabbitmq'
    });

    setup.logger('just testing');

    t.test('should use localhost', (assert) => {
      assert.equal(setup.fakeRabbitmq.host, '127.0.0.1');
      assert.equal(setup.fakeRabbitmq.port, 5672);
      assert.equal(setup.fakeRabbitmq.username, 'guest');
      assert.equal(setup.fakeRabbitmq.password, 'guest');
      assert.equal(setup.fakeRabbitmq.exchange, '');
      assert.equal(setup.fakeRabbitmq.mq_type, '');
      assert.equal(setup.fakeRabbitmq.durable, false);
      assert.equal(setup.fakeRabbitmq.routing_key, 'logstash');
      assert.end();
    });

    t.test('should use message pass through layout', (assert) => {
      assert.equal(setup.fakeRabbitmq.msgs.length, 1);
      assert.equal(setup.fakeRabbitmq.msgs[0], 'just testing');
      assert.end();
    });

    t.end();
  });

  batch.end();
});
