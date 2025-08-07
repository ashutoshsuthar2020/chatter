# Chatter - Enterprise Real-time Chat Application

A horizontally-scalable real-time chat application with enterprise-grade message ordering, zero-duplication guarantees, and Redis-based distributed architecture. Built with React, Node.js, Socket.IO, MongoDB, and Redis.

## ✨ Enterprise Features

### 🔐 Simple & Secure Authentication
- **Phone-Based Authentication** - Simple registration and login with phone numbers only
- **User Profiles** - Full name, phone number, profile pictures, and bio
- **Auto-Contact Management** - Automatic bidirectional contact addition when messaging

### 💬 Enterprise Messaging System
- **Zero Message Duplication** - Multi-layer duplicate prevention system
- **Guaranteed Message Ordering** - Redis-based sequence ordering with conversation locks
- **Horizontal Scaling** - Redis pub/sub architecture for multi-server deployment
- **Offline User Queuing** - Message queuing for disconnected users
- **Cross-Server Delivery** - Seamless messaging across distributed server instances

### 🏗️ Distributed Architecture
- **Redis-Based Scaling** - Enterprise-ready horizontal scaling infrastructure
- **localStorage-First** - Client-side caching with background MongoDB synchronization
- **Conversation Locking** - Distributed locks ensuring message consistency
- **Health Monitoring** - Production-ready health check endpoints

## ✨ Key Features

### 💬 Real-time Messaging
- **Instant Communication** - Live chat powered by Socket.IO
- **Message Persistence** - All messages stored in MongoDB
- **Conversation Management** - Organized chat history

### 👥 Intelligent Contact Management
- **Auto-Contact Addition** - Automatic contact creation when users message each other
- **Conversation Consistency** - Seamless contact-to-chat mapping across UI sections
- **Contact Validation** - Prevents duplicate and invalid contacts
- **Bidirectional Management** - Two-way contact relationships
- **Profile Integration** - Click on contact avatars for detailed profiles

### 👤 Enhanced User Experience
- **Profile Customization** - Update profile photo and personal bio
- **Real-time Status** - Online/offline indicators with presence management
- **Conversation Management** - Advanced chat history and organization
- **Group Chat Support** - Full group creation and member management

### 🎨 Modern UI/UX
- **Clean Design** - Modern interface with Tailwind CSS
- **Responsive Layout** - Works on desktop and mobile
- **Dark/Light Themes** - Professional color schemes
- **Smooth Animations** - Polished user interactions

## 🚀 Quick Start

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (running locally or cloud instance)
- Redis (for horizontal scaling and message ordering)
- Docker (optional, for containerized deployment)

### Installation Options

#### Option 1: Full Enterprise Setup (Recommended)
1. **Clone and install dependencies**
   ```bash
   # Install server dependencies
   cd server && npm install
   
   # Install client dependencies  
   cd ../client && npm install
   ```

2. **Start Required Services**
   ```bash
   # Start MongoDB
   mongod
   
   # Start Redis (required for scaling)
   redis-server
   ```

3. **Environment Configuration**
   ```bash
   # Server environment
   cd server
   cp .env.example .env  # Create from template
   # Update: MONGODB_URI, REDIS_URL, JWT_SECRET, SERVER_ID
   
   # Client environment
   cd ../client
   cp .env.example .env  # Create from template
   # Update REACT_APP_API_URL
   ```

4. **Start the application**
   ```bash
   # Terminal 1: Start server
   cd server && npm start
   
   # Terminal 2: Start client  
   cd client && npm start
   ```

#### Option 2: Horizontal Scaling Setup
```bash
# Start multiple server instances for load balancing
# Terminal 1: Server instance 1
cd server && SERVER_ID="server-1" PORT=8000 npm start

# Terminal 2: Server instance 2  
cd server && SERVER_ID="server-2" PORT=8001 npm start

# Terminal 3: Client
cd client && npm start
```

#### Option 3: Development Mode
```bash
# Start required services
mongod & redis-server &

# Start server in development mode
cd server && npm run dev

# Start client
cd client && npm start
```

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
│   (Port 3000)   │    │  (HAProxy/Nginx) │    │ (server-1, -2,  │
│                 │    │                 │    │    -3, etc.)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                              ▼                         ▼                         ▼
                    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
                    │   Server 1      │◄─────►│     Redis       │◄─────►│   Server 2      │
                    │   (Socket.IO)   │       │  (Coordination)  │       │   (Socket.IO)   │
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

### Available Scripts

#### Server Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests (if configured)
```

#### Client Scripts  
```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run eject      # Eject from Create React App
```

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

## 🐛 Enterprise Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check if Redis is running
   redis-cli ping  # Should return "PONG"
   
   # Start Redis if needed
   redis-server
   ```

2. **Message Ordering Issues**
   ```bash
   # Check Redis sequence counters
   redis-cli keys "seq:*"
   redis-cli get "seq:conversation_id"
   ```

3. **Cross-Server Communication Problems**
   ```bash
   # Monitor Redis pub/sub channels
   redis-cli monitor
   redis-cli subscribe broadcast
   ```

4. **MongoDB Connection Failed**
   ```bash
   # Check if MongoDB is running
   sudo systemctl status mongod  # Linux
   brew services list | grep mongodb  # macOS
   ```

5. **Horizontal Scaling Issues**
   - Verify each server has unique SERVER_ID
   - Check Redis connectivity from all servers
   - Ensure load balancer forwards WebSocket connections

6. **Message Duplication Problems**
   - Check localStorage for duplicate message IDs
   - Verify sequence numbers in MongoDB
   - Monitor duplicate prevention logs

### Production Monitoring

```bash
# Check Redis health
redis-cli info replication

# Monitor MongoDB performance  
mongosh --eval "db.runCommand({serverStatus: 1})"

# Check server logs
tail -f server.log | grep "ERROR\|duplicate\|order"

# Test API endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/redis/status
```

### Useful Commands

```bash
# Check running processes
ps aux | grep node

# View MongoDB logs
tail -f /var/log/mongodb/mongod.log

# Test API endpoints
curl http://localhost:8000/health
```

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