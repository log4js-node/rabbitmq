'use strict';

const amqplib = require('amqplib');
const debug = require('debug')('log4js:rabbitmq');

function rabbitmqAppender(config, layout) {
  const host = config.host || '127.0.0.1';
  const port = config.port || 5672;
  const protocol = config.protocol || 'amqp';
  const username = config.username || 'guest';
  const password = config.password || 'guest';
  const exchange = config.exchange || 'log';
  const type = config.mq_type || 'direct';
  const durable = config.durable || false;
  const routingKey = config.routing_key || 'logstash';
  const vhost = config.vhost || '/';
  const heartbeat = config.heartbeat || 60;
  const locale = config.locale || 'en_US';
  const frameMax = config.frameMax || 0;
  const keepAliveDelay = config.keepAliveDelay || 0;
  const connection_timeout = config.connection_timeout || 1000;
  const shutdownTimeout = config.shutdownTimeout || 10000;
  const con = {
    protocol: protocol,
    hostname: host,
    port: port,
    username: username,
    password: password,
    locale: locale,
    frameMax: frameMax,
    heartbeat: heartbeat,
    keepAliveDelay: keepAliveDelay,
    vhost: vhost,
    routing_key: routingKey,
    exchange: exchange,
    mq_type: type,
    durable: durable,
    connection_timeout: connection_timeout
  };
  
  const messagesToSend = [];
  let promisesWaiting = 0;
  let waitingToConnect = true;
  let connection;
  var establishConCounter = 0;

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
    if (!waitingToConnect && connection && messagesToSend.length > 0) {
      debug('Sending buffer.');
      send(messagesToSend);
    }
  };

  const closeConnection = (done) => {
    if (connection) {
      connection.close().then(done);
      return;
    }
    done();
  };

  const waiting = () => waitingToConnect || promisesWaiting > 0 || messagesToSend.length > 0;

  const waitForPromises = (done) => {
    let howLongWaiting = 0;
    const checker = () => {
      debug(`waitingToConnect? ${waitingToConnect}`);
      publish();
      if (howLongWaiting >= shutdownTimeout) {
        debug(`Done waiting for promises. Waiting: ${promisesWaiting}`);
        closeConnection(done);
        return;
      }
      if (waiting()) {
        debug('Things to wait for.');
        howLongWaiting += 50;
        setTimeout(checker, 50);
      } else {
        debug('Nothing to wait for, shutdown now.');
        closeConnection(done);
      }
    };
    checker();
  };

  function parseParamsURL(con) {

    var urlParse =  new URL(''+con.protocol + '://' + con.username + ':' + con.password + '@' + con.hostname + ':' + con.port + con.vhost);
    return urlParse.toString();
  }

  function establishConnection() {
    debug("establishConnection .... started count=" + ++establishConCounter);

    var url = ''+con.protocol + '://' + con.username + ':' + con.password + '@' + con.hostname + ':' + con.port + con.vhost;

    var socketOptions = con;
    var open = amqplib.connect(url,socketOptions).then((c) => {
      connection = c;

      waitingToConnect = false;
      debug('Connected.');
      publish();
    }).catch((e) => {
      debug('connection failed.');
      waitingToConnect = false;
      console.error(e); // eslint-disable-line
    });

    open.then(null, console.warn)
}

debug('Connecting... con=' + JSON.stringify(con));
establishConnection();

  const appender = loggingEvent => publish(layout(loggingEvent));

  appender.shutdown = function (done) {
    debug('Appender shutdown.');
    debug(`waitingToConnect: ${waitingToConnect},
      messagesToSend: ${messagesToSend},
      promisesWaiting: ${promisesWaiting}`);
    waitForPromises(done);
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