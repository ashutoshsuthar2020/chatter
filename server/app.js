// declare function require(name:string);
require('dotenv').config();
const express = require('express');
const PORT = process.env.PORT || 8000;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

// app Use[/]
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create HTTP server and attach Socket.IO to the same port
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST']
    }
})

// connect database
require('./db/connection');

// Import Files
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');
const Contacts = require('./models/Contacts');
// const { Socket } = require('socket.io');

// Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here');

// Socket.io
let users = []
io.on('connection', socket => {
    socket.on('addUser', userId => {
        const IsUserExist = users.find(user => user.userId === userId);
        if (!IsUserExist) {
            const user = { userId, socketId: socket.id };
            users.push(user);
            io.emit('getUsers', users);
        }
    });
    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
        try {
            const receiver = users.find(user => user.userId === receiverId);
            const sender = users.find(user => user.userId === senderId);
            const user = await Users.findById(senderId);

            console.log('Message received:', { senderId, receiverId, message, conversationId });
            console.log('Active users:', users.map(u => u.userId));
            console.log('Receiver found:', !!receiver, 'Sender found:', !!sender);

            const messageData = {
                senderId,
                message,
                conversationId,
                receiverId,
                user: { id: user._id, fullName: user.fullName, email: user.email }
            };

            // Always emit to sender for confirmation
            if (sender) {
                io.to(sender.socketId).emit('getMessage', messageData);
            }

            // Emit to receiver if they're online
            if (receiver && receiver.socketId !== sender?.socketId) {
                io.to(receiver.socketId).emit('getMessage', messageData);
            }

        } catch (error) {
            console.error('Error handling sendMessage:', error);
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    });
});

app.get('/', (req, res) => {
    res.send('Hello');
})

// Health check endpoint for Kubernetes
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
})

app.post('/api/register', async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const isAlreadyExist = await Users.findOne({ email });
            if (isAlreadyExist) {
                res.status(400).send('User already exists.');
            } else {
                const newUser = new Users({ fullName, email });
                bcrypt.hash(password, 10, function (err, hash) {
                    // Store hash in your password DB.
                    newUser.set("password", hash);
                    newUser.save();
                    next();
                })
                return res.status(200).send('User registered sucessfully.')
            }
        }
    }
    catch (error) {
        console.log(error);
    }
})

app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const user = await Users.findOne({ email });
            if (!user) {
                res.status(400).send('User email or password is incorrect.');
            } else {
                const validateUser = await bcrypt.compare(password, user.password);
                if (!validateUser) {
                    res.status(400).send('User email or password is incorrect.')
                } else {
                    const payload = {
                        userId: user._id,
                        email: user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

                    jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                        await Users.updateOne({ _id: user._id }, {
                            $set: { token }
                        })
                        user.save();
                        return res.status(200).json({ user: { id: user._id, email: user.email, fullName: user.fullName }, token: token });
                    })
                }
            }
        }
    }
    catch (error) {
        console.log(error, 'Error');
    }
})

// Google OAuth Register Route
app.post('/api/register/google', async (req, res) => {
    try {
        const { credential, googleId, email, fullName, firstName, lastName, picture } = req.body;

        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here'
        });

        const payload = ticket.getPayload();

        if (payload.sub !== googleId || payload.email !== email) {
            return res.status(400).json({ message: 'Invalid Google token' });
        }

        // Check if user already exists
        const existingUser = await Users.findOne({
            $or: [{ email }, { googleId }]
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Create new user
        const newUser = new Users({
            fullName,
            email,
            googleId,
            firstName,
            lastName,
            picture,
            isGoogleUser: true
        });

        await newUser.save();

        // Generate JWT token
        const jwtPayload = {
            userId: newUser._id,
            email: newUser.email
        };

        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

        jwt.sign(jwtPayload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
            if (err) {
                return res.status(500).json({ message: 'Error generating token' });
            }

            await Users.updateOne({ _id: newUser._id }, {
                $set: { token }
            });

            return res.status(201).json({
                user: {
                    id: newUser._id,
                    email: newUser.email,
                    fullName: newUser.fullName,
                    picture: newUser.picture
                },
                token: token
            });
        });

    } catch (error) {
        console.log(error, 'Google Register Error');
        res.status(500).json({ message: 'Server error during Google registration' });
    }
});

// Google OAuth Login Route
app.post('/api/login/google', async (req, res) => {
    try {
        const { credential, googleId, email } = req.body;

        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here'
        });

        const payload = ticket.getPayload();

        if (payload.sub !== googleId || payload.email !== email) {
            return res.status(400).json({ message: 'Invalid Google token' });
        }

        // Find user by email or googleId
        const user = await Users.findOne({
            $or: [{ email }, { googleId }]
        });

        if (!user) {
            return res.status(400).json({ message: 'User not found. Please sign up first.' });
        }

        // Generate JWT token
        const jwtPayload = {
            userId: user._id,
            email: user.email
        };

        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

        jwt.sign(jwtPayload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
            if (err) {
                return res.status(500).json({ message: 'Error generating token' });
            }

            await Users.updateOne({ _id: user._id }, {
                $set: { token }
            });

            return res.status(200).json({
                user: {
                    id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    picture: user.picture
                },
                token: token
            });
        });

    } catch (error) {
        console.log(error, 'Google Login Error');
        res.status(500).json({ message: 'Server error during Google login' });
    }
});

app.post('/api/conversations', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newConversation = new Conversations({ members: [senderId, receiverId] });
        await newConversation.save();
        res.status(200).send('Conversation created successfully');
    } catch (error) {
        console.log(error, 'Error');
    }
})

app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversations.find({ members: { $in: [userId] } });
        const conversationUserData = Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            return { user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conversation._id }
        }))
        res.status(200).json(await conversationUserData);
    } catch (error) {
        console.log(error, 'Error');
    }
})

app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '' } = req.body;
        if (!senderId || !message) {
            return res.status(400).send('Please fill all required fields.')
        }
        if (conversationId === 'new' && receiverId) {
            const newConversation = new Conversations({ members: [senderId, receiverId] });
            await newConversation.save();
            const newMessage = new Messages({ conversationId: newConversation._id, senderId, message });
            await newMessage.save();
            return res.status(200).send('Message sent successfully');
        } else if (!conversationId && !receiverId) {
            return res.status(400).send('Please fill all required fields.')
        }
        const newMessage = new Messages({ conversationId, senderId, message });
        await newMessage.save();
        res.status(200).send('Message sent successfully');
    } catch (error) {
        console.log(error, 'Error')
    }
})

app.get('/api/message/:conversationId', async (req, res) => {
    try {
        const checkMessages = async (conversationId) => {
            // console.log('conversationId: >> ',conversationId);
            const messages = await Messages.find({ conversationId });
            const messageUserData = Promise.all(messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return { user: { id: user._id, email: user.email, fullName: user.fullName }, message: message.message }
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

// Contact Management Endpoints

// Get user's contacts
app.get('/api/contacts/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const contacts = await Contacts.find({ userId: userId })
            .populate('contactUserId', 'fullName email picture')
            .sort({ addedAt: -1 });

        const contactsData = contacts.map(contact => ({
            contactId: contact._id,
            user: {
                email: contact.contactUserId.email,
                fullName: contact.contactUserId.fullName,
                picture: contact.contactUserId.picture,
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

// Add a new contact by email
app.post('/api/contacts', async (req, res) => {
    try {
        const { userId, contactEmail } = req.body;

        if (!userId || !contactEmail) {
            return res.status(400).json({ error: 'User ID and contact email are required' });
        }

        // Find the contact user by email
        const contactUser = await Users.findOne({ email: contactEmail });
        if (!contactUser) {
            return res.status(404).json({ error: 'User with this email not found' });
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
            contactEmail: contactUser.email,
            contactName: contactUser.fullName
        });

        await newContact.save();

        // Populate the contact data for response
        const populatedContact = await Contacts.findById(newContact._id)
            .populate('contactUserId', 'fullName email picture');

        res.status(201).json({
            message: 'Contact added successfully',
            contact: {
                contactId: populatedContact._id,
                user: {
                    email: populatedContact.contactUserId.email,
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
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id } }
        }))
        res.status(200).json(await usersData);
    } catch (error) {
        console.log('Error', error)
    }
})

server.listen(PORT, () => {
    console.log("HTTP and Socket.IO server listening on port : " + PORT);
})