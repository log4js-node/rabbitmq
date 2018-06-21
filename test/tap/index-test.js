'use strict';

const assert = require('assert');
const test = require('tap').test;
const sandbox = require('@log4js-node/sandboxed-module');
const appenderModule = require('../../lib');

function setupLogging(options, error) {
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
        then: (cb) => {
          cb({
            createChannel: () => ({
              then: (callback) => {
                callback({
                  assertExchange: (exch, type, opts) => ({
                    then: (cb2) => {
                      assert.strictEqual(exch, conn.exchange);
                      assert.strictEqual(type, conn.mq_type);
                      assert.strictEqual(opts.durable, conn.durable);
                      cb2();
                    }
                  }),
                  publish: (exch, key, msg) => {
                    fakeRabbitmq.msgs.push(msg);
                  },
                  close: () => {}
                });
              }
            })
          });
          return { catch: (cb3) => { if (error) cb3(error); } };
        },
        close: () => {
          fakeRabbitmq.closed = true;
          return {
            then: (cb) => {
              cb();
            }
          };
        }
      };
    }
  };

  const fakeConsole = {
    errors: [],
    error: function (msg) {
      fakeConsole.errors.push(msg);
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
    appender: appender,
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
    const result = setupLogging({
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

    t.equal(result.fakeRabbitmq.host, '123.123.123.123');
    t.equal(result.fakeRabbitmq.port, 5672);
    t.equal(result.fakeRabbitmq.username, 'guest');
    t.equal(result.fakeRabbitmq.password, 'guest');
    t.equal(result.fakeRabbitmq.routing_key, 'logstash');
    t.equal(result.fakeRabbitmq.exchange, 'exchange_logs');
    t.equal(result.fakeRabbitmq.mq_type, 'direct');
    t.equal(result.fakeRabbitmq.durable, true);
    t.equal(result.fakeRabbitmq.msgs.length, 1, 'should be one message only');
    t.equal(result.fakeRabbitmq.msgs[0].toString(), 'cheese %m');
    t.end();
  });

  batch.test('default values', (t) => {
    const setup = setupLogging({
      type: '@log4js-node/rabbitmq'
    });

    setup.logger('just testing');

    t.equal(setup.fakeRabbitmq.host, '127.0.0.1');
    t.equal(setup.fakeRabbitmq.port, 5672);
    t.equal(setup.fakeRabbitmq.username, 'guest');
    t.equal(setup.fakeRabbitmq.password, 'guest');
    t.equal(setup.fakeRabbitmq.exchange, '');
    t.equal(setup.fakeRabbitmq.mq_type, '');
    t.equal(setup.fakeRabbitmq.durable, false);
    t.equal(setup.fakeRabbitmq.routing_key, 'logstash');

    t.equal(setup.fakeRabbitmq.msgs.length, 1);
    t.equal(setup.fakeRabbitmq.msgs[0].toString(), 'just testing');

    t.end();
  });

  batch.test('errors from rabbitmq should go to console', (t) => {
    const setup = setupLogging({ type: '@log4js-node/rabbitmq' }, new Error('oh no'));
    setup.logger('just testing');

    t.equal(setup.fakeConsole.errors.length, 1);
    t.match(setup.fakeConsole.errors[0], /oh no/);
    t.end();
  });

  batch.test('shutdown should close the rabbitmq connection', (t) => {
    const setup = setupLogging({ type: '@log4js-node/rabbitmq' });
    setup.logger('just a test');

    setup.appender.shutdown(() => {
      t.ok(setup.fakeRabbitmq.closed);
      t.end();
    });
  });

  batch.end();
});
