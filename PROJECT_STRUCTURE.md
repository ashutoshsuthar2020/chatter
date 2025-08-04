# Project Structure

```
chatter/
├── 📁 client/                          # React Frontend
│   ├── 📁 public/                      # Static assets
│   ├── 📁 src/
│   │   ├── 📁 components/              # Reusable UI components
│   │   │   ├── Button/index.jsx        # Custom button component
│   │   │   ├── Input/index.jsx         # Custom input component
│   │   │   ├── ContactManager/index.jsx # Contact management logic
│   │   │   └── GoogleSignInButton/index.jsx # Google OAuth button
│   │   ├── 📁 modules/                 # Main application modules
│   │   │   ├── Dashboard/index.jsx     # Main chat interface
│   │   │   └── Forms/index.jsx         # Authentication forms
│   │   ├── App.js                      # Main app component & routing
│   │   ├── index.js                    # React app entry point
│   │   ├── index.css                   # Global styles with Tailwind
│   │   └── config.js                   # API configuration
│   ├── .env                            # Environment variables
│   ├── package.json                    # Dependencies & scripts
│   ├── tailwind.config.js              # Tailwind CSS configuration
│   └── postcss.config.js               # PostCSS configuration
│
├── 📁 server/                          # Node.js Backend
│   ├── 📁 db/
│   │   └── connection.js               # MongoDB connection
│   ├── 📁 models/                      # Database models
│   │   ├── Users.js                    # User schema
│   │   ├── Contacts.js                 # Contact relationships
│   │   ├── Conversations.js            # Chat conversations
│   │   └── Messages.js                 # Chat messages
│   ├── app.js                          # Express server & Socket.IO
│   ├── .env                            # Server environment variables
│   └── package.json                    # Server dependencies
│
├── 📄 README.md                        # Project documentation
├── 📄 CONTACT_MANAGEMENT.md            # Contact system documentation
├── 📄 GOOGLE_OAUTH_SETUP.md            # OAuth setup guide
└── 📄 .gitignore                       # Git ignore rules
```

## Architecture Overview

### Frontend (React)
- **Modern React 18** with functional components and hooks
- **Tailwind CSS** for styling with custom design system
- **Socket.IO Client** for real-time communication
- **Google OAuth** integration for authentication
- **React Router** for navigation

### Backend (Node.js)
- **Express.js** server with REST API endpoints
- **Socket.IO** for real-time bidirectional communication
- **MongoDB** with Mongoose ODM for data persistence
- **JWT** authentication with Google OAuth support
- **CORS** configured for cross-origin requests

### Database (MongoDB)
- **Users** - User accounts with Google OAuth support
- **Contacts** - User-specific contact relationships
- **Conversations** - Chat conversation metadata
- **Messages** - Individual chat messages with timestamps

### Key Features
- ✅ Real-time messaging
- ✅ Google OAuth authentication
- ✅ Personal contact management
- ✅ Conversation history
- ✅ Online status indicators
- ✅ Message persistence
- ✅ Responsive design
