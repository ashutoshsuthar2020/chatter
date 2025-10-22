# Presence Service Integration Examples

## Overview
This document provides examples of how to use the presence service components in your application.

## 1. Basic Presence Service Usage

### Initialize the Presence Service
```javascript
const PresenceService = require('./services/presenceService');
const { HeartbeatManager } = require('./services/heartbeatManager');
const natsService = require('./services/natsService');

// Initialize services
const presenceService = new PresenceService();
await presenceService.initialize();

const heartbeatManager = new HeartbeatManager(presenceService, natsService.nc);
```

### Check User Online Status
```javascript
// Check if a single user is online
const isOnline = await presenceService.isUserOnline('12345');
console.log(`User 12345 is ${isOnline ? 'online' : 'offline'}`);

// Get detailed presence information
const presence = await presenceService.getUserPresence('12345');
console.log('User presence:', presence);
/*
Output:
{
  status: 'online',
  lastSeen: 1698000000000,
  activeConnections: 2,
  metadata: { device: 'web' }
}
*/
```

### Batch Check Multiple Users
```javascript
const userIds = ['12345', '67890', '11111'];
const onlineUsers = await presenceService.getOnlineUsers(userIds);
console.log('Online users:', onlineUsers);
/*
Output:
[
  { userId: '12345', status: 'online', activeConnections: 2, lastSeen: 1698000000000 },
  { userId: '67890', status: 'online', activeConnections: 1, lastSeen: 1698000000000 }
]
*/
```

## 2. Client-Side Integration

### Frontend Heartbeat Setup
```javascript
// In your React/Vue/Angular app
import { ClientHeartbeat, ActivityTracker } from './heartbeat-client';

class PresenceManager {
    constructor(socket, userId) {
        this.socket = socket;
        this.userId = userId;
        this.heartbeat = new ClientHeartbeat(socket, userId);
        this.activityTracker = new ActivityTracker(this.heartbeat);
    }

    start() {
        // Start sending heartbeats
        this.heartbeat.start();
        
        // Listen for presence events
        this.socket.on('user_online', (data) => {
            console.log('User came online:', data.userId);
            this.updateUserStatus(data.userId, 'online');
        });
        
        this.socket.on('user_offline', (data) => {
            console.log('User went offline:', data.userId);
            this.updateUserStatus(data.userId, 'offline');
        });
    }

    stop() {
        this.heartbeat.stop();
    }

    updateActivity(activity, context = {}) {
        this.heartbeat.updateActivity(activity, context);
    }

    updateUserStatus(userId, status) {
        // Update your UI to show user status
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            userElement.classList.toggle('online', status === 'online');
            userElement.classList.toggle('offline', status === 'offline');
        }
    }
}

// Usage
const socket = io();
const presenceManager = new PresenceManager(socket, currentUserId);

socket.on('connect', () => {
    socket.emit('addUser', currentUserId);
    presenceManager.start();
});

socket.on('disconnect', () => {
    presenceManager.stop();
});
```

### Activity Tracking Examples
```javascript
// Track typing in a chat
document.getElementById('messageInput').addEventListener('input', () => {
    presenceManager.updateActivity('typing', { currentChat: chatId });
});

// Clear typing when stopped
document.getElementById('messageInput').addEventListener('blur', () => {
    presenceManager.updateActivity('active');
});

// Track page/section changes
function navigateToChat(chatId) {
    presenceManager.activityTracker.setLocation(`chat:${chatId}`);
    // ... navigation logic
}

function navigateToDashboard() {
    presenceManager.activityTracker.setLocation('dashboard');
    // ... navigation logic
}
```

## 3. Server-Side Event Handling

### Handle Presence Events
```javascript
// Subscribe to presence events in your application
natsService.subscribe('presence.events.user_online', async (data) => {
    console.log(`User ${data.userId} came online`);
    
    // Notify their contacts
    const contacts = await getContactsOfUser(data.userId);
    for (const contact of contacts) {
        const contactSocket = getSocketForUser(contact.userId);
        if (contactSocket) {
            contactSocket.emit('contact_online', {
                userId: data.userId,
                timestamp: data.timestamp
            });
        }
    }
});

natsService.subscribe('presence.events.user_offline', async (data) => {
    console.log(`User ${data.userId} went offline`);
    
    // Notify their contacts
    const contacts = await getContactsOfUser(data.userId);
    for (const contact of contacts) {
        const contactSocket = getSocketForUser(contact.userId);
        if (contactSocket) {
            contactSocket.emit('contact_offline', {
                userId: data.userId,
                lastSeen: data.lastSeen
            });
        }
    }
});
```

### Privacy-Filtered Events
```javascript
const PresenceFilterService = require('./services/presenceFilterService');
const filterService = new PresenceFilterService(natsService);

// Subscribe to filtered events
natsService.subscribe('presence.filtered.user_online', async (data) => {
    console.log(`Filtered online event for ${data.userId}, visible to:`, data.visibleTo);
    
    // Emit to specific users only
    for (const userId of data.visibleTo) {
        const socket = getSocketForUser(userId);
        if (socket) {
            socket.emit('contact_online', {
                userId: data.userId,
                timestamp: data.timestamp
            });
        }
    }
});
```

## 4. API Endpoints

### Add Presence API Routes
```javascript
// Get online status for contacts
app.get('/api/presence/contacts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get user's contacts
        const contacts = await Contacts.find({ userId }).select('contactUserId');
        const contactIds = contacts.map(c => c.contactUserId);
        
        // Get online status for contacts
        const onlineContacts = await presenceService.getOnlineUsers(contactIds);
        
        res.json({ onlineContacts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get detailed presence for a user
app.get('/api/presence/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const viewerUserId = req.user.id; // Assuming auth middleware
        
        // Check if viewer can see this user's presence
        const canSee = await filterService.canUserSeePresence(viewerUserId, userId);
        if (!canSee) {
            return res.status(403).json({ error: 'Not authorized to view presence' });
        }
        
        const presence = await presenceService.getUserPresence(userId);
        
        // Filter by privacy settings
        const filteredPresence = await filterService.filterPresenceByPrivacy(
            userId, viewerUserId, presence
        );
        
        res.json({ presence: filteredPresence });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## 5. Multiple Device Support

### Handle Multiple Connections per User
```javascript
// When user connects from multiple devices
socket.on('addUser', async (userId) => {
    const deviceInfo = {
        device: detectDevice(socket.handshake.headers['user-agent']),
        userAgent: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address
    };
    
    const connId = `${deviceInfo.device}_${socket.id}_${Date.now()}`;
    
    // Add connection to presence service
    await natsService.publish('presence.connect', {
        userId,
        connId,
        metadata: deviceInfo
    });
    
    // Each device gets its own heartbeat
    heartbeatManager.startHeartbeat(userId, connId, deviceInfo);
});

// Check all devices for a user
async function getUserDevices(userId) {
    const connectionKey = `connections:${userId}`;
    const connections = await redis.hgetall(connectionKey);
    
    const devices = Object.entries(connections).map(([connId, data]) => {
        const connData = JSON.parse(data);
        return {
            connId,
            device: connData.metadata.device,
            connectedAt: connData.connectedAt,
            lastSeen: connData.lastSeen
        };
    });
    
    return devices;
}
```

## 6. Error Handling and Monitoring

### Graceful Degradation
```javascript
// Handle Redis connection issues
async function safeGetUserPresence(userId) {
    try {
        return await presenceService.getUserPresence(userId);
    } catch (error) {
        logger.error('Presence service error, falling back to local state:', error);
        
        // Fall back to local memory or database
        return getLocalUserPresence(userId);
    }
}

// Handle NATS connection issues
async function safePublishPresenceEvent(event, data) {
    try {
        await natsService.publish(event, data);
    } catch (error) {
        logger.error('NATS publish failed, queuing for retry:', error);
        
        // Queue for retry when connection restored
        await queuePresenceEvent(event, data);
    }
}
```

### Health Checks
```javascript
// Health check endpoint
app.get('/api/health/presence', async (req, res) => {
    const health = {
        redis: 'unknown',
        nats: 'unknown',
        timestamp: Date.now()
    };
    
    try {
        // Check Redis
        await presenceService.redis.ping();
        health.redis = 'healthy';
    } catch (error) {
        health.redis = 'unhealthy';
        health.redisError = error.message;
    }
    
    try {
        // Check NATS
        const status = natsService.nc.status();
        health.nats = status === 1 ? 'healthy' : 'unhealthy'; // 1 = CONNECTED
    } catch (error) {
        health.nats = 'unhealthy';
        health.natsError = error.message;
    }
    
    const overallHealthy = health.redis === 'healthy' && health.nats === 'healthy';
    res.status(overallHealthy ? 200 : 503).json(health);
});
```

## 7. Performance Optimization

### Batch Operations
```javascript
// Batch check online status
async function batchGetOnlineStatus(userIds) {
    const BATCH_SIZE = 100;
    const results = [];
    
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const batchResults = await presenceService.getOnlineUsers(batch);
        results.push(...batchResults);
    }
    
    return results;
}

// Cache frequently accessed data
const presenceCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

async function getCachedPresence(userId) {
    const cached = presenceCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    
    const presence = await presenceService.getUserPresence(userId);
    presenceCache.set(userId, {
        data: presence,
        timestamp: Date.now()
    });
    
    return presence;
}
```

This comprehensive integration guide shows how to use all the presence service components in a real application, with proper error handling, performance optimization, and privacy considerations.