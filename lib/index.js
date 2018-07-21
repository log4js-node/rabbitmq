'use strict';

const amqplib = require('amqplib');
const debug = require('debug')('log4js:rabbitmq');

function rabbitmqAppender(config, layout) {
  const host = config.host || '127.0.0.1';
  const port = config.port || 5672;
  const username = config.username || 'guest';
  const password = config.password || 'guest';
  const exchange = config.exchange || 'log';
  const type = config.mq_type || 'direct';
  const durable = config.durable || false;
  const routingKey = config.routing_key || 'logstash';
  const vhost = config.vhost || '/';
  const shutdownTimeout = config.shutdownTimeout || 10000;
  const con = {
    protocol: 'amqp',
    hostname: host,
    port: port,
    username: username,
    password: password,
    locale: 'en_US',
    frameMax: 0,
    heartbeat: 0,
    vhost: vhost,
    routing_key: routingKey,
    exchange: exchange,
    mq_type: type,
    durable: durable,
  };
  const messagesToSend = [];
  let promisesWaiting = 0;
  let waitingToConnect = true;
  let connection;

  debug('Connecting...');
  amqplib.connect(con).then((c) => {
    connection = c;
    waitingToConnect = false;
    debug('Connected.');
  }).catch((e) => {
    debug('connect failed.');
    waitingToConnect = false;
    console.error(e); // eslint-disable-line
  });

  const send = (messages) => {
    const rn = connection.createChannel().then((ch) => {
      const ok = ch.assertExchange(exchange, type, { durable: durable });
      return ok.then(() => {
        messages.forEach((message) => {
          debug('Sending message.');
          ch.publish(exchange, routingKey, Buffer.from(message));
        });
        messages.length = 0;
        return ch.close();
      });
    });
    promisesWaiting += 1;
    debug(`Promises waiting: ${promisesWaiting}`);
    rn.then(() => {
      promisesWaiting -= 1;
      debug(`Promise resolved. Waiting is now: ${promisesWaiting}`);
    });
  };

  const publish = (message) => {
    if (message) {
      messagesToSend.push(message);
      debug(`Added message to buffer. Buffer length: ${messagesToSend.length}`);
    }
    if (!waitingToConnect && connection) {
      debug('Sending buffer.');
      send(messagesToSend);
    }
  };

  const waitForPromises = (done) => {
    let howLongWaiting = 0;
    const checker = () => {
      howLongWaiting += 100;
      debug(`waitingToConnect? ${waitingToConnect}`);
      if (messagesToSend.length > 0) {
        debug('Messages to send.');
        publish();
      }
      if (howLongWaiting > shutdownTimeout) {
        debug(`Done waiting for promises. Waiting: ${promisesWaiting}`);
        if (connection) {
          connection.close().then(done);
          return;
        }
        done();
        return;
      }
      if (!waitingToConnect && connection) {
        if (messagesToSend.length > 0 || promisesWaiting > 0) {
          debug('Promises to wait for.');
          setTimeout(checker, 100);
          return;
        }
        connection.close().then(done);
        return;
      }
      debug('Nothing to wait for, shutdown now.');
      done();
    };
    setTimeout(checker, 100);
  };

  const appender = loggingEvent => publish(layout(loggingEvent));

  appender.shutdown = function (done) {
    debug('Appender shutdown.');
    debug(`waitingToConnect: ${waitingToConnect},
      messagesToSend: ${messagesToSend},
      promisesWaiting: ${promisesWaiting}`);
    if (promisesWaiting > 0 || messagesToSend.length > 0) {
      debug(`Things to do, will wait up to ${shutdownTimeout}ms.`);
      waitForPromises(done);
    } else {
      debug('Nothing to wait for, shutdown now.');
      done();
    }
  };
  return appender;
}

function configure(config, layouts) {
  let layout = layouts.messagePassThroughLayout;
  if (config.layout) {
    layout = layouts.layout(config.layout.type, config.layout);
  }

  return rabbitmqAppender(config, layout);
}

module.exports.configure = configure;
