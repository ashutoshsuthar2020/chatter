/**
 * Client-side presence and heartbeat management
 * To be used in React/Vue/Angular applications
 */
import React, { useState, useEffect, useContext, createContext } from 'react';

export class ClientHeartbeat {
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
export class ActivityTracker {
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

/**
 * React Hook for presence management
 */
export function usePresence(socket, userId) {
    const [heartbeat, setHeartbeat] = useState(null);
    const [activityTracker, setActivityTracker] = useState(null);
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        if (!socket || !userId) return;

        const clientHeartbeat = new ClientHeartbeat(socket, userId);
        const tracker = new ActivityTracker(clientHeartbeat);

        setHeartbeat(clientHeartbeat);
        setActivityTracker(tracker);

        // Start heartbeat when socket connects
        if (socket.connected) {
            clientHeartbeat.start();
            setIsOnline(true);
        }

        socket.on('connect', () => {
            clientHeartbeat.start();
            setIsOnline(true);
        });

        socket.on('disconnect', () => {
            clientHeartbeat.stop();
            setIsOnline(false);
        });

        return () => {
            clientHeartbeat.stop();
        };
    }, [socket, userId]);

    return {
        heartbeat,
        activityTracker,
        isOnline,
        updateActivity: (activity, context) => {
            if (heartbeat) {
                heartbeat.updateActivity(activity, context);
            }
        },
        setTyping: (chatId) => {
            if (activityTracker) {
                activityTracker.setTyping(chatId);
            }
        },
        clearTyping: () => {
            if (activityTracker) {
                activityTracker.clearTyping();
            }
        },
        setLocation: (location) => {
            if (activityTracker) {
                activityTracker.setLocation(location);
            }
        }
    };
}


// Create React Context for presence
const PresenceContext = createContext(null);

// Example React component usage
export const PresenceProvider = ({ children, socket, userId }) => {
    const presence = usePresence(socket, userId);

    return (
        <PresenceContext.Provider value={presence}>
            {children}
        </PresenceContext.Provider>
    );
};

// Example usage in a chat component
export const ChatInput = ({ chatId }) => {
    const { setTyping, clearTyping } = useContext(PresenceContext);
    const [message, setMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const handleInputChange = (e) => {
        setMessage(e.target.value);

        if (!isTyping && e.target.value.length > 0) {
            setIsTyping(true);
            setTyping(chatId);
        }
    };

    const handleInputBlur = () => {
        if (isTyping) {
            setIsTyping(false);
            clearTyping();
        }
    };

    const handleSubmit = () => {
        // Send message logic
        setMessage('');
        setIsTyping(false);
        clearTyping();
    };

    return (
        <div>
            <input
                value={message}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="Type a message..."
            />
            <button onClick={handleSubmit}>Send</button>
        </div>
    );
};