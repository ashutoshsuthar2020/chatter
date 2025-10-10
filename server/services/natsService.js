const { connect, StringCodec } = require('nats');
const logger = require('../logger');

class NatsService {
    constructor() {
        this.nc = null;
        this.sc = StringCodec();
        this.serverId = process.env.SERVER_ID || `server-${Date.now()}`;
        this.isConnected = false;
    }

    async connect() {
        try {
            const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
            this.nc = await connect({ servers: natsUrl });
            this.isConnected = true;
            logger.info('NATS connected successfully');
        } catch (error) {
            logger.error('Failed to connect to NATS: %s', error);
            this.isConnected = false;
        }
    }

    async publish(subject, message) {
        if (!this.isConnected) {
            logger.warn(`[NATS] Tried to publish to ${subject} but not connected.`);
            return false;
        }
        try {
            logger.info(`[NATS] Publishing to subject: ${subject}, message: ${JSON.stringify(message)}`);
            this.nc.publish(subject, this.sc.encode(JSON.stringify(message)));
            return true;
        } catch (error) {
            logger.error('Error publishing to NATS: %s', error);
            return false;
        }
    }

    async subscribe(subject, callback) {
        if (!this.isConnected) {
            logger.warn(`[NATS] Tried to subscribe to ${subject} but not connected.`);
            return false;
        }
        try {
            logger.info(`[NATS] Subscribing to subject: ${subject}`);
            const sub = this.nc.subscribe(subject);
            (async () => {
                for await (const msg of sub) {
                    const decoded = this.sc.decode(msg.data);
                    logger.info(`[NATS] Received message on subject: ${subject}, data: ${decoded}`);
                    callback(JSON.parse(decoded));
                }
            })();
            return true;
        } catch (error) {
            logger.error('Error subscribing to NATS: %s', error);
            return false;
        }
    }
}

module.exports = new NatsService();
