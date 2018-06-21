export interface RabbitMQAppender {
        type: '@log4js-node/rabbitmq';
        // (defaults to 127.0.0.1) - the location of the redis server
        host?: string;
        // (defaults to 5672) - the port the redis server is listening on
        port?: number;
        // (defaults to guest)
        username?: string;
        // (defaults to guest) password to use when authenticating
        password?: string;
        // (defaults to '') the exchange to use
        exchange?: string;
        // (defaults to '') the mq type
        mq_type?: string;
        // (defaults to false) durability
        durable?: boolean;
        // (defaults to 'logstash' and I have no idea why) routing key
        routing_key?: string;
        // (defaults to messagePassThroughLayout) - the layout to use for log events.
        layout?: Layout;
}
