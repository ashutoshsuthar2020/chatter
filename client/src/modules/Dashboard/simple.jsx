import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import config from '../../config';
import logger from '../../logger';

const SimpleDashboard = () => {
    const [user, setUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [messages, setMessages] = useState([]);
    const [currentReceiver, setCurrentReceiver] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');
    const messageEndRef = useRef(null);

    // Initialize user and socket
    useEffect(() => {
        const loggedUser = JSON.parse(localStorage.getItem('user:detail'));
        if (loggedUser) {
            setUser(loggedUser);


            // Connect to socket using config.WS_URL
            const newSocket = io(config.WS_URL);
            setSocket(newSocket);

            newSocket.on('connect', () => {
                logger.info('✅ Connected to socket');
                newSocket.emit('register', loggedUser.id);
            });

            newSocket.on('newMessage', (data) => {
                logger.info('💬 New message received:', data);
                if (currentReceiver &&
                    ((data.senderId === currentReceiver.id && data.receiverId === loggedUser.id) ||
                        (data.senderId === loggedUser.id && data.receiverId === currentReceiver.id))) {
                    setMessages(prev => [...prev, {
                        _id: data._id,
                        senderId: data.senderId,
                        message: data.message,
                        createdAt: data.createdAt
                    }]);
                }
            });

            return () => newSocket.close();
        }
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load contacts
    const loadContacts = async () => {
        try {
            const token = localStorage.getItem('user:token');
            const res = await fetch(`${config.API_URL}/api/contacts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(data);
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    };

    // Add contact
    const addContact = async () => {
        if (!newContactPhone.trim()) return;

        try {
            const token = localStorage.getItem('user:token');

            // First, search for user
            const searchRes = await fetch(`${config.API_URL}/api/users/search?phoneNumber=${newContactPhone}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (searchRes.ok) {
                const foundUser = await searchRes.json();

                // Add to contacts
                const addRes = await fetch(`${config.API_URL}/api/contacts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        contactUserId: foundUser._id,
                        contactPhoneNumber: foundUser.phoneNumber,
                        contactName: foundUser.fullName
                    })
                });

                if (addRes.ok) {
                    setNewContactPhone('');
                    loadContacts();
                    alert('Contact added successfully!');
                } else {
                    alert('Failed to add contact');
                }
            } else {
                alert('User not found');
            }
        } catch (error) {
            console.error('Error adding contact:', error);
            alert('Error adding contact');
        }
    };

    // Load messages for a contact
    const loadMessages = async (contact) => {
        setCurrentReceiver(contact.contactUserId);

        try {
            const token = localStorage.getItem('user:token');
            const res = await fetch(`${config.API_URL}/api/messages/${user.id}?receiverId=${contact.contactUserId._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            setMessages([]);
        }
    };

    // Send message
    const sendMessage = () => {
        if (!messageInput.trim() || !socket || !currentReceiver) return;

        const messageData = {
            senderId: user.id,
            receiverId: currentReceiver._id,
            message: messageInput.trim()
        };

        // Add to UI immediately
        setMessages(prev => [...prev, {
            _id: 'temp_' + Date.now(),
            senderId: user.id,
            message: messageInput.trim(),
            createdAt: new Date()
        }]);

        setMessageInput('');
        socket.emit('sendMessage', messageData);
    };

    // Load contacts on mount
    useEffect(() => {
        if (user) {
            loadContacts();
        }
    }, [user]);

    if (!user) {
        return <div className="p-4">Please log in to use the chat</div>;
    }

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-1/3 bg-white border-r">
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold">Chatter</h2>
                    <p className="text-sm text-gray-600">{user.fullName}</p>
                </div>

                {/* Add Contact */}
                <div className="p-4 border-b">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Phone number"
                            value={newContactPhone}
                            onChange={(e) => setNewContactPhone(e.target.value)}
                            className="flex-1 p-2 border rounded"
                        />
                        <button
                            onClick={addContact}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Add
                        </button>
                    </div>
                </div>

                {/* Contacts List */}
                <div className="overflow-y-auto">
                    {contacts.map((contact) => (
                        <div
                            key={contact._id}
                            onClick={() => loadMessages(contact)}
                            className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${currentReceiver?._id === contact.contactUserId._id ? 'bg-blue-50' : ''
                                }`}
                        >
                            <div className="font-semibold">{contact.contactName}</div>
                            <div className="text-sm text-gray-600">{contact.contactPhoneNumber}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {currentReceiver ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 bg-white border-b">
                            <h3 className="font-semibold">{currentReceiver.fullName}</h3>
                            <p className="text-sm text-gray-600">{currentReceiver.phoneNumber}</p>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {messages.map((msg) => (
                                <div
                                    key={msg._id}
                                    className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-xs px-4 py-2 rounded-lg ${msg.senderId === user.id
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-200 text-gray-800'
                                            }`}
                                    >
                                        {msg.message}
                                    </div>
                                </div>
                            ))}
                            <div ref={messageEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-4 bg-white border-t">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                    className="flex-1 p-2 border rounded"
                                />
                                <button
                                    onClick={sendMessage}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        Select a contact to start chatting
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimpleDashboard;
