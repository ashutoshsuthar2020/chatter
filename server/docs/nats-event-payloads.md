# NATS Presence Event Payloads

## Overview
This document defines the event structures for presence-related events in the NATS messaging system.

## Event Channels

### Core Presence Events
- `presence.events` - All presence events (broadcast channel)
- `presence.events.user_online` - User online events
- `presence.events.user_offline` - User offline events
- `presence.heartbeat` - Heartbeat events
- `presence.connect` - Connection events
- `presence.disconnect` - Disconnection events

### Privacy-Filtered Events
- `presence.filtered.user_online` - Filtered online events
- `presence.filtered.user_offline` - Filtered offline events

## Event Payloads

### 1. User Online Event
**Channel:** `presence.events.user_online`

```json
{
  "type": "user_online",
  "userId": "12345",
  "timestamp": 1698000000000,
  "metadata": {
    "device": "web",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "location": "dashboard",
    "connId": "conn_abc123"
  }
}
```

### 2. User Offline Event
**Channel:** `presence.events.user_offline`

```json
{
  "type": "user_offline",
  "userId": "12345",
  "timestamp": 1698000000000,
  "lastSeen": 1698000000000,
  "reason": "disconnect|timeout|logout"
}
```

### 3. Heartbeat Event
**Channel:** `presence.heartbeat`

```json
{
  "userId": "12345",
  "connId": "conn_abc123",
  "timestamp": 1698000000000,
  "metadata": {
    "activity": "active|idle|typing",
    "location": "chat:67890"
  }
}
```

### 4. Connection Event
**Channel:** `presence.connect`

```json
{
  "userId": "12345",
  "connId": "conn_abc123",
  "timestamp": 1698000000000,
  "metadata": {
    "device": "web",
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.1",
    "socketId": "socket_abc123"
  }
}
```

### 5. Disconnection Event
**Channel:** `presence.disconnect`

```json
{
  "userId": "12345",
  "connId": "conn_abc123",
  "timestamp": 1698000000000,
  "reason": "client_disconnect|server_shutdown|timeout"
}
```

## Privacy-Filtered Events

### Filtered User Online Event
**Channel:** `presence.filtered.user_online`

```json
{
  "type": "user_online",
  "userId": "12345",
  "timestamp": 1698000000000,
  "visibleTo": ["67890", "11111", "22222"],
  "metadata": {
    "device": "web"
  }
}
```

### Filtered User Offline Event
**Channel:** `presence.filtered.user_offline`

```json
{
  "type": "user_offline",
  "userId": "12345",
  "timestamp": 1698000000000,
  "lastSeen": 1698000000000,
  "visibleTo": ["67890", "11111", "22222"]
}
```

## Event Examples

### User Connecting (First Device)
```json
// 1. Connection event
{
  "userId": "12345",
  "connId": "web_abc123",
  "timestamp": 1698000000000,
  "metadata": {
    "device": "web",
    "userAgent": "Mozilla/5.0...",
    "socketId": "socket_abc123"
  }
}

// 2. User online event (triggered when first connection)
{
  "type": "user_online",
  "userId": "12345",
  "timestamp": 1698000000000,
  "metadata": {
    "device": "web",
    "connId": "web_abc123"
  }
}
```

### User Connecting (Additional Device)
```json
// 1. Connection event
{
  "userId": "12345",
  "connId": "mobile_xyz789",
  "timestamp": 1698000000000,
  "metadata": {
    "device": "mobile",
    "userAgent": "MyApp/1.0 iOS",
    "socketId": "socket_xyz789"
  }
}

// 2. No user_online event (user already online)
```

### User Disconnecting (Last Device)
```json
// 1. Disconnection event
{
  "userId": "12345",
  "connId": "web_abc123",
  "timestamp": 1698000000000,
  "reason": "client_disconnect"
}

// 2. User offline event (triggered when last connection drops)
{
  "type": "user_offline",
  "userId": "12345",
  "timestamp": 1698000000000,
  "lastSeen": 1698000000000,
  "reason": "disconnect"
}
```

### Heartbeat with Activity
```json
{
  "userId": "12345",
  "connId": "web_abc123",
  "timestamp": 1698000000000,
  "metadata": {
    "activity": "typing",
    "location": "chat:67890",
    "lastMessageId": "msg_456"
  }
}
```

## Event Handlers

### Subscribe to All Presence Events
```javascript
const sub = nats.subscribe('presence.events');
for await (const msg of sub) {
  const event = JSON.parse(msg.data);
  console.log('Presence event:', event.type, event.userId);
}
```

### Subscribe to Specific Events
```javascript
// Online events only
const onlineSub = nats.subscribe('presence.events.user_online');
for await (const msg of onlineSub) {
  const event = JSON.parse(msg.data);
  handleUserOnline(event.userId, event.metadata);
}

// Offline events only
const offlineSub = nats.subscribe('presence.events.user_offline');
for await (const msg of offlineSub) {
  const event = JSON.parse(msg.data);
  handleUserOffline(event.userId, event.lastSeen);
}
```

### Publish Events
```javascript
// Publish user online
await nats.publish('presence.events.user_online', JSON.stringify({
  type: 'user_online',
  userId: '12345',
  timestamp: Date.now(),
  metadata: { device: 'web' }
}));

// Publish heartbeat
await nats.publish('presence.heartbeat', JSON.stringify({
  userId: '12345',
  connId: 'web_abc123',
  timestamp: Date.now(),
  metadata: { activity: 'active' }
}));
```

## Privacy Considerations

### Contact-Based Filtering
```javascript
// Filter presence events based on contact relationships
const contacts = await getContactsForUser(event.userId);
const filteredEvent = {
  ...event,
  visibleTo: contacts.map(c => c.contactId)
};

await nats.publish('presence.filtered.user_online', JSON.stringify(filteredEvent));
```

### Group-Based Filtering
```javascript
// Filter based on shared group memberships
const groups = await getSharedGroups(event.userId);
const groupMembers = await getGroupMembers(groups);
const filteredEvent = {
  ...event,
  visibleTo: groupMembers
};
```

## Error Handling

### Invalid Event Format
```javascript
try {
  const event = JSON.parse(msg.data);
  if (!event.userId || !event.timestamp) {
    throw new Error('Invalid event format');
  }
  await handleEvent(event);
} catch (error) {
  logger.error('Invalid presence event:', error);
  // Optionally send to dead letter queue
}
```

### Connection Timeout
```javascript
{
  "type": "user_offline",
  "userId": "12345",
  "timestamp": 1698000000000,
  "lastSeen": 1697999970000,
  "reason": "timeout",
  "metadata": {
    "timeoutDuration": 30000,
    "lastHeartbeat": 1697999970000
  }
}
```