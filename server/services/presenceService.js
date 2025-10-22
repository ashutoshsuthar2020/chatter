const Redis = require('ioredis');
const { connect, StringCodec, JSONCodec } = require('nats');
const logger = require('../logger');

class PresenceService {
    constructor() {
        this.redis = null;
        this.nats = null;
        this.sc = StringCodec();
        this.jc = JSONCodec();
        this.PRESENCE_TTL = 60; // 60 seconds TTL for presence
        this.HEARTBEAT_INTERVAL = 30; // 30 seconds heartbeat interval
    }

    async initialize() {
        try {
            // Initialize Redis connection
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            this.redis = new Redis(redisUrl, {
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3
            });

            this.redis.on('connect', () => {
                logger.info('PresenceService: Connected to Redis');
            });

            this.redis.on('error', (err) => {
                logger.error('PresenceService: Redis error:', err);
            });

            // Initialize NATS connection
            this.nats = await connect({
                servers: process.env.NATS_URL || 'nats://localhost:4222'
            });

            logger.info('PresenceService: Connected to NATS');

            // Subscribe to presence events
            await this.subscribeToPresenceEvents();

            logger.info('PresenceService: Initialized successfully');
        } catch (error) {
            logger.error('PresenceService: Failed to initialize:', error);
            throw error;
        }
    }

    async subscribeToPresenceEvents() {
        // Subscribe to heartbeat events
        const heartbeatSub = this.nats.subscribe('presence.heartbeat');
        (async () => {
            for await (const msg of heartbeatSub) {
                try {
                    const data = this.jc.decode(msg.data);
                    await this.handleHeartbeat(data);
                } catch (error) {
                    logger.error('PresenceService: Error handling heartbeat:', error);
                }
            }
        })();

        // Subscribe to connection events
        const connectSub = this.nats.subscribe('presence.connect');
        (async () => {
            for await (const msg of connectSub) {
                try {
                    const data = this.jc.decode(msg.data);
                    await this.handleUserConnect(data);
                } catch (error) {
                    logger.error('PresenceService: Error handling connect:', error);
                }
            }
        })();

        // Subscribe to disconnect events
        const disconnectSub = this.nats.subscribe('presence.disconnect');
        (async () => {
            for await (const msg of disconnectSub) {
                try {
                    const data = this.jc.decode(msg.data);
                    await this.handleUserDisconnect(data);
                } catch (error) {
                    logger.error('PresenceService: Error handling disconnect:', error);
                }
            }
        })();

        logger.info('PresenceService: Subscribed to presence events');
    }

    /**
     * Handle user connection
     * @param {Object} data - { userId, connId, metadata }
     */
    async handleUserConnect(data) {
        const { userId, connId, metadata = {} } = data;

        try {
            const now = Date.now();
            const connectionKey = `connections:${userId}`;
            const presenceKey = `presence:${userId}`;

            // Add connection to user's connection set
            await this.redis.hset(connectionKey, connId, JSON.stringify({
                connectedAt: now,
                lastSeen: now,
                metadata
            }));

            // Set TTL on connection
            await this.redis.expire(connectionKey, this.PRESENCE_TTL);

            // Update presence status
            const presenceData = {
                status: 'online',
                lastSeen: now,
                activeConnections: await this.redis.hlen(connectionKey),
                metadata
            };

            await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presenceData));

            // Check if this is the first connection (user going online)
            const connectionCount = await this.redis.hlen(connectionKey);
            const wasOffline = connectionCount === 1;

            if (wasOffline) {
                // Publish user_online event
                await this.publishPresenceEvent('user_online', {
                    userId,
                    timestamp: now,
                    metadata
                });
            }

            logger.info(`PresenceService: User ${userId} connected (connId: ${connId}, active connections: ${connectionCount})`);
        } catch (error) {
            logger.error('PresenceService: Error handling user connect:', error);
        }
    }

    /**
     * Handle user disconnection
     * @param {Object} data - { userId, connId }
     */
    async handleUserDisconnect(data) {
        const { userId, connId } = data;

        try {
            const now = Date.now();
            const connectionKey = `connections:${userId}`;
            const presenceKey = `presence:${userId}`;

            // Remove specific connection
            await this.redis.hdel(connectionKey, connId);

            // Check remaining connections
            const remainingConnections = await this.redis.hlen(connectionKey);

            if (remainingConnections === 0) {
                // User is completely offline
                const presenceData = {
                    status: 'offline',
                    lastSeen: now,
                    activeConnections: 0
                };

                await this.redis.setex(presenceKey, this.PRESENCE_TTL * 10, JSON.stringify(presenceData)); // Keep offline status longer

                // Publish user_offline event
                await this.publishPresenceEvent('user_offline', {
                    userId,
                    timestamp: now
                });

                // Clean up connection key
                await this.redis.del(connectionKey);
            } else {
                // Update presence with remaining connections
                const presenceData = {
                    status: 'online',
                    lastSeen: now,
                    activeConnections: remainingConnections
                };

                await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presenceData));
            }

            logger.info(`PresenceService: User ${userId} disconnected (connId: ${connId}, remaining connections: ${remainingConnections})`);
        } catch (error) {
            logger.error('PresenceService: Error handling user disconnect:', error);
        }
    }

    /**
     * Handle heartbeat to refresh TTL
     * @param {Object} data - { userId, connId }
     */
    async handleHeartbeat(data) {
        const { userId, connId } = data;

        try {
            const now = Date.now();
            const connectionKey = `connections:${userId}`;
            const presenceKey = `presence:${userId}`;

            // Check if connection exists
            const connectionExists = await this.redis.hexists(connectionKey, connId);

            if (connectionExists) {
                // Update connection last seen
                const connectionData = JSON.parse(await this.redis.hget(connectionKey, connId) || '{}');
                connectionData.lastSeen = now;
                await this.redis.hset(connectionKey, connId, JSON.stringify(connectionData));

                // Refresh TTL on connection key
                await this.redis.expire(connectionKey, this.PRESENCE_TTL);

                // Update presence last seen and refresh TTL
                const presenceData = JSON.parse(await this.redis.get(presenceKey) || '{}');
                presenceData.lastSeen = now;
                await this.redis.setex(presenceKey, this.PRESENCE_TTL, JSON.stringify(presenceData));

                logger.debug(`PresenceService: Heartbeat from user ${userId} (connId: ${connId})`);
            } else {
                logger.warn(`PresenceService: Heartbeat from unknown connection ${connId} for user ${userId}`);
                // Could trigger a reconnection here
            }
        } catch (error) {
            logger.error('PresenceService: Error handling heartbeat:', error);
        }
    }

    /**
     * Publish presence event to NATS
     * @param {string} eventType - 'user_online' or 'user_offline'
     * @param {Object} data - Event payload
     */
    async publishPresenceEvent(eventType, data) {
        try {
            const event = {
                type: eventType,
                ...data
            };

            await this.nats.publish(`presence.events.${eventType}`, this.jc.encode(event));

            // Also publish to general presence events channel
            await this.nats.publish('presence.events', this.jc.encode(event));

            logger.debug(`PresenceService: Published ${eventType} event for user ${data.userId}`);
        } catch (error) {
            logger.error('PresenceService: Error publishing presence event:', error);
        }
    }

    /**
     * Check if a user is currently online
     * @param {string} userId 
     * @returns {Promise<boolean>}
     */
    async isUserOnline(userId) {
        try {
            const presenceKey = `presence:${userId}`;
            const presenceData = await this.redis.get(presenceKey);

            if (!presenceData) return false;

            const presence = JSON.parse(presenceData);
            return presence.status === 'online' && presence.activeConnections > 0;
        } catch (error) {
            logger.error('PresenceService: Error checking user online status:', error);
            return false;
        }
    }

    /**
     * Get user presence information
     * @param {string} userId 
     * @returns {Promise<Object|null>}
     */
    async getUserPresence(userId) {
        try {
            const presenceKey = `presence:${userId}`;
            const presenceData = await this.redis.get(presenceKey);

            if (!presenceData) return null;

            return JSON.parse(presenceData);
        } catch (error) {
            logger.error('PresenceService: Error getting user presence:', error);
            return null;
        }
    }

    /**
     * Get online users from a list of user IDs
     * @param {Array} userIds 
     * @returns {Promise<Array>}
     */
    async getOnlineUsers(userIds) {
        if (!userIds || userIds.length === 0) return [];

        try {
            const pipeline = this.redis.pipeline();
            userIds.forEach(userId => {
                pipeline.get(`presence:${userId}`);
            });

            const results = await pipeline.exec();
            const onlineUsers = [];

            results.forEach(([err, result], index) => {
                if (!err && result) {
                    try {
                        const presence = JSON.parse(result);
                        if (presence.status === 'online' && presence.activeConnections > 0) {
                            onlineUsers.push({
                                userId: userIds[index],
                                ...presence
                            });
                        }
                    } catch (parseError) {
                        logger.error('PresenceService: Error parsing presence data:', parseError);
                    }
                }
            });

            return onlineUsers;
        } catch (error) {
            logger.error('PresenceService: Error getting online users:', error);
            return [];
        }
    }

    /**
     * Clean up expired connections (manual cleanup)
     */
    async cleanupExpiredConnections() {
        try {
            // This is handled automatically by Redis TTL, but can be used for manual cleanup
            const pattern = 'connections:*';
            const keys = await this.redis.keys(pattern);

            for (const key of keys) {
                const ttl = await this.redis.ttl(key);
                if (ttl === -1) {
                    // Key exists but has no TTL, set one
                    await this.redis.expire(key, this.PRESENCE_TTL);
                }
            }

            logger.debug(`PresenceService: Cleaned up ${keys.length} connection keys`);
        } catch (error) {
            logger.error('PresenceService: Error during cleanup:', error);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        try {
            if (this.nats) {
                await this.nats.close();
                logger.info('PresenceService: NATS connection closed');
            }

            if (this.redis) {
                this.redis.disconnect();
                logger.info('PresenceService: Redis connection closed');
            }
        } catch (error) {
            logger.error('PresenceService: Error during shutdown:', error);
        }
    }
}

module.exports = PresenceService;