'use strict';

const test = require('tap').test;
const sandbox = require('@log4js-node/sandboxed-module');
const appenderModule = require('../../lib');
const fakeAmqp = require('../fakeAmqpLib');
const debug = require('debug')('log4js:rabbitmq');

function setupLogging(options, error, fakeAmqpOptions) {
  const fakeRabbitmq = fakeAmqp(error, fakeAmqpOptions || {});
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
      console: fakeConsole,
      Buffer: Buffer
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
      protocol: 'amqps',
      host: '123.123.123.123',
      port: 1234,
      username: 'thing',
      password: 'secret',
      routing_key: 'something',
      exchange: 'exchange_logs',
      mq_type: 'some type',
      durable: true,
      vhost: '/pants',
      type: '@log4js-node/rabbitmq',
      layout: {
        type: 'pattern',
        pattern: 'cheese %m'
      }
    });

    result.logger('Log event #1');

    t.match(result.fakeRabbitmq.state.url, 'amqps://thing:secret@123.123.123.123:1234/pants');
    t.match(result.fakeRabbitmq.state.params, {
      protocol: 'amqps',
      hostname: '123.123.123.123',
      port: 1234,
      username: 'thing',
      password: 'secret',
      locale: 'en_US',
      frameMax: 0,
      heartbeat: 60,
      keepAliveDelay: 0,
      vhost: '/pants',
      routing_key: 'something',
      exchange: 'exchange_logs',
      mq_type: 'some type',
      durable: true,
      connection_timeout: 1000,
      layout: {
        type: 'pattern',
        pattern: 'cheese %m'
      }
    });

    result.appender.shutdown(() => {
      setTimeout(() => {
        t.equal(result.fakeRabbitmq.state.msgs.length, 1, 'should be one message only');
        t.equal(result.fakeRabbitmq.state.msgs[0].toString(), 'cheese %m');
        t.end();
      }, 202);
    });
  });

  batch.test('default values', (t) => {
    const setup = setupLogging({
      type: '@log4js-node/rabbitmq'
    });

    setup.logger('just testing');

    t.match(setup.fakeRabbitmq.state.url, 'amqp://guest:guest@127.0.0.1:5672/');
    t.match(setup.fakeRabbitmq.state.params, {
      protocol: 'amqp',
      hostname: '127.0.0.1',
      port: 5672,
      username: 'guest',
      password: 'guest',
      locale: 'en_US',
      frameMax: 0,
      heartbeat: 60,
      keepAliveDelay: 0,
      vhost: '/',
      routing_key: 'logstash',
      exchange: 'log',
      mq_type: 'direct',
      durable: false,
      connection_timeout: 1000,
      layout: {
        type: 'pattern',
        pattern: 'cheese %m'
      }
    });

    setup.appender.shutdown(() => {
      setTimeout(() => {
        debug('test/tap/index-test.js - setup.appender.shutdown((');
        t.equal(setup.fakeRabbitmq.state.msgs.length, 1);
        t.equal(setup.fakeRabbitmq.state.msgs[0].toString(), 'just testing');
        t.end();
      }, 202);
    });
  });

  batch.test('errors from rabbitmq connect should go to console', (t) => {
    const setup = setupLogging({ type: '@log4js-node/rabbitmq' }, new Error('oh no'));

    setTimeout(() => {
      t.equal(setup.fakeConsole.errors.length, 1);
      t.match(setup.fakeConsole.errors[0], /oh no/);
      t.end();
    }, 100);
  });

  batch.test('shutdown should close the rabbitmq connection', (t) => {
    const setup = setupLogging({ type: '@log4js-node/rabbitmq' });
    setup.logger('just a test');

    setup.appender.shutdown(() => {
      t.ok(setup.fakeRabbitmq.state.closed);
      t.end();
    });
  });

  batch.test('shutdown should wait up to shutdownTimeout for messages to be sent', (t) => {
    const setup = setupLogging({ type: '@log4js-node/rabbitmq', shutdownTimeout: 1000 }, null, { doNotConnect: true });
    setup.logger('test 1');

    const shutdownTime = Date.now();
    setup.appender.shutdown(() => {
      const timeWaiting = Date.now() - shutdownTime;
      t.ok(timeWaiting > 1000);
      t.ok(timeWaiting < 1100);
      t.end();
    });
  });

  batch.test('shutdown should only wait until promises have been resolved', (t) => {
    const setup = setupLogging(
      { type: '@log4js-node/rabbitmq', shutdownTimeout: 1000 },
      null,
      { doNotResolveMessages: true }
    );
    setup.logger('test 1');

    const shutdownTime = Date.now();
    setTimeout(() => {
      setup.fakeRabbitmq.resolveMessages();
    }, 200);
    setup.appender.shutdown(() => {
      const timeWaiting = Date.now() - shutdownTime;
      t.ok(timeWaiting > 200);
      t.ok(timeWaiting < 300);
      t.end();
    });
  });

  batch.test('shutdown should callback immediately if connection but no messages', (t) => {
    const setup = setupLogging({ type: '@log4js-node/rabbitmq', shutdownTimeout: 1000 });

    const shutdownTime = Date.now();
    setup.appender.shutdown(() => {
      const timeWaiting = Date.now() - shutdownTime;
      t.ok(timeWaiting < 100);
      t.end();
    });
  });

  batch.test('shutdown should callback immediately if no connection and no messages', (t) => {
    const setup = setupLogging(
      { type: '@log4js-node/rabbitmq', shutdownTimeout: 1000 },
      new Error('could not connect')
    );

    const shutdownTime = Date.now();
    setup.appender.shutdown(() => {
      const timeWaiting = Date.now() - shutdownTime;
      t.ok(timeWaiting < 100);
      t.end();
    });
  });

  batch.end();
});
