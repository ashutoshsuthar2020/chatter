# Chatter - Real-time Chat Application

A modern real-time chat application built with React, Node.js, Socket.IO, and MongoDB, featuring Google OAuth integration and personalized contact management.

## ✨ Features

### 🔐 Authentication & Security
- **Google OAuth Integration** - Secure sign-in with Google accounts
- **JWT-based Authentication** - Secure token-based authentication
- **Session Management** - Automatic session handling and logout

### 💬 Real-time Communication
- **Instant Messaging** - Real-time message delivery with Socket.IO
- **Online Status** - Live online/offline indicators
- **Message Persistence** - All messages stored in MongoDB
- **Conversation Management** - Organized chat history

### 👥 Contact Management
- **Personal Contact Lists** - Add contacts by email address
- **Contact Validation** - Prevents duplicate and invalid contacts
- **Remove Contacts** - Easy contact list management
- **Delete Conversations** - Permanently remove chat history

### 🎨 Modern UI/UX
- **Clean Design** - Modern interface with Tailwind CSS
- **Responsive Layout** - Works on desktop and mobile
- **Dark/Light Themes** - Professional color schemes
- **Smooth Animations** - Polished user interactions
- **Google Profile Integration** - Display profile pictures from Google

## 🚀 Quick Start

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (running locally, cloud instance, or Kubernetes)
- Google Cloud Console project (for OAuth - see [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md))
- Docker (optional, for containerized deployment)
- Kubernetes cluster (optional, for K8s deployment)

### Installation Options

#### Option 1: Traditional Setup
1. **Clone and install dependencies**
   ```bash
   # Install server dependencies
   cd server && npm install
   
   # Install client dependencies  
   cd ../client && npm install
   ```

2. **Environment Configuration**
   ```bash
   # Server environment
   cd server
   cp .env.example .env  # Create from template
   # Update MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID
   
   # Client environment
   cd ../client
   cp .env.example .env  # Create from template
   # Update REACT_APP_GOOGLE_CLIENT_ID, REACT_APP_API_URL
   ```

3. **Start the application**
   ```bash
   # Terminal 1: Start server
   cd server && npm start
   
   # Terminal 2: Start client  
   cd client && npm start
   ```

#### Option 2: Kubernetes Deployment
Deploy your backend to Kubernetes for production scalability:

```bash
# Update secrets with your values
cd k8s
# Edit secrets.yaml with base64 encoded values

# Deploy to Kubernetes
./deploy.sh

# Access your API
kubectl port-forward service/chatter-server-service 8000:8000
```

For detailed K8s deployment instructions, see [k8s/README.md](./k8s/README.md).

#### Option 3: Local Development
```bash
# Start MongoDB (if running locally)
mongod

# Start server in development mode
cd server && npm run dev

# Start client
cd client && npm start
```

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React 18 + Tailwind CSS + Socket.IO Client
- **Backend**: Node.js + Express.js + Socket.IO Server
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Google OAuth 2.0 + JWT
- **Real-time**: WebSocket connections via Socket.IO
- **Deployment**: Docker + Kubernetes ready

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │◄──►│  Load Balancer  │◄──►│  Node.js Server │
│   (Port 3000)   │    │   (Kubernetes)  │    │   (Port 8000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │              WebSocket Connection            │
         └──────────────────────────────────────────────┘
                                │
                      ┌─────────▼────────┐
                      │    MongoDB       │
                      │   Database       │
                      └──────────────────┘
```

## 🚀 Deployment Options

### Local Development
Perfect for development and testing:
- MongoDB running locally
- Node.js server on port 8000
- React client on port 3000/3001

### Kubernetes Production
Enterprise-ready deployment with:
- **Auto-scaling**: 2-10 pods based on CPU/Memory
- **High Availability**: Multiple replicas with load balancing  
- **Health Monitoring**: Liveness and readiness probes
- **Resource Management**: CPU/Memory limits and requests
- **Security**: Secrets management and RBAC

See [k8s/README.md](./k8s/README.md) for detailed deployment instructions.

## 🔧 Configuration

### Environment Variables

#### Server (.env)
```bash
PORT=8000
MONGODB_URI=mongodb://localhost:27017/chatter
JWT_SECRET=your-super-secret-jwt-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
NODE_ENV=development
```

#### Client (.env)
```bash
REACT_APP_GOOGLE_CLIENT_ID=your-google-oauth-client-id
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=http://localhost:8000
```

## 📁 Project Structure

```
chatter/
├── 📁 client/                 # React Frontend Application
│   ├── src/
│   │   ├── components/        # Reusable UI Components
│   │   ├── modules/           # Main App Modules (Dashboard, Forms)
│   │   └── config.js          # API Configuration
│   └── package.json
├── 📁 server/                 # Node.js Backend Application  
│   ├── models/                # MongoDB Data Models
│   ├── db/                    # Database Connection
│   ├── app.js                 # Express Server + Socket.IO
│   └── package.json
├── 📁 k8s/                    # Kubernetes Deployment Files
│   ├── deployment.yaml        # K8s Deployment Manifest
│   ├── service.yaml           # K8s Service Configuration
│   ├── secrets.yaml           # Encrypted Configuration
│   └── deploy.sh              # Automated Deployment Script
└── 📄 Documentation Files
```

## 🌟 Key Features Explained

### Real-time Messaging
- **WebSocket Connection**: Persistent connection for instant messaging
- **Message Delivery**: Real-time message delivery with confirmation
- **Online Status**: Live indicators showing who's online/offline
- **Message History**: Persistent storage with conversation threads

### Contact Management System
- **Personal Contacts**: Users manage their own contact lists
- **Email-based Adding**: Add contacts by email address
- **Contact Validation**: Prevents duplicates and invalid entries
- **Easy Removal**: One-click contact removal with confirmation

### Authentication & Security
- **Google OAuth**: Secure authentication with Google accounts
- **JWT Tokens**: Stateless authentication with signed tokens
- **Session Management**: Automatic login/logout handling
- **Profile Integration**: Google profile pictures and information

### Modern UI/UX
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Responsive Design**: Works perfectly on desktop and mobile
- **Clean Interface**: Modern, professional design with smooth animations
- **Real-time Updates**: Instant UI updates without page refreshes

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

#### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `POST /api/login/google` - Google OAuth login
- `POST /api/register/google` - Google OAuth registration

#### Contact Management
- `GET /api/contacts/:userId` - Get user's contacts
- `POST /api/contacts` - Add new contact by email
- `DELETE /api/contacts/:contactId` - Remove contact

#### Messaging
- `GET /api/conversations/:userId` - Get user's conversations
- `GET /api/message/:conversationId` - Get conversation messages
- `POST /api/message` - Send new message
- `DELETE /api/conversations/:conversationId` - Delete conversation

#### Utilities
- `GET /health` - Health check endpoint (for K8s)
- `GET /api/users/:userId` - Get available users

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check if MongoDB is running
   sudo systemctl status mongod  # Linux
   brew services list | grep mongodb  # macOS
   ```

2. **Port Already in Use**
   ```bash
   # Kill process using port 8000
   lsof -ti:8000 | xargs kill -9
   ```

3. **Google OAuth Issues**
   - Verify client ID in both server and client `.env` files
   - Check authorized origins in Google Cloud Console
   - See [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)

4. **Real-time Messages Not Working**
   - Check WebSocket connection in browser dev tools
   - Verify CORS settings in server configuration
   - Ensure both client and server are running

### Useful Commands

```bash
# Check running processes
ps aux | grep node

# View MongoDB logs
tail -f /var/log/mongodb/mongod.log

# Test API endpoints
curl http://localhost:8000/health

# Check Kubernetes deployment
kubectl get pods -l app=chatter-server
```

## 📚 Additional Documentation

- [Contact Management System](./CONTACT_MANAGEMENT.md) - Detailed guide to the contact system
- [Google OAuth Setup](./GOOGLE_OAUTH_SETUP.md) - Complete OAuth configuration guide  
- [Kubernetes Deployment](./k8s/README.md) - Production deployment with K8s
- [Project Structure](./PROJECT_STRUCTURE.md) - Detailed architecture overview

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🔮 Future Enhancements

- [ ] **Group Chat Support** - Multi-user chat rooms
- [ ] **Message Encryption** - End-to-end encryption for messages
- [ ] **File Sharing** - Image and document sharing
- [ ] **Push Notifications** - Browser notifications for new messages
- [ ] **Message Reactions** - Emoji reactions to messages
- [ ] **Voice/Video Calls** - WebRTC integration for calls
- [ ] **Chat Themes** - Customizable chat interface themes
- [ ] **Message Search** - Full-text search across conversations
- [ ] **User Status** - Custom status messages and presence
- [ ] **Mobile App** - React Native mobile application

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Socket.IO for real-time communication
- Google OAuth for secure authentication
- Tailwind CSS for beautiful styling
- MongoDB for reliable data storage
- React team for the amazing framework
