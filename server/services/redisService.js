const Redis = require('ioredis');

class RedisService {
    constructor() {
        this.redis = null;
        this.pubClient = null;
        this.subClient = null;
        this.serverId = process.env.SERVER_ID || `server-${Date.now()}`;
        this.isConnected = false;
    }

    async connect() {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

            // Main Redis client for data operations
            this.redis = new Redis(redisUrl, {
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
            });

            // Publisher client for socket events
            this.pubClient = new Redis(redisUrl);

            // Subscriber client for socket events
            this.subClient = new Redis(redisUrl);

            // Set up event listeners
            this.redis.on('connect', () => {
                console.log('Redis connected successfully');
                this.isConnected = true;
            });

            this.redis.on('error', (err) => {
                console.error('Redis connection error:', err);
                this.isConnected = false;
            });

            // Wait for connection
            await this.redis.ping();
            console.log('Redis service initialized');

        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            console.log('Running without Redis - horizontal scaling disabled');
        }
    }

    // User session management for horizontal scaling
    async setUserSession(userId, serverData) {
        if (!this.isConnected) return false;
        try {
            await this.redis.hset('user_sessions', userId, JSON.stringify({
                serverId: this.serverId,
                socketId: serverData.socketId,
                connectedAt: new Date().toISOString(),
                ...serverData
            }));
            return true;
        } catch (error) {
            console.error('Error setting user session:', error);
            return false;
        }
    }

    async getUserSession(userId) {
        if (!this.isConnected) return null;
        try {
            const sessionData = await this.redis.hget('user_sessions', userId);
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (error) {
            console.error('Error getting user session:', error);
            return null;
        }
    }

    async removeUserSession(userId) {
        if (!this.isConnected) return false;
        try {
            await this.redis.hdel('user_sessions', userId);
            return true;
        } catch (error) {
            console.error('Error removing user session:', error);
            return false;
        }
    }

    // Message queue management for offline users
    async queueMessageForUser(userId, messageData) {
        if (!this.isConnected) return false;
        try {
            const queueKey = `user_queue:${userId}`;
            await this.redis.lpush(queueKey, JSON.stringify({
                ...messageData,
                queuedAt: new Date().toISOString()
            }));

            // Set expiry for queue (7 days)
            await this.redis.expire(queueKey, 7 * 24 * 60 * 60);
            return true;
        } catch (error) {
            console.error('Error queuing message:', error);
            return false;
        }
    }

    async getQueuedMessages(userId) {
        if (!this.isConnected) return [];
        try {
            const queueKey = `user_queue:${userId}`;
            const messages = await this.redis.lrange(queueKey, 0, -1);
            return messages.map(msg => JSON.parse(msg));
        } catch (error) {
            console.error('Error getting queued messages:', error);
            return [];
        }
    }

    async clearUserQueue(userId) {
        if (!this.isConnected) return false;
        try {
            const queueKey = `user_queue:${userId}`;
            await this.redis.del(queueKey);
            return true;
        } catch (error) {
            console.error('Error clearing user queue:', error);
            return false;
        }
    }

    // Message ordering and locking
    async acquireMessageLock(conversationId, timeoutMs = 5000) {
        if (!this.isConnected) return { success: true, lockId: 'no-redis' }; // Fallback when Redis unavailable

        try {
            const lockKey = `msg_lock:${conversationId}`;
            const lockId = `${this.serverId}-${Date.now()}-${Math.random()}`;

            // Try to acquire lock with expiration
            const result = await this.redis.set(lockKey, lockId, 'PX', timeoutMs, 'NX');

            if (result === 'OK') {
                return { success: true, lockId };
            } else {
                return { success: false, lockId: null };
            }
        } catch (error) {
            console.error('Error acquiring message lock:', error);
            return { success: false, lockId: null };
        }
    }

    async releaseLock(conversationId, lockId) {
        if (!this.isConnected || lockId === 'no-redis') return true;

        try {
            const lockKey = `msg_lock:${conversationId}`;

            // Lua script to safely release lock only if we own it
            const luaScript = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;

            const result = await this.redis.eval(luaScript, 1, lockKey, lockId);
            return result === 1;
        } catch (error) {
            console.error('Error releasing lock:', error);
            return false;
        }
    }

    // Get next sequence number for conversation
    async getNextSequenceNumber(conversationId) {
        if (!this.isConnected) return Date.now(); // Fallback to timestamp

        try {
            const seqKey = `seq:${conversationId}`;
            return await this.redis.incr(seqKey);
        } catch (error) {
            console.error('Error getting sequence number:', error);
            return Date.now();
        }
    }

    // Cross-server message broadcasting
    async broadcastMessage(event, data) {
        if (!this.isConnected) return false;

        try {
            await this.pubClient.publish('socket_events', JSON.stringify({
                event,
                data,
                fromServer: this.serverId,
                timestamp: new Date().toISOString()
            }));
            return true;
        } catch (error) {
            console.error('Error broadcasting message:', error);
            return false;
        }
    }

    // Subscribe to cross-server events
    subscribeToEvents(callback) {
        if (!this.isConnected) return;

        this.subClient.subscribe('socket_events');
        this.subClient.on('message', (channel, message) => {
            if (channel === 'socket_events') {
                try {
                    const eventData = JSON.parse(message);
                    // Don't process events from our own server
                    if (eventData.fromServer !== this.serverId) {
                        callback(eventData);
                    }
                } catch (error) {
                    console.error('Error processing subscribed event:', error);
                }
            }
        });
    }

    async disconnect() {
        try {
            if (this.redis) await this.redis.disconnect();
            if (this.pubClient) await this.pubClient.disconnect();
            if (this.subClient) await this.subClient.disconnect();
            this.isConnected = false;
            console.log('Redis service disconnected');
        } catch (error) {
            console.error('Error disconnecting Redis:', error);
        }
    }
}

module.exports = new RedisService();
