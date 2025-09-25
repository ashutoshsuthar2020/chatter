# Chatter - Real-time Chat Application
Access the chat app at: [chat-app](http://212.2.253.234/)

Chatter is a scalable real-time chat app built with React, Node.js, MongoDB, and Redis.

## Highlights
- Secure phone-based authentication
- Real-time messaging and contact management
- Distributed, cloud-native architecture

## Deployment & Usage
All setup and run instructions are in [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## 🏗️ Enterprise Architecture

### Technology Stack
- **Frontend**: React 18 + Tailwind CSS + Socket.IO Client
- **Backend**: Node.js + Express.js + Socket.IO Server  
- **Database**: MongoDB with Mongoose ODM + Redis for scaling
- **Authentication**: Simple phone-based registration/login
- **Real-time**: WebSocket with Redis pub/sub for scaling
- **Deployment**: Docker ready with horizontal scaling support

### Distributed System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│  Load Balancer  │◄──►│  Server Farm    │
│   (Port 3000)   │    │  (HAProxy/Nginx)│    │ (server-1, -2,  │
│                 │    │                 │    │    -3, etc.)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                              ▼                         ▼                         ▼
                    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
                    │   Server 1      │◄─────►│     Redis       │◄─────►│   Server 2      │
                    │   (Socket.IO)   │       │  (Coordination) │       │   (Socket.IO)   │
                    └─────────────────┘       │  • Sessions     │       └─────────────────┘
                              │               │  • Pub/Sub      │                 │
                              │               │  • Locks        │                 │
                              │               │  • Queues       │                 │
                              │               └─────────────────┘                 │
                              │                                                   │
                              └─────────────────────┐         ┌───────────────────┘
                                                    │         │
                                                    ▼         ▼
                                              ┌─────────────────────┐
                                              │      MongoDB        │
                                              │   (Messages +       │
                                              │   Conversations +   │
                                              │   Users + Groups)   │
                                              └─────────────────────┘
```

### Message Flow Pipeline
```
Client → Socket.IO → Server → Redis (Lock) → MongoDB → 
Redis (Pub/Sub) → Target Server → Target Client
```

## 🚀 Production Deployment

### Horizontal Scaling Configuration
Deploy multiple server instances behind a load balancer:
- Each server gets unique SERVER_ID (server-1, server-2, etc.)
- Redis coordinates cross-server communication
- Users can connect to any server instance
- Messages route seamlessly via Redis pub/sub
- No Kubernetes required - simple multi-process deployment

## 🔧 Enterprise Configuration

### Environment Variables

#### Server (.env)
```bash
PORT=8000
MONGODB_URI=mongodb://localhost:27017/chatter
REDIS_URL=redis://localhost:6379
SERVER_ID=server-1
SYNC_INTERVAL_MINUTES=5
NODE_ENV=production
```

#### Client (.env)
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=http://localhost:8000
```

### Redis Configuration
Essential for horizontal scaling and message ordering:
- **Message Locks**: `lock:conversation:{conversationId}`
- **User Sessions**: `user:{userId}` → `{socketId, serverId}`
- **Sequence Numbers**: `seq:{conversationId}`
- **Message Queues**: `queue:{userId}`
- **Pub/Sub Channels**: `broadcast`, `conversation_updated`

## 📁 Enterprise Project Structure

```
chatter/
├── 📁 client/                 # React Frontend Application
│   ├── src/
│   │   ├── components/        # Reusable UI Components
│   │   ├── modules/Dashboard/ # Main Chat Interface
│   │   ├── utils/
│   │   │   ├── messageStorage.js   # localStorage Management
│   │   │   └── syncService.js      # MongoDB Synchronization
│   │   └── config.js          # API Configuration
│   └── package.json
├── 📁 server/                 # Node.js Backend Application  
│   ├── models/                # MongoDB Data Models
│   │   ├── Messages.js        # Enhanced with sequenceNumber
│   │   ├── Conversations.js   # With sequence tracking
│   │   ├── Users.js           # User management
│   │   └── Contacts.js        # Auto-contact system
│   ├── services/              # Enterprise Services
│   │   ├── redisService.js          # Redis operations
│   │   ├── messageQueueService.js   # Offline queuing
│   │   └── messageDeliveryService.js # Ordered delivery
│   ├── middleware/            # Authentication & validation
│   ├── db/                    # Database connection
│   └── app.js                 # Express + Socket.IO + Redis
├── 📄 NOTES.md               # Complete technical documentation
└── 📄 README.md              # This file
```

## 🌟 Enterprise Features Explained

### Zero-Duplication Message System
- **Frontend Debouncing**: Prevents rapid button clicks
- **localStorage Deduplication**: Client-side message ID tracking  
- **Server Validation**: Sequence number verification
- **Database Indexes**: MongoDB compound indexes prevent storage duplicates

### Guaranteed Message Ordering
- **Conversation Locks**: Redis-based distributed locking per conversation
- **Sequence Numbers**: Monotonic counters ensure proper ordering
- **Ordered Delivery**: Messages delivered in exact send order
- **Cross-Server Coordination**: Redis pub/sub maintains order across servers

### Horizontal Scaling Architecture
- **Multi-Server Support**: Deploy unlimited server instances
- **Load Balancer Ready**: Users distributed across server farm
- **Session Management**: Redis tracks user-to-server mapping
- **Cross-Server Messaging**: Seamless message routing via Redis

### Auto-Contact Management
- **Bidirectional Addition**: Automatic contact creation when messaging
- **Conversation Mapping**: Seamless contact-to-chat resolution
- **Group Integration**: Auto-contacts from group participation
- **UI Consistency**: Same conversation regardless of entry point

### localStorage-First Architecture
- **Offline Capability**: Messages cached locally for instant access
- **Background Sync**: Periodic MongoDB synchronization
- **Conflict Resolution**: Merge local and server data intelligently
- **Performance**: Instant message loading from local storage

## 🛠️ Development

### API Endpoints

#### Authentication & Users
- `POST /api/register` - Register new user with phone + name
- `POST /api/login` - Login with phone number only
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/:userId` - Update user profile

#### Enterprise Contact Management
- `GET /api/contacts/:userId` - Get user's contacts
- `POST /api/contacts` - Add contact by phone number (auto-bidirectional)
- `DELETE /api/contacts/:contactId` - Remove contact

#### Advanced Messaging
- `GET /api/conversations/:userId` - Get conversations with sequence info
- `GET /api/message/:conversationId` - Get ordered messages
- `POST /api/message` - Send message with ordering guarantees
- `DELETE /api/conversations/:conversationId` - Delete conversation
- `POST /api/sync` - Synchronize localStorage with MongoDB

#### Production Monitoring
- `GET /health` - Health check endpoint
- `GET /api/redis/status` - Redis connection status (if implemented)

---

## 🔒 Enabling TLS/HTTPS (Production)

Chatter supports secure HTTPS and WSS (WebSocket Secure) for production deployments. To enable TLS:

1. **Obtain TLS Certificates**
   - Use a trusted CA or generate self-signed certs for testing.
   - Store certs as Kubernetes secrets (recommended) or use cert-manager for automatic provisioning.

2. **Helm Ingress TLS Configuration**
   - Edit your `helm/client/templates/ingress.yaml` and `helm/server/templates/ingress.yaml` to add a `tls:` block referencing your secret:
     ```yaml
     tls:
       - hosts:
           - your.domain.com
         secretName: chatter-tls
     ```
   - Update `values.yaml` to allow enabling/disabling TLS and setting secret name.

3. **Node.js Server HTTPS Support**
   - Update `server/app.js` to support HTTPS by reading cert/key from files or environment variables:
     ```js
     const fs = require('fs');
     const httpsOptions = {
       key: fs.readFileSync(process.env.TLS_KEY_PATH),
       cert: fs.readFileSync(process.env.TLS_CERT_PATH)
     };
     const server = require('https').createServer(httpsOptions, app);
     ```
   - Mount certs into the server container via Kubernetes secret.

4. **Client Configuration**
   - Set `REACT_APP_API_URL` and `REACT_APP_WS_URL` to `https://` and `wss://` URLs in `.env` before building:
     ```env
     REACT_APP_API_URL=https://your.domain.com
     REACT_APP_WS_URL=wss://your.domain.com
     ```

5. **Rebuild and Redeploy**
   - Always rebuild the client after changing `.env`.
   - Deploy updated images and Helm charts.

## 📚 Additional Documentation

This README contains all the necessary information to set up and use the Chatter application.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🔮 Future Enhancements

### Current Advanced Features ✅
- [x] **Group Chat Support** - Multi-user chat rooms with member management
- [x] **Message Ordering** - Guaranteed delivery order with Redis coordination  
- [x] **Horizontal Scaling** - Redis-based multi-server architecture
- [x] **Auto-Contact Management** - Bidirectional contact addition
- [x] **Duplicate Prevention** - Multi-layer deduplication system
- [x] **Offline Queuing** - Message delivery for disconnected users

### Planned Enhancements 🚀
- [ ] **Message Encryption** - End-to-end encryption for messages
- [ ] **File Sharing** - Image and document sharing with Redis coordination
- [ ] **Push Notifications** - Browser notifications with offline support
- [ ] **Message Reactions** - Emoji reactions with real-time sync
- [ ] **Voice/Video Calls** - WebRTC integration with signaling server
- [ ] **Message Threading** - Reply chains and conversation threading
- [ ] **Advanced Admin Controls** - User management and moderation tools
- [ ] **Message Search** - Full-text search across conversations
- [ ] **Custom Status** - User presence with custom status messages
- [ ] **Mobile App** - React Native with same Redis backend
- [ ] **Redis Cluster** - High availability Redis deployment
- [ ] **MongoDB Sharding** - Database scaling for large deployments

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Socket.IO for real-time communication and scaling capabilities
- Redis for enterprise-grade message ordering and horizontal scaling
- MongoDB for reliable, scalable data storage
- Tailwind CSS for beautiful, responsive styling
- React team for the powerful frontend framework
- Node.js community for excellent backend ecosystem

---

## 📋 Technical Summary

This chat application demonstrates enterprise-level software engineering with:
- **Simple phone-based authentication** - No complex OAuth setup required
- **Zero message duplication** through multi-layer prevention
- **Guaranteed message ordering** via Redis-based distributed locking
- **True horizontal scaling** supporting unlimited server instances without Kubernetes
- **Auto-contact management** for seamless user experience
- **localStorage-first architecture** with intelligent synchronization
- **Production-ready monitoring** and health check endpoints

The system is ready for production deployment with comprehensive error handling, monitoring, and horizontal scaling capabilities using simple Redis coordination.