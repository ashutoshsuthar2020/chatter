import React, { useState, useEffect, useRef } from "react";
import Img1 from './../../assets/user.svg'
import Avatar from "./../../assets/user.svg"
import Input from "./../../components/Input"
import { AddContactForm } from "./../../components/ContactManager"
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom';
import config from '../../config'

const Dashboard = () => {
    const [user] = useState(JSON.parse(localStorage.getItem('user:detail')));
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState({});
    const [message, setMessage] = useState('');
    const [contacts, setContacts] = useState([]);
    const [activeUsers, setActiveUsers] = useState([]);
    const [socket, setSocket] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showAddContact, setShowAddContact] = useState(false);
    const messageRef = useRef(null);
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear localStorage
        localStorage.removeItem('user:token');
        localStorage.removeItem('user:detail');

        // Disconnect socket
        if (socket) {
            socket.disconnect();
        }

        // Navigate to sign in page
        navigate('/users/sign_in');
    };

    useEffect(() => {
        const socketConnection = io(config.WS_URL);
        console.log('Connecting to socket at:', config.WS_URL);
        setSocket(socketConnection);

        return () => {
            if (socketConnection) {
                socketConnection.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        if (socket) {
            socket.on('connect', () => {
                console.log('Socket connected successfully');
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });

            socket.emit('addUser', user?.id);
            console.log('Adding user to socket:', user?.id);

            socket.on('getUsers', users => {
                console.log('Active users updated:', users);
                setActiveUsers(users);
            });

            socket.on('getMessage', data => {
                console.log('Received message:', data);
                setMessages(prev => {
                    // Check if this message is for the current active conversation
                    if (prev.conversationId &&
                        (data.conversationId === prev.conversationId ||
                            (data.senderId === prev.receiver?.receiverId && data.receiverId === user?.id) ||
                            (data.senderId === user?.id && data.receiverId === prev.receiver?.receiverId))) {

                        // Check if message already exists to avoid duplicates
                        const messageExists = prev.messages?.some(msg =>
                            msg.message === data.message &&
                            msg.user?.id === data.senderId &&
                            Math.abs(new Date(msg.timestamp) - new Date()) < 1000 // Within 1 second
                        );

                        if (!messageExists) {
                            return {
                                ...prev,
                                messages: [...(prev.messages || []), {
                                    user: { id: data.senderId, ...data.user },
                                    message: data.message,
                                    timestamp: new Date()
                                }]
                            };
                        }
                    }
                    return prev;
                });
            });

            // Cleanup function to remove event listeners
            return () => {
                socket.off('connect');
                socket.off('disconnect');
                socket.off('getUsers');
                socket.off('getMessage');
            };
        }
    }, [socket, user?.id]);

    useEffect(() => {
        messageRef?.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages?.messages]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.dropdown-container')) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    useEffect(() => {
        const loggedInUser = JSON.parse(localStorage.getItem('user:detail'));
        const fetchConversations = async () => {
            const res = await fetch(`${config.API_URL}/api/conversations/${loggedInUser?.id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const resData = await res.json();
            setConversations(resData);
        }
        fetchConversations()
    }, []);

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const res = await fetch(`${config.API_URL}/api/contacts/${user?.id}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                const resData = await res.json();
                setContacts(resData);
            } catch (error) {
                console.error('Error fetching contacts:', error);
            }
        };

        if (user?.id) {
            fetchContacts();
        }
    }, [user?.id]);

    // const call = (remotePeerId) => {
    //     var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    //     getUserMedia({ video: true, audio: true }, (stream) => {
    //             currentVideoRef.current.srcObject = stream;
    //             const call = peerInstance.current.call(remotePeerId,stream);
    //             console.log(typeof(call));
    //             call.on("stream", (remoteStream) => {
    //                 remoteVideoRef.current.srcObject = remoteStream;
    //                 var playPromise = remoteVideoRef.current.play();

    //                 if (playPromise !== undefined) {
    //                     playPromise.then(_ => {
    //                     // Automatic playback started!
    //                     // Show playing UI.
    //                     })
    //                     .catch(error => {
    //                     // Auto-play was prevented
    //                     // Show paused UI.
    //                     });
    //                 }
    //             });
    //         },
    //         (err) => {
    //             console.error("Failed to get local stream", err);
    //         },
    //     );
    // };
    const fetchMessages = async (conversationId, receiver) => {
        const res = await fetch(`${config.API_URL}/api/message/${conversationId}?senderId=${user?.id}&&receiverId=${receiver?.receiverId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const resData = await res.json();
        conversationId = resData.conversationId;
        setMessages({ messages: resData.mssgData, receiver, conversationId });
    }

    // Contact Management Functions
    const handleContactAdded = (newContact) => {
        setContacts(prev => [newContact, ...prev]);
        setShowAddContact(false);
    };

    const handleContactRemoved = (contactId) => {
        setContacts(prev => prev.filter(contact => contact.contactId !== contactId));
        // If the removed contact has an active conversation, close it
        if (messages.receiver && contacts.find(c => c.contactId === contactId && c.user.receiverId === messages.receiver.receiverId)) {
            setMessages({});
        }
    };

    const handleChatDeleted = (conversationId) => {
        // Remove from conversations list
        setConversations(prev => prev.filter(conv => conv.conversationId !== conversationId));
        // Clear active chat if it's the deleted one
        if (messages.conversationId === conversationId) {
            setMessages({});
        }
    };

    const removeContact = async (contactId) => {
        if (!window.confirm('Are you sure you want to remove this contact?')) return;

        try {
            const res = await fetch(`${config.API_URL}/api/contacts/${contactId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.id
                })
            });

            if (res.ok) {
                handleContactRemoved(contactId);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to remove contact');
            }
        } catch (error) {
            console.error('Error removing contact:', error);
            alert('Failed to remove contact. Please try again.');
        }
    };

    const deleteChat = async (conversationId) => {
        if (!window.confirm('Are you sure you want to delete this entire chat? This action cannot be undone.')) return;

        try {
            const res = await fetch(`${config.API_URL}/api/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.id
                })
            });

            if (res.ok) {
                handleChatDeleted(conversationId);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete chat');
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat. Please try again.');
        }
    };

    const sendMessage = async (e) => {
        if (!message.trim()) return;

        const newMessage = {
            message: message.trim(),
            user: { id: user?.id },
            timestamp: new Date()
        };

        // Immediately add the message to local state for instant feedback
        setMessages(prev => ({
            ...prev,
            messages: [...(prev.messages || []), newMessage]
        }));

        // Clear the input immediately
        const messageToSend = message.trim();
        setMessage('');

        try {
            // Send via socket for real-time delivery
            const socketData = {
                senderId: user?.id,
                receiverId: messages?.receiver?.receiverId,
                message: messageToSend,
                conversationId: messages?.conversationId
            };
            console.log('Sending message via socket:', socketData);
            socket.emit('sendMessage', socketData);

            // Save to database
            const res = await fetch(`${config.API_URL}/api/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId: messages?.conversationId,
                    senderId: user?.id,
                    message: messageToSend,
                    receiverId: messages?.receiver?.receiverId
                })
            });

            if (res.ok) {
                // Refresh conversations list to show new conversations
                const loggedInUser = JSON.parse(localStorage.getItem('user:detail'));
                const conversationsRes = await fetch(`${config.API_URL}/api/conversations/${loggedInUser?.id}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                if (conversationsRes.ok) {
                    const conversationsData = await conversationsRes.json();
                    setConversations(conversationsData);
                }
            } else {
                console.error('Failed to save message to database');
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    return (
        <div className="h-screen flex bg-white">
            {/* Sidebar - Conversations */}
            <div className="w-80 bg-neutral-50 border-r border-neutral-200 flex flex-col">
                {/* User Profile Header */}
                <div className="p-6 border-b border-neutral-200">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <img
                                src={user?.picture || Avatar}
                                className="w-12 h-12 rounded-full object-cover border-2 border-primary-200"
                                alt="User"
                            />
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-white"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-neutral-900 truncate">{user?.fullName}</h3>
                            <p className="text-sm text-neutral-500">Online</p>
                        </div>
                        <div className="relative dropdown-container">
                            <button
                                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                                onClick={() => setShowDropdown(!showDropdown)}
                            >
                                <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {showDropdown && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50">
                                    <div className="px-4 py-2 border-b border-neutral-100">
                                        <p className="text-sm font-medium text-neutral-900">{user?.fullName}</p>
                                        <p className="text-xs text-neutral-500">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        <span>Sign out</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                        <h4 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Messages</h4>
                        {conversations.length > 0 ? (
                            <div className="space-y-1">
                                {conversations.map(({ conversationId, user: conversationUser }) => {
                                    const isActive = messages?.receiver?.receiverId === conversationUser?.receiverId;
                                    const isOnline = activeUsers.find(x => x.userId === conversationUser?.receiverId);

                                    return (
                                        <div
                                            key={conversationId}
                                            className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-neutral-100'
                                                }`}
                                            onClick={() => fetchMessages(conversationId, conversationUser)}
                                        >
                                            <div className="relative">
                                                <img src={Img1} className="w-12 h-12 rounded-full object-cover" alt="User" />
                                                {isOnline && (
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-white"></div>
                                                )}
                                            </div>
                                            <div className="ml-3 flex-1 min-w-0">
                                                <h3 className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-neutral-900'}`}>
                                                    {conversationUser?.fullName}
                                                </h3>
                                                <p className={`text-xs truncate ${isActive ? 'text-primary-600' : 'text-neutral-500'}`}>
                                                    {isOnline ? 'Online' : 'Offline'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-neutral-400 mb-2">
                                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-neutral-500">No conversations yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {messages?.receiver?.fullName ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-6 border-b border-neutral-200 bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="relative">
                                        <img src={Avatar} className="w-10 h-10 rounded-full object-cover" alt="User" />
                                        {activeUsers.find(x => x.userId === messages?.receiver?.receiverId) && (
                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-white"></div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-neutral-900">{messages?.receiver?.fullName}</h3>
                                        <p className="text-sm text-neutral-500">
                                            {activeUsers.find(x => x.userId === messages?.receiver?.receiverId) ? 'Online' : 'Offline'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </button>
                                    {messages.conversationId && (
                                        <button
                                            onClick={() => deleteChat(messages.conversationId)}
                                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                            title="Delete Chat"
                                        >
                                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    )}
                                    <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                                        <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-neutral-50">
                            {messages?.messages?.length > 0 ? (
                                <div className="space-y-4">
                                    {messages.messages.map(({ message, user: msgUser = {} }, index) => {
                                        const isOwnMessage = msgUser.id === user?.id;
                                        return (
                                            <div key={index} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${isOwnMessage
                                                    ? 'bg-primary-500 text-white rounded-br-sm'
                                                    : 'bg-white text-neutral-900 rounded-bl-sm shadow-soft'
                                                    }`}>
                                                    <p className="text-sm leading-relaxed">{message}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messageRef}></div>
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="text-neutral-400 mb-4">
                                            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                        </div>
                                        <p className="text-lg font-medium text-neutral-600 mb-2">No messages yet</p>
                                        <p className="text-sm text-neutral-500">Start a conversation with {messages?.receiver?.fullName}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Message Input */}
                        <div className="p-6 bg-white border-t border-neutral-200">
                            <div className="flex items-end space-x-3">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Type your message..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        inputClassName="resize-none border-neutral-200 focus:border-primary-500 focus:ring-primary-500"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                sendMessage();
                                            }
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={sendMessage}
                                    disabled={!message.trim()}
                                    className="p-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center bg-neutral-50">
                        <div className="text-center">
                            <div className="text-neutral-400 mb-4">
                                <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-neutral-700 mb-2">Welcome to Chatter</h3>
                            <p className="text-neutral-500">Select a conversation to start chatting</p>
                        </div>
                    </div>
                )}
            </div>
            {/* Contacts Sidebar */}
            <div className="w-80 bg-white border-l border-neutral-200 flex flex-col">
                <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-neutral-900">My Contacts</h4>
                    <button
                        onClick={() => setShowAddContact(!showAddContact)}
                        className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Add Contact"
                    >
                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {showAddContact && (
                        <div className="p-4 border-b border-neutral-200 bg-neutral-50">
                            <AddContactForm user={user} onContactAdded={handleContactAdded} />
                        </div>
                    )}

                    <div className="p-4">
                        {contacts.length > 0 ? (
                            <div className="space-y-1">
                                {contacts.map((contact) => {
                                    const isOnline = activeUsers.find(x => x.userId === contact.user?.receiverId);

                                    return (
                                        <div
                                            key={contact.contactId}
                                            className="group flex items-center p-3 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors relative"
                                        >
                                            <div
                                                onClick={() => fetchMessages('new', contact.user)}
                                                className="flex items-center flex-1"
                                            >
                                                <div className="relative">
                                                    <img
                                                        src={contact.user?.picture || Avatar}
                                                        className="w-12 h-12 rounded-full object-cover"
                                                        alt="Contact"
                                                    />
                                                    {isOnline && (
                                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-white"></div>
                                                    )}
                                                </div>
                                                <div className="ml-3 flex-1 min-w-0">
                                                    <h3 className="text-sm font-medium text-neutral-900 truncate">
                                                        {contact.user?.fullName}
                                                    </h3>
                                                    <p className="text-xs text-neutral-500 truncate">
                                                        {contact.user?.email}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Contact Actions */}
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => removeContact(contact.contactId)}
                                                    className="p-1 hover:bg-red-100 rounded-full transition-all"
                                                    title="Remove Contact"
                                                >
                                                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-neutral-400 mb-2">
                                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-neutral-500 mb-2">No contacts yet</p>
                                <button
                                    onClick={() => setShowAddContact(true)}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    Add your first contact
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
export default Dashboard
