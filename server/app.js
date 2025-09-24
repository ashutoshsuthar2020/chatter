// declare function require(name:string);
require('dotenv').config();
const express = require('express');
const PORT = process.env.PORT || 8000;
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Import services
const redisService = require('./services/redisService');
const messageQueueService = require('./services/messageQueueService');
const MessageDeliveryService = require('./services/messageDeliveryService');

// app Use[/]
const app = express();

// Configure CORS with dynamic origins for development
const corsOptions = {
    origin: function (origin, callback) {
        console.log('CORS check for origin:', origin);

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            console.log('CORS: Allowing request with no origin');
            return callback(null, true);
        }

        const isDevelopment = process.env.NODE_ENV !== 'production';

        if (isDevelopment) {
            // Allow localhost and LAN IPs in dev
            const devPatterns = [
                /^https?:\/\/localhost(:\d+)?$/,
                /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
                /^https?:\/\/0\.0\.0\.0(:\d+)?$/,
                /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
                /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
                /^https?:\/\/172\.1[6-9]\.\d+\.\d+(:\d+)?$/,
                /^https?:\/\/172\.2[0-9]\.\d+\.\d+(:\d+)?$/,
                /^https?:\/\/172\.3[0-1]\.\d+\.\d+(:\d+)?$/
            ];

            if (devPatterns.some(pattern => pattern.test(origin))) {
                console.log('CORS: Allowing development origin:', origin);
                return callback(null, true);
            }
        }

        // Production or specific origins whitelist
        const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://0.0.0.0:3000'
        ];

        if (allowedOrigins.includes(origin)) {
            console.log('CORS: Allowing specific origin:', origin);
            return callback(null, true);
        }

        // If origin not allowed and in development, allow anyway but log it
        if (isDevelopment) {
            console.log('CORS: Development mode - allowing blocked origin anyway:', origin);
            return callback(null, true);
        }

        // Otherwise block it
        console.log('CORS: BLOCKING origin:', origin);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Accept-Language']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increase limit for image uploads
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add debugging middleware for CORS
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'}`);
    next();
});



// Create HTTP server and attach Socket.IO to the same port
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: function (origin, callback) {
            console.log('Socket.IO CORS check for origin:', origin);

            if (!origin) {
                console.log('Socket.IO CORS: Allowing request with no origin');
                return callback(null, true);
            }

            const isDevelopment = process.env.NODE_ENV !== 'production';
            const allowedOrigins = [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://0.0.0.0:3000'
            ];

            if (isDevelopment) {
                console.log('Socket.IO CORS: Development mode - allowing origin:', origin);
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                console.log('Socket.IO CORS: Allowing production origin:', origin);
                return callback(null, true);
            }

            console.log('Socket.IO CORS: BLOCKING origin in production:', origin);
            return callback(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Initialize message delivery service
const messageDeliveryService = new MessageDeliveryService(io);

// connect database
require('./db/connection');

// Import Files
const Users = require('./models/Users');
const bcrypt = require('bcryptjs');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');
const Contacts = require('./models/Contacts');
const Groups = require('./models/Groups');
const GroupConversations = require('./models/GroupConversations');
const ReadReceipts = require('./models/ReadReceipts');
// const { Socket } = require('socket.io');



// Helper function to get updated conversations list for a user
const getUpdatedConversations = async (userId) => {
    try {
        // Get regular conversations
        const regularConversations = await Conversations.find({
            members: { $in: [userId] }
        }).sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

        // Get group conversations
        const groupConversations = await GroupConversations.find({
            members: { $in: [userId] }
        }).populate('groupId', 'name profilePicture members').sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

        const allConversations = [];

        // Add regular conversations with their timestamps and unread counts
        for (const conversation of regularConversations) {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            if (user) {
                // Get unread count
                const unreadCount = await getUnreadCount(userId, conversation._id.toString(), false);

                allConversations.push({
                    type: 'regular',
                    timestamp: conversation.lastMessage?.timestamp || conversation.updatedAt,
                    data: {
                        user: { receiverId: user._id, fullName: user.fullName },
                        conversationId: conversation._id,
                        isGroup: false,
                        lastMessage: conversation.lastMessage,
                        unreadCount: unreadCount
                    }
                });
            }
        }

        // Add group conversations with their timestamps and unread counts
        for (const groupConversation of groupConversations) {
            if (groupConversation.groupId) {
                // Get unread count
                const unreadCount = await getUnreadCount(userId, groupConversation._id.toString(), true);

                allConversations.push({
                    type: 'group',
                    timestamp: groupConversation.lastMessage?.timestamp || groupConversation.updatedAt,
                    data: {
                        conversationId: groupConversation._id,
                        isGroup: true,
                        group: {
                            id: groupConversation.groupId._id,
                            name: groupConversation.groupId.name,
                            profilePicture: groupConversation.groupId.profilePicture,
                            memberCount: groupConversation.groupId.members.length
                        },
                        lastMessage: groupConversation.lastMessage,
                        unreadCount: unreadCount
                    }
                });
            }
        }

        // Sort all conversations by timestamp (most recent first)
        allConversations.sort((a, b) => {
            const timeA = new Date(a.timestamp);
            const timeB = new Date(b.timestamp);
            return timeB - timeA; // Most recent first
        });

        // Extract the sorted conversation data
        return allConversations.map(conv => conv.data);
    } catch (error) {
        console.error('Error getting updated conversations:', error);
        return [];
    }
};

// Helper function to calculate unread message count for a user in a conversation
const getUnreadCount = async (userId, conversationId, isGroup = false) => {
    try {
        // Get the user's last seen message in this conversation
        const readReceipt = await ReadReceipts.findOne({
            userId: userId,
            conversationId: conversationId
        });

        if (!readReceipt || !readReceipt.lastSeenMessageId) {
            // If no read receipt exists, count all messages in the conversation
            const totalMessages = await Messages.countDocuments({ conversationId: conversationId });
            return totalMessages;
        }

        // Count messages created after the last seen message
        const lastSeenMessage = await Messages.findById(readReceipt.lastSeenMessageId);
        if (!lastSeenMessage) {
            // If last seen message doesn't exist anymore, count all messages
            const totalMessages = await Messages.countDocuments({ conversationId: conversationId });
            return totalMessages;
        }

        // Count messages created after the last seen message timestamp
        const unreadCount = await Messages.countDocuments({
            conversationId: conversationId,
            createdAt: { $gt: lastSeenMessage.createdAt }
        });

        return unreadCount;
    } catch (error) {
        console.error('Error calculating unread count:', error);
        return 0;
    }
};

// Helper function to automatically add contacts when receiving messages
const autoAddContact = async (userId, contactUserId) => {
    try {
        console.log(`Attempting to auto-add contact: userId=${userId}, contactUserId=${contactUserId}`);

        // Check if contact already exists
        const existingContact = await Contacts.findOne({
            userId: userId,
            contactUserId: contactUserId
        });

        if (existingContact) {
            console.log(`Contact already exists between ${userId} and ${contactUserId}`);
            return null; // Contact already exists
        }

        // Get contact user data
        const contactUser = await Users.findById(contactUserId);
        if (!contactUser) {
            console.log(`Contact user not found: ${contactUserId}`);
            return null;
        }

        // Don't add self as contact
        if (userId === contactUserId.toString()) {
            console.log(`Skipping self-contact for user: ${userId}`);
            return null;
        }

        // Create new contact
        const newContact = new Contacts({
            userId: userId,
            contactUserId: contactUserId,
            contactPhoneNumber: contactUser.phoneNumber,
            contactName: contactUser.fullName
        });

        await newContact.save();
        console.log(`Auto-added contact: ${contactUser.fullName} (${contactUserId}) for user ${userId}`);

        return newContact;
    } catch (error) {
        console.error('Error in auto-add contact:', error);
        return null;
    }
};

// Helper function to establish connections for existing conversations/groups when user comes online
const establishExistingConnections = async (userId, socketId) => {
    try {
        console.log(`Establishing existing connections for user: ${userId}`);

        // Get user's regular conversations
        const regularConversations = await Conversations.find({
            members: { $in: [userId] }
        }).populate('members');

        // Get user's group conversations
        const groupConversations = await GroupConversations.find({
            members: { $in: [userId] }
        }).populate('groupId');

        // Notify about regular conversations
        for (const conversation of regularConversations) {
            const otherMember = conversation.members.find(member => member !== userId);
            if (otherMember) {
                const otherUser = await Users.findById(otherMember);
                if (otherUser) {
                    io.to(socketId).emit('conversationConnectionEstablished', {
                        conversationId: conversation._id,
                        with: otherUser._id,
                        withName: otherUser.fullName,
                        isGroup: false
                    });
                }
            }
        }

        // Notify about group conversations
        for (const groupConv of groupConversations) {
            if (groupConv.groupId) {
                const group = await Groups.findById(groupConv.groupId._id)
                    .populate('members.user', 'fullName phoneNumber picture');

                if (group) {
                    io.to(socketId).emit('groupConnectionEstablished', {
                        groupId: group._id,
                        conversationId: groupConv._id,
                        groupName: group.name,
                        members: group.members.map(m => ({
                            id: m.user._id,
                            name: m.user.fullName,
                            role: m.role
                        }))
                    });
                }
            }
        }

        console.log(`Established connections for ${regularConversations.length} conversations and ${groupConversations.length} groups`);
    } catch (error) {
        console.error('Error establishing existing connections:', error);
    }
};

// Socket.io
let users = [] // Keep for backward compatibility, but use Redis for scaling
io.on('connection', socket => {
    socket.on('addUser', async userId => {
        console.log(`User attempting to connect: ${userId} with socket: ${socket.id}`);

        try {
            const IsUserExist = users.find(user => user.userId === userId);
            if (!IsUserExist) {
                const user = { userId, socketId: socket.id };
                users.push(user);

                // Add to message delivery service for local tracking
                messageDeliveryService.setLocalUser(userId, { socketId: socket.id });

                console.log(`User ${userId} connected successfully with socket ${socket.id}`);
                console.log('Active users after connection:', users.map(u => ({ userId: u.userId, socketId: u.socketId })));
                io.emit('getUsers', users);

                // Process any queued messages for this user
                await messageDeliveryService.processUserQueueOnConnect(userId, { socketId: socket.id });

                // Establish connections to existing conversations and groups
                await establishExistingConnections(userId, socket.id);
            } else {
                console.log(`User ${userId} already exists with socket ${IsUserExist.socketId}`);
                // Update socket ID in case it changed
                IsUserExist.socketId = socket.id;
                messageDeliveryService.setLocalUser(userId, { socketId: socket.id });
            }
        } catch (error) {
            console.error(`Error handling user connection for ${userId}:`, error);
        }
    });

    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId, isGroup = false }) => {
        try {
            const user = await Users.findById(senderId);
            console.log('Message received:', { senderId, receiverId, message, conversationId, isGroup });

            // Handle conversation creation if needed for regular messages
            if (!isGroup && (!conversationId || conversationId === 'new') && receiverId) {
                // Create or find conversation between sender and receiver
                let conversation = await Conversations.findOne({
                    members: { $all: [senderId, receiverId] }
                });

                if (!conversation) {
                    conversation = new Conversations({
                        members: [senderId, receiverId]
                    });
                    await conversation.save();
                    console.log(`Created new conversation between ${senderId} and ${receiverId}: ${conversation._id}`);
                }

                conversationId = conversation._id.toString();
            }

            // Skip processing if conversationId is still invalid
            if (!conversationId || conversationId === 'new') {
                console.error('Invalid conversationId after processing:', conversationId);
                return;
            }

            // Prepare message data for ordered delivery
            const messageData = {
                senderId,
                message,
                conversationId,
                receiverId,
                isGroup,
                user: { id: user._id, fullName: user.fullName, phoneNumber: user.phoneNumber }
            };

            if (isGroup) {
                // For group messages, get all group members
                const groupConversation = await GroupConversations.findById(conversationId).populate('groupId');
                if (groupConversation && groupConversation.groupId) {
                    const groupMembers = groupConversation.members.map(member => member.toString());

                    // Use new message delivery service with ordering
                    const result = await messageDeliveryService.sendMessageWithOrdering({
                        ...messageData,
                        groupMembers
                    });

                    console.log(`Group message sent with sequence ${result.sequenceNumber}:`, result.deliveryResults);
                }
            } else {
                // Regular one-on-one messages
                const result = await messageDeliveryService.sendMessageWithOrdering(messageData);
                console.log(`Regular message sent with sequence ${result.sequenceNumber}:`, result.deliveryResults);
            }

        } catch (error) {
            console.error('Error handling sendMessage:', error);
        }
    });

    socket.on('disconnect', () => {
        const disconnectedUser = users.find(user => user.socketId === socket.id);
        users = users.filter(user => user.socketId !== socket.id);
        console.log(`Socket ${socket.id} disconnected`);

        if (disconnectedUser) {
            console.log(`User ${disconnectedUser.userId} disconnected`);

            // Remove from message delivery service
            messageDeliveryService.removeLocalUser(disconnectedUser.userId);
        }

        console.log('Active users after disconnection:', users.map(u => ({ userId: u.userId, socketId: u.socketId })));
        io.emit('getUsers', users);

        // Notify other users about disconnection
        if (disconnectedUser) {
            socket.broadcast.emit('userDisconnected', {
                userId: disconnectedUser.userId
            });
        }
    });
});

app.get('/', (req, res) => {
    res.send('Hello');
})




app.post('/api/login', async (req, res, next) => {
    try {
        const { phoneNumber, password } = req.body;
        if (!phoneNumber || !password) {
            return res.status(400).json({ message: 'Phone number and password are required' });
        }

        const user = await Users.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ message: 'User not found. Please register first.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Update last active time
        await Users.updateOne({ _id: user._id }, {
            $set: { lastActiveAt: new Date() }
        });

        return res.status(200).json({
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                fullName: user.fullName,
                picture: user.picture,
                bio: user.bio
            }
        });

    } catch (error) {
        console.log(error, 'Login Error');
        return res.status(500).json({ message: 'Server error during login' });
    }
});

// Simple Registration Route
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, phoneNumber, password, picture } = req.body;
        if (!fullName || !phoneNumber || !password) {
            return res.status(400).json({ message: 'Full name, phone number, and password are required' });
        }

        const existingUser = await Users.findOne({ phoneNumber });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this phone number' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new Users({
            fullName,
            phoneNumber,
            password: hashedPassword,
            picture: picture || ''
        });

        await newUser.save();

        return res.status(201).json({
            user: {
                id: newUser._id,
                phoneNumber: newUser.phoneNumber,
                fullName: newUser.fullName,
                picture: newUser.picture,
                bio: newUser.bio
            }
        });

    } catch (error) {
        console.log(error, 'Register Error');
        return res.status(500).json({ message: 'Server error during registration' });
    }
});



app.post('/api/conversations', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;

        // Check if conversation already exists
        const existingConversation = await Conversations.findOne({
            members: { $all: [senderId, receiverId] },
            isGroup: { $ne: true } // Exclude group conversations
        });

        if (existingConversation) {
            return res.status(200).json({
                message: 'Conversation already exists',
                conversationId: existingConversation._id
            });
        }

        const newConversation = new Conversations({ members: [senderId, receiverId] });
        await newConversation.save();

        // Auto-establish socket connections for both users
        const senderUser = users.find(u => u.userId === senderId);
        const receiverUser = users.find(u => u.userId === receiverId);

        // Notify both users about the new conversation
        if (senderUser) {
            io.to(senderUser.socketId).emit('conversationCreated', {
                conversationId: newConversation._id,
                with: receiverId,
                isGroup: false
            });
            // Send updated conversation list for real-time sorting
            const updatedConversations = await getUpdatedConversations(senderId);
            io.to(senderUser.socketId).emit('conversationsListUpdated', {
                conversations: updatedConversations,
                action: 'conversationCreated',
                updatedConversationId: newConversation._id.toString()
            });
        }

        if (receiverUser) {
            io.to(receiverUser.socketId).emit('conversationCreated', {
                conversationId: newConversation._id,
                with: senderId,
                isGroup: false
            });
            // Send updated conversation list for real-time sorting
            const updatedConversations = await getUpdatedConversations(receiverId);
            io.to(receiverUser.socketId).emit('conversationsListUpdated', {
                conversations: updatedConversations,
                action: 'conversationCreated',
                updatedConversationId: newConversation._id.toString()
            });
        }

        res.status(200).json({
            message: 'Conversation created successfully',
            conversationId: newConversation._id
        });
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).json({ error: 'Failed to create conversation' });
    }
})

app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '', isGroup = false } = req.body;
        console.log('API message received:', { conversationId, senderId, message, receiverId, isGroup });

        if (!senderId || !message) {
            return res.status(400).send('Please fill all required fields.')
        }

        if (conversationId === 'new' && receiverId && !isGroup) {
            // Check if conversation already exists between these users
            console.log(`Creating new conversation between sender=${senderId} and receiver=${receiverId}`);
            const existingConversation = await Conversations.findOne({
                members: { $all: [senderId, receiverId] },
                isGroup: { $ne: true } // Exclude group conversations
            });

            let targetConversationId;

            if (existingConversation) {
                // Use existing conversation
                targetConversationId = existingConversation._id;
                console.log(`Using existing conversation: ${targetConversationId}`);
            } else {
                // Create new regular conversation only if none exists
                const newConversation = new Conversations({ members: [senderId, receiverId] });
                await newConversation.save();
                targetConversationId = newConversation._id;
                console.log(`Created new conversation: ${targetConversationId}`);

                // Auto-establish socket connections for both users
                const senderUser = users.find(u => u.userId === senderId);
                const receiverUser = users.find(u => u.userId === receiverId);

                // Notify both users about the new conversation
                if (senderUser) {
                    io.to(senderUser.socketId).emit('conversationCreated', {
                        conversationId: targetConversationId,
                        with: receiverId,
                        isGroup: false
                    });
                }

                if (receiverUser) {
                    io.to(receiverUser.socketId).emit('conversationCreated', {
                        conversationId: targetConversationId,
                        with: senderId,
                        isGroup: false
                    });
                }
            }

            const newMessage = new Messages({ conversationId: targetConversationId, senderId, message });
            await newMessage.save();

            // Update last message in conversation
            await Conversations.findByIdAndUpdate(targetConversationId, {
                'lastMessage.message': message,
                'lastMessage.sender': senderId,
                'lastMessage.timestamp': new Date()
            });

            // Auto-add contacts for both sender and receiver in "new" conversation scenario
            console.log(`Auto-adding contacts for new conversation: sender=${senderId}, receiver=${receiverId}`);
            await autoAddContact(receiverId, senderId); // Add sender to receiver's contacts
            await autoAddContact(senderId, receiverId); // Add receiver to sender's contacts

            // Real-time delivery for new conversation
            const sender = await Users.findById(senderId);
            const messageData = {
                messageId: newMessage._id.toString(),
                senderId,
                message,
                conversationId: targetConversationId.toString(), // Convert ObjectId to string
                receiverId,
                isGroup: false,
                user: { id: sender._id.toString(), fullName: sender.fullName, phoneNumber: sender.phoneNumber }
            };

            console.log('NEW CONVERSATION - Message data being sent:', messageData);

            // Send to both sender and receiver
            const receiverUser = users.find(user => user.userId === receiverId);
            const senderUser = users.find(user => user.userId === senderId);

            if (senderUser) {
                console.log(`NEW CONV: Emitting getMessage to sender ${senderId} via socket ${senderUser.socketId}`);
                io.to(senderUser.socketId).emit('getMessage', messageData);
                // Notify sender to refresh conversation list for proper sorting
                io.to(senderUser.socketId).emit('conversationUpdated', {
                    conversationId: targetConversationId.toString(),
                    lastMessage: {
                        message: message,
                        sender: senderId,
                        timestamp: new Date()
                    }
                });
                // Send updated conversation list for real-time sorting
                const updatedConversations = await getUpdatedConversations(senderId);
                console.log(`NEW CONV: Emitting conversationsListUpdated to sender ${senderId} with ${updatedConversations.length} conversations`);
                io.to(senderUser.socketId).emit('conversationsListUpdated', {
                    conversations: updatedConversations,
                    action: 'messageSent',
                    updatedConversationId: targetConversationId.toString()
                });
            }
            if (receiverUser && receiverUser.socketId !== senderUser?.socketId) {
                console.log(`NEW CONV: Emitting getMessage to receiver ${receiverId} via socket ${receiverUser.socketId}`);
                io.to(receiverUser.socketId).emit('getMessage', messageData);

                // Also notify the receiver about the new conversation so it appears in their chat list
                io.to(receiverUser.socketId).emit('conversationCreated', {
                    conversationId: targetConversationId.toString(),
                    with: senderId,
                    isGroup: false
                });

                // Notify about new message from new contact (in case frontend needs to update UI)
                io.to(receiverUser.socketId).emit('newContactMessage', {
                    senderId: senderId,
                    senderName: sender.fullName,
                    message: message,
                    conversationId: targetConversationId.toString(),
                    isNewConversation: !existingConversation
                });

                // Notify receiver to refresh conversation list for proper sorting
                io.to(receiverUser.socketId).emit('conversationUpdated', {
                    conversationId: targetConversationId.toString(),
                    lastMessage: {
                        message: message,
                        sender: senderId,
                        timestamp: new Date()
                    }
                });
                // Send updated conversation list for real-time sorting
                const updatedConversations = await getUpdatedConversations(receiverId);
                console.log(`NEW CONV: Emitting conversationsListUpdated to receiver ${receiverId} with ${updatedConversations.length} conversations`);
                io.to(receiverUser.socketId).emit('conversationsListUpdated', {
                    conversations: updatedConversations,
                    action: 'messageReceived',
                    updatedConversationId: targetConversationId.toString()
                });
            }

            return res.status(200).json({
                message: 'Message sent successfully',
                messageId: newMessage._id.toString(),
                conversationId: targetConversationId.toString()
            });
        } else if (!conversationId && !receiverId && !isGroup) {
            return res.status(400).send('Please fill all required fields.')
        }

        // Save message to database
        const newMessage = new Messages({ conversationId, senderId, message });
        await newMessage.save();

        // Update last message in the appropriate conversation type
        if (isGroup) {
            // Update group conversation
            await GroupConversations.findByIdAndUpdate(conversationId, {
                'lastMessage.message': message,
                'lastMessage.sender': senderId,
                'lastMessage.timestamp': new Date()
            });

            // Also update the group's last message
            const groupConversation = await GroupConversations.findById(conversationId);
            if (groupConversation && groupConversation.groupId) {
                await Groups.findByIdAndUpdate(groupConversation.groupId, {
                    'lastMessage.message': message,
                    'lastMessage.sender': senderId,
                    'lastMessage.timestamp': new Date()
                });
            }
        } else {
            // Update regular conversation
            await Conversations.findByIdAndUpdate(conversationId, {
                'lastMessage.message': message,
                'lastMessage.sender': senderId,
                'lastMessage.timestamp': new Date()
            });
        }

        // Real-time message delivery via Socket.IO
        const sender = await Users.findById(senderId);
        const messageData = {
            messageId: newMessage._id.toString(),
            senderId,
            message,
            conversationId: conversationId.toString(), // Convert ObjectId to string for consistency
            receiverId,
            isGroup,
            user: { id: sender._id.toString(), fullName: sender.fullName, phoneNumber: sender.phoneNumber }
        };

        if (isGroup) {
            // For group messages, get all group members and send to all online members
            console.log('Processing group message via API');
            console.log('Looking for conversation with ID:', conversationId);

            // Ensure conversationId is a proper ObjectId
            const mongoose = require('mongoose');
            if (!mongoose.Types.ObjectId.isValid(conversationId)) {
                console.log('Invalid conversationId format:', conversationId);
                return res.status(400).send('Invalid conversation ID');
            }

            const conversation = await GroupConversations.findById(conversationId);
            console.log('Found group conversation:', conversation);

            if (conversation) {
                console.log('Conversation members:', conversation.members);

                const groupMembers = conversation.members;

                // Auto-add contacts for all group members
                for (const memberId of groupMembers) {
                    const memberIdString = memberId.toString();
                    if (memberIdString !== senderId) {
                        await autoAddContact(memberIdString, senderId);
                        await autoAddContact(senderId, memberIdString);
                    }
                }

                // Send to all online group members
                console.log('Active users array:', users.map(u => ({ userId: u.userId, socketId: u.socketId })));
                for (const memberId of groupMembers) {
                    // Convert ObjectId to string for comparison
                    const memberIdString = memberId.toString();
                    const member = users.find(user => user.userId === memberIdString);
                    console.log(`Checking member ${memberIdString}:`, member ? `online (socket: ${member.socketId})` : 'offline');
                    if (member) {
                        console.log(`Emitting getMessage to ${memberIdString} via socket ${member.socketId}`);
                        console.log('Message data being sent:', messageData);
                        io.to(member.socketId).emit('getMessage', messageData);
                        // Send updated conversation list for real-time sorting
                        const updatedConversations = await getUpdatedConversations(memberIdString);
                        console.log(`API Group: Emitting conversationsListUpdated to ${memberIdString} with ${updatedConversations.length} conversations`);
                        io.to(member.socketId).emit('conversationsListUpdated', {
                            conversations: updatedConversations,
                            action: 'messageReceived',
                            updatedConversationId: conversationId.toString()
                        });
                    } else {
                        console.log(`API Group: Member ${memberIdString} is not online`);
                    }
                }
            } else {
                console.log('No group conversation found with ID:', conversationId);
                // Let's try to find the group conversation with a different approach
                const allGroupConversations = await GroupConversations.find({});
                console.log('All group conversations in database:', allGroupConversations.map(c => ({ id: c._id.toString(), groupId: c.groupId, members: c.members })));
            }
        } else {
            // Regular one-on-one message
            console.log('Processing regular message via API');
            console.log('Active users array:', users.map(u => ({ userId: u.userId, socketId: u.socketId })));
            console.log('Looking for sender:', senderId, 'and receiver:', receiverId);

            const receiverUser = users.find(user => user.userId === receiverId);
            const senderUser = users.find(user => user.userId === senderId);

            console.log('Found sender user:', senderUser ? `online (socket: ${senderUser.socketId})` : 'offline');
            console.log('Found receiver user:', receiverUser ? `online (socket: ${receiverUser.socketId})` : 'offline');

            // Auto-add contacts for both sender and receiver
            console.log(`Auto-adding contacts for regular message: sender=${senderId}, receiver=${receiverId}`);
            await autoAddContact(receiverId, senderId); // Add sender to receiver's contacts
            await autoAddContact(senderId, receiverId); // Add receiver to sender's contacts

            console.log('REGULAR MESSAGE - Message data being sent:', messageData);

            // Always emit to sender for confirmation
            if (senderUser) {
                console.log(`API Regular: Emitting getMessage to sender ${senderId} via socket ${senderUser.socketId}`);
                io.to(senderUser.socketId).emit('getMessage', messageData);
                // Notify sender to refresh conversation list for proper sorting
                io.to(senderUser.socketId).emit('conversationUpdated', {
                    conversationId: conversationId.toString(),
                    lastMessage: {
                        message: message,
                        sender: senderId,
                        timestamp: new Date()
                    }
                });
                // Send updated conversation list for real-time sorting
                const updatedConversations = await getUpdatedConversations(senderId);
                console.log(`API Regular: Emitting conversationsListUpdated to sender ${senderId} with ${updatedConversations.length} conversations`);
                io.to(senderUser.socketId).emit('conversationsListUpdated', {
                    conversations: updatedConversations,
                    action: 'messageSent',
                    updatedConversationId: conversationId.toString()
                });
            } else {
                console.log(`API Regular: Sender ${senderId} is not online`);
            }

            // Emit to receiver if they're online
            if (receiverUser && receiverUser.socketId !== senderUser?.socketId) {
                console.log(`API Regular: Emitting getMessage to receiver ${receiverId} via socket ${receiverUser.socketId}`);
                io.to(receiverUser.socketId).emit('getMessage', messageData);

                // Also ensure the receiver has this conversation in their chat list
                // This handles cases where the conversation exists but receiver hasn't seen it yet
                io.to(receiverUser.socketId).emit('conversationConnectionEstablished', {
                    conversationId: conversationId.toString(),
                    with: senderId,
                    isGroup: false
                });

                // Notify about incoming message (for UI updates like notification badges)
                io.to(receiverUser.socketId).emit('messageReceived', {
                    senderId: senderId,
                    senderName: sender.fullName,
                    message: message,
                    conversationId: conversationId.toString(),
                    isGroup: false
                });

                // Notify receiver to refresh conversation list for proper sorting
                io.to(receiverUser.socketId).emit('conversationUpdated', {
                    conversationId: conversationId.toString(),
                    lastMessage: {
                        message: message,
                        sender: senderId,
                        timestamp: new Date()
                    }
                });
                // Send updated conversation list for real-time sorting
                const updatedConversations = await getUpdatedConversations(receiverId);
                console.log(`API Regular: Emitting conversationsListUpdated to receiver ${receiverId} with ${updatedConversations.length} conversations`);
                io.to(receiverUser.socketId).emit('conversationsListUpdated', {
                    conversations: updatedConversations,
                    action: 'messageReceived',
                    updatedConversationId: conversationId.toString()
                });
            } else if (receiverUser && receiverUser.socketId === senderUser?.socketId) {
                console.log(`API Regular: Receiver and sender have same socket, not sending duplicate message`);
            } else {
                console.log(`API Regular: Receiver ${receiverId} is not online`);
            }
        }

        res.status(200).json({
            message: 'Message sent successfully',
            messageId: newMessage._id.toString(),
            conversationId: conversationId.toString()
        });
    } catch (error) {
        console.log(error, 'Error')
        res.status(500).send('Failed to send message');
    }
})

app.get('/api/message/:conversationId', async (req, res) => {
    try {
        const checkMessages = async (conversationId) => {
            // console.log('conversationId: >> ',conversationId);
            const messages = await Messages.find({ conversationId }).sort({ createdAt: 1 }); // Sort oldest first for chat history
            const messageUserData = Promise.all(messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return {
                    user: { id: user._id, phoneNumber: user.phoneNumber, fullName: user.fullName },
                    message: message.message,
                    timestamp: message.createdAt,
                    messageId: message._id
                }
            }));
            res.status(200).json({ mssgData: await messageUserData, conversationId: conversationId });
        }
        const conversationId = req.params.conversationId;
        if (conversationId === 'new') {
            const checkConversation = await Conversations.find({ members: { $all: [req.query.senderId, req.query.receiverId] } });
            if (checkConversation.length > 0) {
                checkMessages(checkConversation[0]._id);
            } else {
                return res.status(200).json({ mssgData: [], conversationId: conversationId });
            }
        } else {
            checkMessages(conversationId);
        }
    } catch (error) {
        console.log('Error', error)
    }
})

// Get read receipt for a specific user and conversation
app.get('/api/conversations/:conversationId/read-receipt/:userId', async (req, res) => {
    try {
        const { conversationId, userId } = req.params;

        if (!userId || !conversationId) {
            return res.status(400).json({ error: 'User ID and Conversation ID are required' });
        }

        // Find the read receipt for this user and conversation
        const readReceipt = await ReadReceipts.findOne({
            userId: userId,
            conversationId: conversationId
        });

        if (!readReceipt) {
            return res.status(404).json({ error: 'No read receipt found' });
        }

        res.status(200).json({
            lastSeenMessageId: readReceipt.lastSeenMessageId,
            lastSeenAt: readReceipt.lastSeenAt,
            isGroup: readReceipt.isGroup
        });
    } catch (error) {
        console.error('Error fetching read receipt:', error);
        res.status(500).json({ error: 'Failed to fetch read receipt' });
    }
});

// Mark messages as read when user opens a conversation
app.post('/api/conversations/:conversationId/mark-read', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId, isGroup = false, lastSeenMessageId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        let messageIdToMark;

        if (lastSeenMessageId) {
            // Use the provided message ID (e.g., when user sends a message)
            messageIdToMark = lastSeenMessageId;
            console.log(`Using provided message ID: ${messageIdToMark}`);
        } else {
            // Get the latest message in this conversation (default behavior)
            const latestMessage = await Messages.findOne({ conversationId: conversationId })
                .sort({ createdAt: -1 })
                .select('_id createdAt');

            if (!latestMessage) {
                // No messages in conversation yet
                return res.status(200).json({ message: 'No messages to mark as read' });
            }

            messageIdToMark = latestMessage._id;
            console.log(`Using latest message ID: ${messageIdToMark}`);
        }

        // Update or create read receipt
        await ReadReceipts.findOneAndUpdate(
            {
                userId: userId,
                conversationId: conversationId
            },
            {
                lastSeenMessageId: messageIdToMark,
                lastSeenAt: new Date(),
                isGroup: isGroup
            },
            {
                upsert: true, // Create if doesn't exist
                new: true
            }
        );

        console.log(`Marked conversation ${conversationId} as read for user ${userId} up to message ${messageIdToMark}`);

        // Send updated conversation list to user with new unread counts
        const updatedConversations = await getUpdatedConversations(userId);

        // Find the user's socket and emit updated conversation list
        const userSocket = users.find(u => u.userId === userId);
        if (userSocket) {
            io.to(userSocket.socketId).emit('conversationsListUpdated', {
                conversations: updatedConversations,
                action: 'markedAsRead',
                updatedConversationId: conversationId
            });
        }

        res.status(200).json({
            message: 'Messages marked as read successfully',
            lastSeenMessageId: messageIdToMark
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Contact Management Endpoints

// Get user's contacts
app.get('/api/contacts/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const contacts = await Contacts.find({ userId: userId })
            .populate('contactUserId', 'fullName phoneNumber picture bio')
            .sort({ addedAt: -1 });

        const contactsData = contacts.map(contact => ({
            contactId: contact._id,
            user: {
                phoneNumber: contact.contactUserId.phoneNumber,
                fullName: contact.contactUserId.fullName,
                picture: contact.contactUserId.picture,
                bio: contact.contactUserId.bio,
                receiverId: contact.contactUserId._id
            },
            addedAt: contact.addedAt,
            isBlocked: contact.isBlocked
        }));

        res.status(200).json(contactsData);
    } catch (error) {
        console.log('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

// Add a new contact by phone number
app.post('/api/contacts', async (req, res) => {
    try {
        const { userId, contactPhoneNumber } = req.body;

        if (!userId || !contactPhoneNumber) {
            return res.status(400).json({ error: 'User ID and contact phone number are required' });
        }

        // Find the contact user by phone number
        const contactUser = await Users.findOne({ phoneNumber: contactPhoneNumber });
        if (!contactUser) {
            return res.status(404).json({ error: 'User with this phone number not found' });
        }

        // Check if user is trying to add themselves
        if (contactUser._id.toString() === userId) {
            return res.status(400).json({ error: 'You cannot add yourself as a contact' });
        }

        // Check if contact already exists
        const existingContact = await Contacts.findOne({
            userId: userId,
            contactUserId: contactUser._id
        });

        if (existingContact) {
            return res.status(400).json({ error: 'Contact already exists' });
        }

        // Create new contact
        const newContact = new Contacts({
            userId: userId,
            contactUserId: contactUser._id,
            contactPhoneNumber: contactUser.phoneNumber,
            contactName: contactUser.fullName
        });

        await newContact.save();

        // Populate the contact data for response
        const populatedContact = await Contacts.findById(newContact._id)
            .populate('contactUserId', 'fullName phoneNumber picture');

        res.status(201).json({
            message: 'Contact added successfully',
            contact: {
                contactId: populatedContact._id,
                user: {
                    phoneNumber: populatedContact.contactUserId.phoneNumber,
                    fullName: populatedContact.contactUserId.fullName,
                    picture: populatedContact.contactUserId.picture,
                    receiverId: populatedContact.contactUserId._id
                },
                addedAt: populatedContact.addedAt
            }
        });
    } catch (error) {
        console.log('Error adding contact:', error);
        res.status(500).json({ error: 'Failed to add contact' });
    }
});

// Remove a contact
app.delete('/api/contacts/:contactId', async (req, res) => {
    try {
        const contactId = req.params.contactId;
        const { userId } = req.body;

        // Find and delete the contact
        const contact = await Contacts.findOneAndDelete({
            _id: contactId,
            userId: userId
        });

        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.status(200).json({ message: 'Contact removed successfully' });
    } catch (error) {
        console.log('Error removing contact:', error);
        res.status(500).json({ error: 'Failed to remove contact' });
    }
});

// Delete entire conversation and messages
app.delete('/api/conversations/:conversationId', async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        const { userId } = req.body;

        // Verify the user is part of this conversation
        const conversation = await Conversations.findOne({
            _id: conversationId,
            members: { $in: [userId] }
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found or access denied' });
        }

        // Delete all messages in this conversation
        await Messages.deleteMany({ conversationId: conversationId });

        // Delete the conversation
        await Conversations.findByIdAndDelete(conversationId);

        res.status(200).json({ message: 'Conversation and all messages deleted successfully' });
    } catch (error) {
        console.log('Error deleting conversation:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const users = await Users.find({ _id: { $ne: userId } });
        const usersData = Promise.all(users.map(async (user) => {
            return { user: { fullName: user.fullName, receiverId: user._id } }
        }))
        res.status(200).json(await usersData);
    } catch (error) {
        console.log('Error', error)
    }
})

// Update user profile
app.put('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { fullName, bio, picture } = req.body;

        // Find and update the user
        const updatedUser = await Users.findByIdAndUpdate(
            userId,
            {
                fullName: fullName,
                bio: bio,
                picture: picture
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return the updated user data
        res.status(200).json({
            id: updatedUser._id,
            fullName: updatedUser.fullName,
            bio: updatedUser.bio,
            picture: updatedUser.picture
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Group Chat API Endpoints

// Create a new group
app.post('/api/groups', async (req, res) => {
    try {
        const { name, description, profilePicture, createdBy, members = [] } = req.body;

        if (!name || !createdBy) {
            return res.status(400).json({ message: 'Group name and creator are required' });
        }

        // Create the group with creator as admin and other members as members
        const groupMembers = [
            { user: createdBy, role: 'admin' },
            ...members.map(memberId => ({ user: memberId, role: 'member' }))
        ];

        const newGroup = new Groups({
            name,
            description: description || '',
            profilePicture: profilePicture || '',
            createdBy,
            members: groupMembers
        });

        await newGroup.save();

        // Create a group conversation for this group (separate from regular conversations)
        // Remove duplicates by using Set to avoid adding creator twice if they're in members array
        const allMemberIds = [...new Set([createdBy, ...members])];
        const groupConversation = new GroupConversations({
            groupId: newGroup._id,
            members: allMemberIds
        });

        await groupConversation.save();

        // Populate the group data to return
        const populatedGroup = await Groups.findById(newGroup._id)
            .populate('members.user', 'fullName phoneNumber picture')
            .populate('createdBy', 'fullName phoneNumber picture');

        // Real-time notification: Notify all group members about the new group
        const groupConversationData = {
            conversationId: groupConversation._id,
            isGroup: true,
            group: {
                id: populatedGroup._id,
                name: populatedGroup.name,
                profilePicture: populatedGroup.profilePicture,
                memberCount: populatedGroup.members.length
            }
        };

        // Notify group members (different messages for creator vs members)
        // Also establish immediate socket connections for all members
        allMemberIds.forEach(async (memberId) => {
            const memberIdString = memberId.toString(); // Convert to string for comparison
            const member = users.find(user => user.userId === memberIdString);
            if (member) {
                if (memberIdString === createdBy.toString()) {
                    // Notify creator
                    io.to(member.socketId).emit('groupCreated', {
                        group: populatedGroup,
                        conversation: groupConversationData,
                        message: `Group "${populatedGroup.name}" created successfully`,
                        isCreator: true
                    });
                } else {
                    // Notify other members
                    io.to(member.socketId).emit('groupCreated', {
                        group: populatedGroup,
                        conversation: groupConversationData,
                        message: `You have been added to the group "${populatedGroup.name}"`,
                        isCreator: false
                    });
                }

                // Establish immediate connection for group chat
                io.to(member.socketId).emit('groupConnectionEstablished', {
                    groupId: populatedGroup._id,
                    conversationId: groupConversation._id,
                    groupName: populatedGroup.name,
                    members: populatedGroup.members.map(m => ({
                        id: m.user._id,
                        name: m.user.fullName,
                        role: m.role
                    }))
                });

                // Send updated conversation list for real-time sorting
                const updatedConversations = await getUpdatedConversations(memberIdString);
                io.to(member.socketId).emit('conversationsListUpdated', {
                    conversations: updatedConversations,
                    action: 'groupCreated',
                    updatedConversationId: groupConversation._id.toString()
                });
            }
        });

        res.status(201).json({
            group: populatedGroup,
            conversationId: groupConversation._id
        });

    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ message: 'Failed to create group' });
    }
});

// Get user's groups
app.get('/api/groups/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        const groups = await Groups.find({ 'members.user': userId })
            .populate('members.user', 'fullName phoneNumber picture')
            .populate('createdBy', 'fullName phoneNumber picture')
            .sort({ updatedAt: -1 });

        res.status(200).json(groups);

    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ message: 'Failed to fetch groups' });
    }
});

// Add member to group
app.post('/api/groups/:groupId/members', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId, adminId } = req.body;

        // Check if requester is admin
        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if requester is the creator (admin) or has admin role
        const isCreator = group.createdBy.toString() === adminId;
        const memberWithAdminRole = group.members.find(m => m.user.toString() === adminId && m.role === 'admin');

        if (!isCreator && !memberWithAdminRole) {
            return res.status(403).json({ message: 'Only admins can add members' });
        }

        // Check if user is already a member
        const existingMember = group.members.find(m => m.user.toString() === userId);
        if (existingMember) {
            return res.status(400).json({ message: 'User is already a member' });
        }

        // Check group capacity
        if (group.members.length >= group.maxMembers) {
            return res.status(400).json({ message: 'Group is at maximum capacity' });
        }

        // Add new member
        group.members.push({ user: userId, role: 'member' });
        await group.save();

        // Add to group conversation
        const groupConversation = await GroupConversations.findOne({ groupId: groupId });
        if (groupConversation) {
            groupConversation.members.push(userId);
            await groupConversation.save();
        }

        // Return updated group
        const updatedGroup = await Groups.findById(groupId)
            .populate('members.user', 'fullName phoneNumber picture')
            .populate('createdBy', 'fullName phoneNumber picture');

        // Real-time notification: Notify the newly added user
        const newUser = users.find(user => user.userId === userId);
        if (newUser) {
            io.to(newUser.socketId).emit('addedToGroup', {
                group: updatedGroup,
                message: `You have been added to the group "${updatedGroup.name}"`
            });

            // Establish immediate connection for the new member
            const groupConversation = await GroupConversations.findOne({ groupId: groupId });
            if (groupConversation) {
                io.to(newUser.socketId).emit('groupConnectionEstablished', {
                    groupId: groupId,
                    conversationId: groupConversation._id,
                    groupName: updatedGroup.name,
                    members: updatedGroup.members.map(m => ({
                        id: m.user._id,
                        name: m.user.fullName,
                        role: m.role
                    }))
                });
            }
        }

        // Real-time notification: Notify all existing group members about the new member
        updatedGroup.members.forEach(member => {
            const memberUser = users.find(user => user.userId === member.user._id.toString());
            if (memberUser && member.user._id.toString() !== userId) {
                io.to(memberUser.socketId).emit('groupMemberAdded', {
                    groupId: groupId,
                    newMember: updatedGroup.members.find(m => m.user._id.toString() === userId),
                    group: updatedGroup,
                    message: `${updatedGroup.members.find(m => m.user._id.toString() === userId).user.fullName} has been added to the group`
                });
            }
        });

        res.status(200).json(updatedGroup);

    } catch (error) {
        console.error('Error adding group member:', error);
        res.status(500).json({ message: 'Failed to add member' });
    }
});

// Remove member from group
app.delete('/api/groups/:groupId/members/:userId', async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        const { adminId } = req.body;

        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if the user to be removed exists in the group
        const memberToRemove = group.members.find(m => m.user.toString() === userId);
        if (!memberToRemove) {
            return res.status(404).json({ message: 'User is not a member of this group' });
        }

        // Don't allow removing the group creator
        if (userId === group.createdBy.toString()) {
            return res.status(400).json({ message: 'Group creator cannot be removed or leave the group' });
        }

        // Check permissions:
        // 1. User can remove themselves (leave group)
        // 2. Admin can remove other members
        let isAuthorized = false;

        if (adminId === userId) {
            // User is leaving the group themselves
            isAuthorized = true;
        } else if (adminId) {
            // Admin is trying to remove someone else
            const isCreator = group.createdBy.toString() === adminId;
            const memberWithAdminRole = group.members.find(m => m.user.toString() === adminId && m.role === 'admin');

            if (isCreator || memberWithAdminRole) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Insufficient permissions to remove this member' });
        }

        // Remove member
        group.members = group.members.filter(m => m.user.toString() !== userId);
        await group.save();

        // Remove from group conversation if it exists
        const groupConversation = await GroupConversations.findOne({ groupId: groupId });
        if (groupConversation) {
            groupConversation.members = groupConversation.members.filter(id => id !== userId);
            await groupConversation.save();
        }

        // Get user details before returning updated group
        const removedUser = await Users.findById(userId);

        // Return updated group
        const updatedGroup = await Groups.findById(groupId)
            .populate('members.user', 'fullName phoneNumber picture')
            .populate('createdBy', 'fullName phoneNumber picture');

        // Real-time notification: Notify the removed user
        const removedUserSocket = users.find(user => user.userId === userId);
        if (removedUserSocket) {
            const isLeaving = adminId === userId; // User is leaving themselves
            io.to(removedUserSocket.socketId).emit('removedFromGroup', {
                groupId: groupId,
                groupName: group.name,
                isLeaving: isLeaving,
                message: isLeaving ? `You have left the group "${group.name}"` : `You have been removed from the group "${group.name}"`
            });
        }

        // Real-time notification: Notify remaining group members about the removal
        if (updatedGroup.members.length > 0) {
            updatedGroup.members.forEach(member => {
                const memberUser = users.find(user => user.userId === member.user._id.toString());
                if (memberUser) {
                    const isLeaving = adminId === userId;
                    io.to(memberUser.socketId).emit('groupMemberRemoved', {
                        groupId: groupId,
                        removedUserId: userId,
                        removedUserName: removedUser?.fullName || 'Unknown User',
                        group: updatedGroup,
                        isLeaving: isLeaving,
                        message: isLeaving
                            ? `${removedUser?.fullName || 'A user'} has left the group`
                            : `${removedUser?.fullName || 'A user'} has been removed from the group`
                    });
                }
            });
        }

        res.status(200).json(updatedGroup);

    } catch (error) {
        console.error('Error removing group member:', error);
        res.status(500).json({ message: 'Failed to remove member' });
    }
});

// Update group details
app.put('/api/groups/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description, profilePicture, adminId } = req.body;

        const group = await Groups.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Check if requester is admin
        const isCreator = group.createdBy.toString() === adminId;
        const memberWithAdminRole = group.members.find(m => m.user.toString() === adminId && m.role === 'admin');

        if (!isCreator && !memberWithAdminRole) {
            return res.status(403).json({ message: 'Only admins can update group details' });
        }

        // Update group
        if (name) group.name = name;
        if (description !== undefined) group.description = description;
        if (profilePicture !== undefined) group.profilePicture = profilePicture;

        await group.save();

        // Return updated group
        const updatedGroup = await Groups.findById(groupId)
            .populate('members.user', 'fullName phoneNumber picture')
            .populate('createdBy', 'fullName phoneNumber picture');

        res.status(200).json(updatedGroup);

    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ message: 'Failed to update group' });
    }
});

// Get conversations (both regular and group conversations)
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log('Fetching conversations for user:', userId);

        // Get regular conversations
        const regularConversations = await Conversations.find({
            members: { $in: [userId] }
        }).sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

        // Get group conversations
        const groupConversations = await GroupConversations.find({
            members: { $in: [userId] }
        }).populate('groupId', 'name profilePicture members').sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

        console.log('Found regular conversations:', regularConversations.map(c => ({
            id: c._id.toString(),
            members: c.members
        })));

        console.log('Found group conversations:', groupConversations.map(c => ({
            id: c._id.toString(),
            groupId: c.groupId?._id?.toString(),
            groupName: c.groupId?.name
        })));

        const conversationUserData = [];

        // Create combined array of conversations with timestamps for proper ordering
        const allConversations = [];

        // Add regular conversations with their timestamps
        for (const conversation of regularConversations) {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            if (user) {
                allConversations.push({
                    type: 'regular',
                    timestamp: conversation.lastMessage?.timestamp || conversation.updatedAt,
                    data: {
                        user: { receiverId: user._id, fullName: user.fullName },
                        conversationId: conversation._id,
                        isGroup: false,
                        lastMessage: conversation.lastMessage
                    }
                });
            }
        }

        // Add group conversations with their timestamps
        for (const groupConversation of groupConversations) {
            if (groupConversation.groupId) {
                allConversations.push({
                    type: 'group',
                    timestamp: groupConversation.lastMessage?.timestamp || groupConversation.updatedAt,
                    data: {
                        conversationId: groupConversation._id,
                        isGroup: true,
                        group: {
                            id: groupConversation.groupId._id,
                            name: groupConversation.groupId.name,
                            profilePicture: groupConversation.groupId.profilePicture,
                            memberCount: groupConversation.groupId.members.length
                        },
                        lastMessage: groupConversation.lastMessage
                    }
                });
            }
        }

        // Sort all conversations by timestamp (most recent first)
        allConversations.sort((a, b) => {
            const timeA = new Date(a.timestamp);
            const timeB = new Date(b.timestamp);
            return timeB - timeA; // Most recent first
        });

        // Extract the sorted conversation data
        const sortedConversationData = allConversations.map(conv => conv.data);

        console.log('Final conversations result:', sortedConversationData);
        res.status(200).json(sortedConversationData);
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).json({ message: 'Failed to fetch conversations' });
    }
});

// Sync endpoints for localStorage to MongoDB synchronization

// Sync create message from localStorage to MongoDB
app.post('/api/message/sync', async (req, res) => {
    try {
        const { conversationId, senderId, message, timestamp, sequenceNumber, localMessageId } = req.body;

        if (!conversationId || !senderId || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Skip messages with 'new' conversationId - these should have been converted to proper IDs by now
        if (conversationId === 'new') {
            console.log(`Skipping sync for message with conversationId 'new': ${localMessageId}`);
            return res.status(200).json({
                localMessageId,
                synced: false,
                skipped: true,
                reason: 'conversationId is "new" - message should use proper conversation ID'
            });
        }

        console.log(`Syncing message from localStorage: ${localMessageId} with sequence ${sequenceNumber}`);

        // Check for duplicate messages based on content, sender, timestamp, and sequence number
        // to prevent multiple syncs of the same message
        const timeWindow = new Date(timestamp || Date.now());
        const startTime = new Date(timeWindow.getTime() - 5000); // 5 seconds before
        const endTime = new Date(timeWindow.getTime() + 5000); // 5 seconds after

        let existingMessage = null;

        // First check by sequence number if available
        if (sequenceNumber) {
            existingMessage = await Messages.findOne({
                conversationId,
                sequenceNumber
            });
        }

        // If not found by sequence, check by content and time window
        if (!existingMessage) {
            existingMessage = await Messages.findOne({
                conversationId,
                senderId,
                message,
                createdAt: {
                    $gte: startTime,
                    $lte: endTime
                }
            });
        }

        if (existingMessage) {
            console.log(`Message already exists in MongoDB, skipping duplicate: ${localMessageId}`);
            return res.status(200).json({
                messageId: existingMessage._id.toString(),
                localMessageId,
                synced: true,
                timestamp: existingMessage.createdAt,
                sequenceNumber: existingMessage.sequenceNumber,
                duplicate: true
            });
        }

        // Create message in MongoDB
        const newMessage = new Messages({
            conversationId,
            senderId,
            message,
            sequenceNumber: sequenceNumber || 0
        });

        // Use provided timestamp if available
        if (timestamp) {
            newMessage.createdAt = new Date(timestamp);
        }

        await newMessage.save();

        // Update conversation's last message
        await Conversations.findByIdAndUpdate(conversationId, {
            'lastMessage.message': message,
            'lastMessage.sender': senderId,
            'lastMessage.timestamp': newMessage.createdAt || new Date(),
            'lastMessage.sequenceNumber': newMessage.sequenceNumber
        });

        console.log(`Successfully synced message ${localMessageId} to MongoDB as ${newMessage._id} with sequence ${newMessage.sequenceNumber}`);

        res.status(200).json({
            messageId: newMessage._id.toString(),
            localMessageId,
            synced: true,
            timestamp: newMessage.createdAt,
            sequenceNumber: newMessage.sequenceNumber
        });

    } catch (error) {
        console.error('Error syncing message:', error);
        res.status(500).json({ error: 'Failed to sync message to MongoDB' });
    }
});

// Sync update message from localStorage to MongoDB
app.put('/api/message/:messageId/sync', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { conversationId, updates } = req.body;

        if (!messageId || !updates) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`Syncing message update: ${messageId}`);

        // Update message in MongoDB
        const updatedMessage = await Messages.findByIdAndUpdate(
            messageId,
            updates,
            { new: true }
        );

        if (!updatedMessage) {
            return res.status(404).json({ error: 'Message not found' });
        }

        console.log(`Successfully synced message update ${messageId}`);

        res.status(200).json({
            messageId: updatedMessage._id.toString(),
            synced: true,
            updatedMessage
        });

    } catch (error) {
        console.error('Error syncing message update:', error);
        res.status(500).json({ error: 'Failed to sync message update to MongoDB' });
    }
});

// Sync delete message from localStorage to MongoDB
app.delete('/api/message/:messageId/sync', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { conversationId } = req.body;

        if (!messageId) {
            return res.status(400).json({ error: 'Message ID required' });
        }

        console.log(`Syncing message deletion: ${messageId}`);

        // Delete message from MongoDB
        const deletedMessage = await Messages.findByIdAndDelete(messageId);

        if (!deletedMessage) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Update conversation's last message if this was the last message
        if (conversationId) {
            const lastMessage = await Messages.findOne({ conversationId }).sort({ createdAt: -1 });
            if (lastMessage) {
                await Conversations.findByIdAndUpdate(conversationId, {
                    'lastMessage.message': lastMessage.message,
                    'lastMessage.sender': lastMessage.senderId,
                    'lastMessage.timestamp': lastMessage.createdAt
                });
            } else {
                // No messages left, clear last message
                await Conversations.findByIdAndUpdate(conversationId, {
                    $unset: { lastMessage: "" }
                });
            }
        }

        console.log(`Successfully synced message deletion ${messageId}`);

        res.status(200).json({
            messageId,
            deleted: true,
            synced: true
        });

    } catch (error) {
        console.error('Error syncing message deletion:', error);
        res.status(500).json({ error: 'Failed to sync message deletion to MongoDB' });
    }
});

// Get sync configuration
app.get('/api/sync/config', (req, res) => {
    const syncIntervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5');

    res.status(200).json({
        syncIntervalMinutes,
        syncEnabled: true,
        serverTime: new Date().toISOString()
    });
});

server.listen(PORT, '0.0.0.0', async () => {
    console.log("HTTP and Socket.IO server listening on port : " + PORT);

    // Initialize Redis service for horizontal scaling
    try {
        await redisService.connect();

        // Subscribe to cross-server events
        redisService.subscribeToEvents((eventData) => {
            messageDeliveryService.handleCrossServerEvent(eventData);
        });

        console.log('Message ordering and scaling services initialized');

        // Start periodic queue cleanup (every 30 minutes)
        setInterval(() => {
            messageQueueService.cleanupOldQueues();
        }, 30 * 60 * 1000);

    } catch (error) {
        console.error('Failed to initialize Redis services:', error);
        console.log('Running in single-server mode');
    }
})