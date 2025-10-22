const logger = require('../logger');

class HeartbeatManager {
    constructor(presenceService, nats) {
        this.presenceService = presenceService;
        this.nats = nats;
        this.intervals = new Map(); // connId -> intervalId
        this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
        this.jc = require('nats').JSONCodec();
    }

    /**
     * Start heartbeat for a connection
     * @param {string} userId 
     * @param {string} connId 
     * @param {Object} metadata 
     */
    startHeartbeat(userId, connId, metadata = {}) {
        // Clear existing heartbeat if any
        this.stopHeartbeat(connId);

        const intervalId = setInterval(async () => {
            try {
                await this.sendHeartbeat(userId, connId, metadata);
            } catch (error) {
                logger.error(`HeartbeatManager: Error sending heartbeat for ${userId}:${connId}:`, error);
                // Stop heartbeat on persistent errors
                this.stopHeartbeat(connId);
            }
        }, this.HEARTBEAT_INTERVAL);

        this.intervals.set(connId, intervalId);
        logger.debug(`HeartbeatManager: Started heartbeat for ${userId}:${connId}`);
    }

    /**
     * Stop heartbeat for a connection
     * @param {string} connId 
     */
    stopHeartbeat(connId) {
        const intervalId = this.intervals.get(connId);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(connId);
            logger.debug(`HeartbeatManager: Stopped heartbeat for connId ${connId}`);
        }
    }

    /**
     * Send heartbeat event
     * @param {string} userId 
     * @param {string} connId 
     * @param {Object} metadata 
     */
    async sendHeartbeat(userId, connId, metadata = {}) {
        const heartbeatData = {
            userId,
            connId,
            timestamp: Date.now(),
            metadata: {
                ...metadata,
                heartbeatCount: (metadata.heartbeatCount || 0) + 1
            }
        };

        // Publish heartbeat to NATS
        await this.nats.publish('presence.heartbeat', this.jc.encode(heartbeatData));

        logger.debug(`HeartbeatManager: Sent heartbeat for ${userId}:${connId}`);
    }

    /**
     * Update metadata for a connection's heartbeat
     * @param {string} connId 
     * @param {Object} newMetadata 
     */
    updateMetadata(connId, newMetadata) {
        // This would typically be stored and used in the next heartbeat
        // For now, we'll just log it
        logger.debug(`HeartbeatManager: Updated metadata for ${connId}:`, newMetadata);
    }

    /**
     * Get active heartbeat connections
     * @returns {Array}
     */
    getActiveConnections() {
        return Array.from(this.intervals.keys());
    }

    /**
     * Stop all heartbeats (for shutdown)
     */
    stopAllHeartbeats() {
        for (const connId of this.intervals.keys()) {
            this.stopHeartbeat(connId);
        }
        logger.info('HeartbeatManager: Stopped all heartbeats');
    }
}

/**
 * Client-side heartbeat implementation for browsers/mobile apps
 */
class ClientHeartbeat {
    constructor(socket, userId) {
        this.socket = socket;
        this.userId = userId;
        this.connId = this.generateConnId();
        this.interval = null;
        this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
        this.metadata = {
            device: this.detectDevice(),
            userAgent: navigator?.userAgent || 'Unknown',
            lastActivity: Date.now()
        };
    }

    /**
     * Start sending heartbeats
     */
    start() {
        this.stop(); // Clear any existing interval

        this.interval = setInterval(() => {
            this.sendHeartbeat();
        }, this.HEARTBEAT_INTERVAL);

        // Send initial heartbeat
        this.sendHeartbeat();

        console.debug('ClientHeartbeat: Started for user', this.userId);
    }

    /**
     * Stop sending heartbeats
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.debug('ClientHeartbeat: Stopped for user', this.userId);
        }
    }

    /**
     * Send heartbeat to server
     */
    sendHeartbeat() {
        const heartbeatData = {
            userId: this.userId,
            connId: this.connId,
            timestamp: Date.now(),
            metadata: {
                ...this.metadata,
                lastActivity: this.getLastActivity()
            }
        };

        this.socket.emit('presence:heartbeat', heartbeatData);
        console.debug('ClientHeartbeat: Sent heartbeat', heartbeatData);
    }

    /**
     * Update activity status
     * @param {string} activity - 'active', 'idle', 'typing'
     * @param {Object} context - Additional context like current page/chat
     */
    updateActivity(activity, context = {}) {
        this.metadata = {
            ...this.metadata,
            activity,
            lastActivity: Date.now(),
            ...context
        };
    }

    /**
     * Generate unique connection ID
     * @returns {string}
     */
    generateConnId() {
        return `${this.detectDevice()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Detect device type
     * @returns {string}
     */
    detectDevice() {
        if (typeof navigator === 'undefined') return 'server';

        const userAgent = navigator.userAgent.toLowerCase();
        if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)) {
            return 'mobile';
        }
        return 'web';
    }

    /**
     * Get last activity timestamp
     * @returns {number}
     */
    getLastActivity() {
        return this.metadata.lastActivity || Date.now();
    }
}

/**
 * Activity tracker for updating heartbeat metadata
 */
class ActivityTracker {
    constructor(clientHeartbeat) {
        this.heartbeat = clientHeartbeat;
        this.lastActivity = Date.now();
        this.isIdle = false;
        this.IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        this.setupActivityListeners();
        this.startIdleTimer();
    }

    /**
     * Setup DOM event listeners for activity tracking
     */
    setupActivityListeners() {
        if (typeof document === 'undefined') return;

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        events.forEach(event => {
            document.addEventListener(event, () => {
                this.recordActivity();
            }, { passive: true });
        });
    }

    /**
     * Record user activity
     */
    recordActivity() {
        this.lastActivity = Date.now();

        if (this.isIdle) {
            this.isIdle = false;
            this.heartbeat.updateActivity('active');
        }
    }

    /**
     * Start idle detection timer
     */
    startIdleTimer() {
        setInterval(() => {
            const timeSinceActivity = Date.now() - this.lastActivity;

            if (timeSinceActivity > this.IDLE_TIMEOUT && !this.isIdle) {
                this.isIdle = true;
                this.heartbeat.updateActivity('idle');
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Set typing status
     * @param {string} chatId - Current chat ID
     */
    setTyping(chatId) {
        this.recordActivity();
        this.heartbeat.updateActivity('typing', { currentChat: chatId });
    }

    /**
     * Clear typing status
     */
    clearTyping() {
        this.recordActivity();
        this.heartbeat.updateActivity('active');
    }

    /**
     * Set current location/page
     * @param {string} location - Current page/section
     */
    setLocation(location) {
        this.heartbeat.updateActivity(this.isIdle ? 'idle' : 'active', { location });
    }
}

module.exports = {
    HeartbeatManager,
    ClientHeartbeat,
    ActivityTracker
};