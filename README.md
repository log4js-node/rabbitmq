# RabbitMQ Appender for Log4JS

Push log events to a [Rabbitmq](https://www.rabbitmq.com/) MQ. Require [log4js-node](https://github.com/log4js-node/log4js-node) 2.x or later.

```bash
npm install @log4js-node/rabbitmq
```

If you want to be sure that all messages have been sent before your programme exits, remember to call `log4js.shutdown(<callback function>)`.

## Configuration

* `type` - `@log4js-ndoe/rabbitmq`
* `protocol` - `string` (optional, defaults to `amqp`) - the port the rabbitmq protocol option: `amqps`
* `host` - `string` (optional, defaults to `127.0.0.1`) - the location of the rabbitmq server
* `port` - `integer` (optional, defaults to `5672`) - the port the rabbitmq server is listening on
* `username` - `string` (optional, defaults to `guest`) - username to use when authenticating connection to rabbitmq
* `password` - `string` (optional, defaults to `guest`) - password to use when authenticating connection to rabbitmq
* `routing_key` - `string` (optional, defaults to `logstash`) - rabbitmq message's routing_key
* `durable` - `string` (optional, defaults to false) - will that RabbitMQ lose our queue.
* `exchange` - `string` (optional, defaults to `log`)- rabbitmq send message's exchange
* `mq_type` - `string` (optional, defaults to `direct`) - rabbitmq message's mq_type
* `vhost` - `string` (optional, defaults to `/`) - vhost to use
* `layout` - `object` (optional, defaults to `messagePassThroughLayout`) - the layout to use for log events (see [layouts](layouts.md)).
* `shutdownTimeout` - `integer` (optional, defaults to `10000`) - maximum time in milliseconds to wait for messages to be sent during log4js shutdown.
* `frameMax` - `integer` (optional, defaults to `0`) - The size in bytes of the maximum frame allowed over the connection. 0 means no limit (but since frames have a size field which is an unsigned 32 bit integer, it’s perforce 2^32 - 1); I default it to 0x1000, i.e. 4kb, which is the allowed minimum, will fit many purposes, and not chug through Node.JS’s buffer pooling. [reference](https://www.squaremobius.net/amqp.node/channel_api.html)
* `heartbeat` - `integer` (optional, defaults to `0`) - The period of the connection heartbeat, in seconds. To learn more about the heartbeat option click [here](https://www.squaremobius.net/amqp.node/channel_api.html#heartbeating)
* `keepAliveDelay` - `integer` (optional, defaults to `0`) - time to send a keepAlive ping to avoid network killing quiet sockets. 

The appender will use the RabbitMQ Routing model command to send the log event messages to the channel.

## Example

```javascript
log4js.configure({
  appenders: {
    mq: {
      type: '@log4js-node/rabbitmq',
      host: '127.0.0.1',
      port: 5672,
      username: 'guest',
      password: 'guest',
      routing_key: 'logstash',
      exchange: 'exchange_logs',
      mq_type: 'direct',
      durable: true
    }
  },
  categories: { default: { appenders: ['mq'], level: 'info' } }
});
```

This configuration will push log messages to the rabbitmq on `127.0.0.1:5672`.
