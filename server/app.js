// declare function require(name:string);
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const io = require('socket.io')(8080,{
    cors: {
        origin:'http://localhost:3000'
    }
})

// connect database
require('./db/connection');

// Import Files
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');
const { Socket } = require('socket.io');

// app Use
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));

const port = 8000;

// Socket.io
let users = []
io.on('connection',socket => {
    socket.on('addUser', userId => {
        const IsUserExist = users.find(user => user.userId === userId);
        if(!IsUserExist){
            const user = {userId, socketId: socket.id};
            users.push(user);
            io.emit('getUsers',users);
        }
    });
    socket.on('sendMessage',async ({ senderId, receiverId, message, conversationId})=>{
        const receiver = users.find(user => user.userId === receiverId);
        const sender = users.find(user => user.userId === senderId);
        const user = await Users.findById(senderId);
        if(receiver){
            io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {
                senderId,
                message,
                conversationId,
                receiverId,
                user: {id:user._id, fullName: user.fullName, email: user.email}
            });
        } else {
            io.to(sender.socketId).emit('getMessage', {
                senderId,
                message,
                conversationId,
                receiverId,
                user: {id:user._id, fullName: user.fullName, email: user.email}
            });
        }
    });

    socket.on('disconnect', ()=> {
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    });
});

app.get('/',(req,res) => {
    res.send('Hello');
})

app.post('/api/register',async (req,res,next)=>{
    try{
        const {fullName, email, password } = req.body;
        if(!fullName || !email || !password){
            res.status(400).send('Please fill all required fields');
        } else{
            const isAlreadyExist = await Users.findOne({email});
            if(isAlreadyExist){
                res.status(400).send('User already exists.');
            }else{
                const newUser = new Users({fullName,email});
                bcrypt.hash(password, 10, function(err, hash) {
                    // Store hash in your password DB.
                    newUser.set("password",hash);
                    newUser.save();
                    next();
                })
                return res.status(200).send('User registered sucessfully.')
            }
        }
    }
    catch(error){
        console.log(error);
    }
})
app.post('/api/login',async (req,res,next)=>{
    try{
        const {email, password } = req.body;
        if(!email || !password){
            res.status(400).send('Please fill all required fields');
        } else{
            const user = await Users.findOne({email});
            if(!user){
                res.status(400).send('User email or password is incorrect.');
            }else{
                const validateUser = await bcrypt.compare(password,user.password);
                if(!validateUser){
                    res.status(400).send('User email or password is incorrect.')
                } else {
                    const payload = {
                        userId:user._id,
                        email:user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

                    jwt.sign(payload,JWT_SECRET_KEY,{expiresIn:84600},async(err,token)=>{
                        await Users.updateOne({_id:user._id},{
                            $set:{token}
                        })
                        user.save();
                        return res.status(200).json({user:{id: user._id, email: user.email,fullName: user.fullName}, token: token});
                    })
                }
            }
        }
    }
    catch(error){
        console.log(error, 'Error');
    }
})

app.post('/api/conversations', async (req,res) => {
    try{
        const {senderId, receiverId} = req.body;
        const newConversation = new Conversations({members: [senderId,receiverId]});
        await newConversation.save();
        res.status(200).send('Conversation created successfully');
    }catch (error){
        console.log(error,'Error');
    }
})

app.get('/api/conversations/:userId', async (req,res) => {
    try{
        const userId = req.params.userId;
        const conversations = await Conversations.find({members: {$in: [userId]}});
        const conversationUserData = Promise.all(conversations.map(async (conversation)=>{
            const receiverId = conversation.members.find((member)=>member!==userId);
            const user = await Users.findById(receiverId);
            return {user:{receiverId: user._id, email: user.email, fullName: user.fullName}, conversationId:conversation._id}
        }))
        res.status(200).json( await conversationUserData);
    }catch (error){
        console.log(error,'Error');
    }
})

app.post('/api/message', async (req,res)=>{
    try{
        const {conversationId,senderId,message, receiverId=''} = req.body;
        if(!senderId || !message){
            return res.status(400).send('Please fill all required fields.')
        }
        if(conversationId === 'new' && receiverId){
            const newConversation = new Conversations({members: [senderId,receiverId]});
            await newConversation.save();
            const newMessage = new Messages({conversationId:newConversation._id,senderId,message});
            await newMessage.save();
            return res.status(200).send('Message sent successfully');
        }else if(!conversationId && !receiverId){
            return res.status(400).send('Please fill all required fields.')
        }
        const newMessage = new Messages({conversationId,senderId,message});
        await newMessage.save();
        res.status(200).send('Message sent successfully');
    }catch(error){
        console.log(error,'Error')
    }
})

app.get('/api/message/:conversationId', async (req,res) => {
    try{
        const checkMessages = async (conversationId) => {
            // console.log('conversationId: >> ',conversationId);
            const messages = await Messages.find({conversationId});
            const messageUserData = Promise.all(messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return {user: {id:user._id, email: user.email, fullName:user.fullName}, message: message.message}
            }));
            res.status(200).json({mssgData: await messageUserData, conversationId:conversationId});
        } 
        const conversationId = req.params.conversationId;
        if(conversationId === 'new'){
            const checkConversation = await Conversations.find({members: { $all: [req.query.senderId, req.query.receiverId] }});
            if(checkConversation.length > 0){
                checkMessages(checkConversation[0]._id);
            } else {
                return res.status(200).json({mssgData: [], conversationId:conversationId});
            }
        }else{
            checkMessages(conversationId);
        }
    } catch(error) {
        console.log('Error', error)
    }
})

app.get('/api/users/:userId', async (req,res) => {
    try{
        const userId = req.params.userId;
        const users = await Users.find({ _id: { $ne: userId }});
        const usersData = Promise.all(users.map(async (user)=> {
            return {user:{email: user.email, fullName:user.fullName, receiverId:user._id }}
        }))
        res.status(200).json(await usersData);
    }catch(error){
        console.log('Error', error)
    }
})

app.listen(port,()=>{
    console.log("listening on port : " + port);
})