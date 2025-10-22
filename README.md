# Chatter 💬

A real-time chat app that actually works! Built with modern tech and ready to scale.

## What's Cool About It

- **Real-time messaging** - Messages appear instantly, no page refresh needed
- **Presence system** - See who's online/offline (green dots are satisfying!)
- **Group chats** - Create groups, add/remove people, the usual stuff
- **Phone auth** - Simple login with your phone number
- **Scales easily** - Add more servers when you get popular

## Tech Stack

- **Frontend**: React (the UI)
- **Backend**: Node.js + Socket.IO (real-time magic)
- **Database**: MongoDB (for storing everything)
- **Messaging**: NATS (keeps servers in sync)
- **Presence**: Redis (tracks who's online)
- **Deploy**: Kubernetes + Helm (runs anywhere)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Users        │───▶│   Ingress       │───▶│   Load Balancer │
│   (Browsers)    │    │  (nginx/traefik)│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                               ┌────────────────────────┼────────────────────────┐
                               │                        │                        │
                               ▼                        ▼                        ▼
                    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
                    │   Client Pod    │    │   Client Pod    │    │   Client Pod    │
                    │   (React App)   │    │   (React App)   │    │   (React App)   │
                    │   Port: 3000    │    │   Port: 3000    │    │   Port: 3000    │
                    └─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │                        │
                               └────────────────────────┼────────────────────────┘
                                                        │
                               ┌────────────────────────┼────────────────────────┐
                               │                        │                        │
                               ▼                        ▼                        ▼
                    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
                    │   Server Pod 1  │    │   Server Pod 2  │    │   Server Pod 3  │
                    │   (Node.js API) │    │   (Node.js API) │    │   (Node.js API) │
                    │   Port: 8000    │    │   Port: 8000    │    │   Port: 8000    │
                    └─────────────────┘    └─────────────────┘    └─────────────────┘
                               │                        │                        │
                               └────────────────────────┼────────────────────────┘
                                                        │
                               ┌────────────────────────┼────────────────────────┐
                               │                        │                        │
                               ▼                        ▼                        ▼
                    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
                    │     NATS        │◄──▶│     Redis       │    │    MongoDB      │
                    │  (Messaging)    │    │  (Presence)     │    │  (Database)     │
                    │  Port: 4222     │    │  Port: 6379     │    │  Port: 27017    │
                    │                 │    │                 │    │                 │
                    │ • Syncs all     │    │ • User presence │    │ • Messages      │
                    │   server pods   │    │ • Session data  │    │ • Users/Groups  │
                    │ • Real-time     │    │ • Scaling info  │    │ • Conversations │
                    │   coordination  │    │                 │    │                 │
                    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Multi-Server Magic:**
1. **Any user** can connect to **any server pod** through the load balancer
2. **NATS** keeps all server pods synchronized in real-time
3. **User A** on Server Pod 1 can chat with **User B** on Server Pod 3 seamlessly
4. **Redis** tracks which users are online across all pods
5. **Auto-scaling** adds more server pods when traffic increases
6. **Zero downtime** - if one pod crashes, others keep running

## How to Run

### Development (Local)
```bash
# You'll need MongoDB, Redis, and NATS running locally
# Then start the server
cd server
npm install
npm start

# In another terminal, start the client  
cd client
npm install
npm start

# Visit http://localhost:3000
```

### Production (Kubernetes)
```bash
# Build and push images
cd client && docker build -t your-registry/client .
cd ../server && docker build -t your-registry/server .

# Deploy with Helm
helm install chat-client ./helm/client
helm install chat-server ./helm/server

# Check your ingress for the URL
kubectl get ingress
```

## Project Structure

```
chatter/
├── client/          # React app (the pretty UI)
├── server/          # Node.js backend (the brains)
└── helm/            # Kubernetes configs (for the cloud)
```
## Features That Just Work

- **Instant messaging** - Your messages show up immediately
- **Online status** - Green dot = online, gray = offline  
- **Group chats** - Create groups, add friends, chat together
- **Contact management** - Add people by phone number
- **Works offline** - Messages saved locally, sync when back online
- **Scales up** - Add more servers when you need them

## Development

Want to add features? Here's what you need to know:

### Main API Routes
```bash
POST /api/register    # Sign up with phone + name
POST /api/login       # Login with phone
GET /api/contacts     # Get your contacts  
POST /api/message     # Send a message
GET /api/conversations # Get your chats
```

### Environment Variables
```bash
# Client (.env)
REACT_APP_INGRESS_DOMAIN=http://your-domain.com

# Server (.env)  
MONGODB_URI=mongodb://your-mongo
NATS_URL=nats://your-nats-server
REDIS_URL=redis://your-redis
```

That's pretty much it! The app handles the complicated stuff so you don't have to.

---

*Built with ❤️ and way too much coffee*
- [ ] **Message Encryption** - End-to-end encryption for messages
- [ ] **File Sharing** - Image and document sharing with Redis coordination
- [ ] **Push Notifications** - Browser notifications with offline support
- [ ] **Message Reactions** - Emoji reactions with real-time sync
- [ ] **Voice/Video Calls** - WebRTC integration with signaling server
- [ ] **Message Threading** - Reply chains and conversation threading
- [ ] **Advanced Admin Controls** - User management and moderation tools
- [ ] **Message Search** - Full-text search across conversations
- [ ] **Custom Status** - User presence with custom status messages
- [ ] **Mobile App** - React Native with same NATS backend
- [ ] **NATS Cluster** - High availability NATS deployment
- [ ] **MongoDB Sharding** - Database scaling for large deployments

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Socket.IO for real-time communication and scaling capabilities
- NATS for enterprise-grade message ordering and horizontal scaling
- MongoDB for reliable, scalable data storage
- Tailwind CSS for beautiful, responsive styling
- React team for the powerful frontend framework
- Node.js community for excellent backend ecosystem

---

## 📋 Technical Summary

This chat application demonstrates enterprise-level software engineering with:
- **Simple phone-based authentication** - No complex OAuth setup required
- **Zero message duplication** through multi-layer prevention
-- **Guaranteed message ordering** via NATS-based distributed event bus
- **True horizontal scaling** supporting unlimited server instances without Kubernetes
- **Auto-contact management** for seamless user experience
- **localStorage-first architecture** with intelligent synchronization
- **Production-ready monitoring** and health check endpoints

The system is ready for production deployment with comprehensive error handling, monitoring, and horizontal scaling capabilities using simple NATS coordination.