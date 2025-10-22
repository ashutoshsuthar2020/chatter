# Redis Presence Schema Documentation

## Overview
This document outlines the Redis key patterns and data structures used for the presence service.

## Key Patterns

### 1. User Presence Status
**Pattern:** `presence:<user_id>`
**TTL:** 60 seconds (refreshed on heartbeat)
**Data Type:** String (JSON)

```json
{
  "status": "online|offline",
  "lastSeen": 1698000000000,
  "activeConnections": 2,
  "metadata": {
    "device": "web|mobile|desktop",
    "userAgent": "Mozilla/5.0...",
    "lastActivity": "typing|idle|active"
  }
}
```

### 2. User Connections
**Pattern:** `connections:<user_id>`
**TTL:** 60 seconds (auto-expires inactive connections)
**Data Type:** Hash

```
connections:12345 = {
  "conn_123": '{"connectedAt": 1698000000000, "lastSeen": 1698000000000, "metadata": {...}}',
  "conn_456": '{"connectedAt": 1698000000000, "lastSeen": 1698000000000, "metadata": {...}}'
}
```

## Data Structures

### Connection Data
```json
{
  "connectedAt": 1698000000000,
  "lastSeen": 1698000000000,
  "metadata": {
    "device": "web",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "ip": "192.168.1.1",
    "socketId": "socket_abc123"
  }
}
```

### Presence Data
```json
{
  "status": "online",
  "lastSeen": 1698000000000,
  "activeConnections": 2,
  "metadata": {
    "device": "web",
    "lastActivity": "active",
    "location": "dashboard"
  }
}
```

## TTL Strategy

### Active Connections
- **TTL:** 60 seconds
- **Refresh:** Every 30 seconds via heartbeat
- **Auto-cleanup:** Redis automatically removes expired keys

### Offline Presence
- **TTL:** 600 seconds (10 minutes)
- **Purpose:** Keep "last seen" information for recently offline users
- **Cleanup:** Automatic via Redis TTL

## Key Operations

### Connection Events
```bash
# User connects
HSET connections:12345 conn_123 '{"connectedAt": 1698000000000, ...}'
EXPIRE connections:12345 60
SETEX presence:12345 60 '{"status": "online", ...}'

# User disconnects
HDEL connections:12345 conn_123
HLEN connections:12345  # Check remaining connections
```

### Heartbeat
```bash
# Refresh connection
HSET connections:12345 conn_123 '{"lastSeen": 1698000000000, ...}'
EXPIRE connections:12345 60
SETEX presence:12345 60 '{"status": "online", ...}'
```

### Query Operations
```bash
# Check if user is online
GET presence:12345

# Get all connections for user
HGETALL connections:12345

# Batch check multiple users
MGET presence:12345 presence:67890 presence:11111
```

## Scalability Considerations

### Memory Usage
- Each presence key: ~200-500 bytes
- Each connection entry: ~150-300 bytes
- 1M users with 2 connections each: ~1-2 GB memory

### Performance
- Single Redis instance can handle 100K+ operations/second
- Use Redis cluster for horizontal scaling
- Consider Redis Streams for audit logging

### Network
- Heartbeats every 30 seconds reduce network overhead
- Batch operations where possible
- Use pipeline for multiple operations

## Example Usage

### Check User Online Status
```javascript
const isOnline = await redis.get('presence:12345');
const presence = isOnline ? JSON.parse(isOnline) : null;
return presence?.status === 'online' && presence?.activeConnections > 0;
```

### Get Online Users from List
```javascript
const userIds = ['12345', '67890', '11111'];
const pipeline = redis.pipeline();
userIds.forEach(id => pipeline.get(`presence:${id}`));
const results = await pipeline.exec();
const onlineUsers = results
  .map(([err, result], index) => {
    if (!err && result) {
      const presence = JSON.parse(result);
      return presence.status === 'online' ? userIds[index] : null;
    }
    return null;
  })
  .filter(Boolean);
```

### Handle Multiple Devices
```javascript
// User can be online from multiple devices
const connections = await redis.hgetall(`connections:${userId}`);
const deviceTypes = Object.values(connections)
  .map(conn => JSON.parse(conn).metadata.device)
  .filter((device, index, arr) => arr.indexOf(device) === index);
```