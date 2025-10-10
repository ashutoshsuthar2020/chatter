import React, { useState, useEffect, useRef } from "react";
import Avatar from "./../../assets/user.svg"
import Input from "./../../components/Input"
import AddContactModal from "./../../components/ContactModal"
import ProfileModal from "./../../components/ProfileModal"
import ContactProfileModal from "./../../components/ContactProfileModal"
import GroupCreator from "./../../components/GroupCreator"
import GroupManager from "./../../components/GroupManager"
import GroupMembersModal from "./../../components/GroupMembersModal"
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom';
import config from '../../config'
import MessageStorage from '../../utils/messageStorage'
import syncService from '../../utils/syncService'

const Dashboard = () => {
    const getUserFromStorage = () => {
        try {
            const value = localStorage.getItem('user:detail');
            if (!value) return null;
            return JSON.parse(value);
        } catch (e) {
            return null;
        }
    };
    const [user, setUser] = useState(getUserFromStorage());
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState({});
    const [message, setMessage] = useState('');
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeUsers, setActiveUsers] = useState([]);
    const [socket, setSocket] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({}); // Store unread counts locally: {conversationId: count}
    const [lastSeenMessages, setLastSeenMessages] = useState({}); // Store last seen message IDs: {conversationId: messageId}
    const [showDropdown, setShowDropdown] = useState(false);
    const [showAddContact, setShowAddContact] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showContactProfile, setShowContactProfile] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false); // Prevent multiple rapid sends
    const [selectedContactProfile, setSelectedContactProfile] = useState(null);
    const [showGroupCreator, setShowGroupCreator] = useState(false);
    const [showGroupManager, setShowGroupManager] = useState(false);
    const [showGroupMembers, setShowGroupMembers] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'groups'
    const [syncStatus, setSyncStatus] = useState({ isOnline: true, isSyncing: false, unsyncedCount: 0 }); // Sync status
    const messageRef = useRef(null);
    const navigate = useNavigate();

    // Function to calculate initial unread counts for all conversations
    // Function to calculate initial unread counts for all conversations using localStorage + server data
    const calculateInitialUnreadCounts = async (conversationsList) => {
        const newUnreadCounts = {};
        const newLastSeenMessages = {};

        for (const conversation of conversationsList) {
            const conversationId = conversation.conversationId;

            try {
                // Load messages from localStorage + server (merged)
                const messages = await MessageStorage.loadFromServer(conversationId, config.API_URL, user?.id);

                // Get last seen message ID from localStorage (for faster access) or fallback to server
                let lastSeenMessageId = null;

                // First check localStorage for last seen message
                const localLastSeen = localStorage.getItem(`lastSeen_${conversationId}_${user?.id}`);
                if (localLastSeen) {
                    lastSeenMessageId = localLastSeen;
                    console.log(`Retrieved last seen message from localStorage for conversation ${conversationId}: ${lastSeenMessageId}`);
                } else {
                    // Fallback to server
                    try {
                        const readReceiptRes = await fetch(`${config.API_URL}/api/conversations/${conversationId}/read-receipt/${user?.id}`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                            }
                        });

                        if (readReceiptRes.ok) {
                            const readReceiptData = await readReceiptRes.json();
                            lastSeenMessageId = readReceiptData.lastSeenMessageId;
                            console.log(`Retrieved last seen message from server for conversation ${conversationId}: ${lastSeenMessageId}`);

                            // Store in localStorage for future use
                            if (lastSeenMessageId) {
                                localStorage.setItem(`lastSeen_${conversationId}_${user?.id}`, lastSeenMessageId);
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching last seen message from server for conversation ${conversationId}:`, error);
                    }
                }

                console.log(`Conversation ${conversationId}: Total messages: ${messages.length}, Message IDs:`, messages.map(m => m.messageId));

                if (!lastSeenMessageId) {
                    // If no last seen message, all messages are unread
                    newUnreadCounts[conversationId] = messages.length;
                } else {
                    // Count messages after the last seen message
                    // Convert both to strings for comparison since ObjectId might be returned as different formats
                    const lastSeenIndex = messages.findIndex(msg =>
                        msg.messageId?.toString() === lastSeenMessageId?.toString()
                    );
                    if (lastSeenIndex === -1) {
                        // Last seen message not found, all messages are unread
                        newUnreadCounts[conversationId] = messages.length;
                        console.log(`Last seen message ${lastSeenMessageId} not found in conversation ${conversationId}, marking all ${messages.length} messages as unread`);
                    } else {
                        // Count messages after the last seen message
                        newUnreadCounts[conversationId] = messages.length - lastSeenIndex - 1;
                        console.log(`Found last seen message at index ${lastSeenIndex} in conversation ${conversationId}, ${messages.length - lastSeenIndex - 1} messages are unread`);
                    }
                }

                // Store the last seen message ID
                if (lastSeenMessageId) {
                    newLastSeenMessages[conversationId] = lastSeenMessageId;
                } else if (messages.length > 0) {
                    // Fallback: use the latest message as reference
                    newLastSeenMessages[conversationId] = messages[messages.length - 1].messageId;
                }
            } catch (error) {
                console.error(`Error calculating unread count for conversation ${conversationId}:`, error);
                newUnreadCounts[conversationId] = 0;
            }
        }

        setUnreadCounts(newUnreadCounts);
        setLastSeenMessages(newLastSeenMessages);
        console.log('Initial unread counts calculated from localStorage + server:', newUnreadCounts);
        console.log('Last seen messages retrieved:', newLastSeenMessages);
    }; const handleProfileUpdate = (updatedUser) => {
        setUser(updatedUser);
    };

    const handleLogout = () => {
        // Clear localStorage
        localStorage.removeItem('user:token');
        localStorage.removeItem('user:detail');

        // Clear message storage and sync data
        MessageStorage.clearAll();

        // Clear last seen messages for all conversations
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('lastSeen_')) {
                localStorage.removeItem(key);
            }
        });

        // Stop sync service
        syncService.stopPeriodicSync();

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

    // Initialize sync service
    useEffect(() => {
        const initializeSync = async () => {
            try {
                // Get sync configuration from server
                const configRes = await fetch(`${config.API_URL}/api/sync/config`);
                if (configRes.ok) {
                    const syncConfig = await configRes.json();
                    console.log('Sync configuration:', syncConfig);

                    // Start periodic sync with server-defined interval
                    syncService.startPeriodicSync(syncConfig.syncIntervalMinutes);
                } else {
                    // Fallback to default 5-minute sync
                    console.log('Using default sync interval: 5 minutes');
                    syncService.startPeriodicSync(5);
                }

                // Update sync status
                const updateSyncStatus = () => {
                    setSyncStatus(syncService.getSyncStatus());
                };

                // Initial status update
                updateSyncStatus();

                // Listen for sync events
                window.addEventListener('syncCompleted', updateSyncStatus);

                // Periodic status updates
                const statusInterval = setInterval(updateSyncStatus, 10000); // Every 10 seconds

                return () => {
                    window.removeEventListener('syncCompleted', updateSyncStatus);
                    clearInterval(statusInterval);
                };
            } catch (error) {
                console.error('Error initializing sync service:', error);
                // Fallback to default sync
                syncService.startPeriodicSync(5);
            }
        };

        if (user?.id) {
            initializeSync();
        }

        return () => {
            syncService.stopPeriodicSync();
        };
    }, [user?.id]);

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
                console.log('Active users updated (legacy):', users);
                setActiveUsers(users);
            });

            // Listen for NATS-based active users update
            socket.on('activeUsers', users => {
                console.log('[Socket] Received activeUsers event:', users);
                setActiveUsers(users);
            });

            socket.on('getMessage', data => {
                console.log('Received message:', data);
                console.log('Current messages state:', messages);
                console.log('Is current conversation:', messages?.conversationId === data.conversationId);

                // Save received message to localStorage immediately with sequence number
                const messageData = {
                    messageId: data.messageId,
                    senderId: data.senderId,
                    message: data.message,
                    timestamp: data.timestamp || new Date().toISOString(),
                    sequenceNumber: data.sequenceNumber || 0 // Add sequence number for ordering
                };

                MessageStorage.addMessage(data.conversationId, messageData);
                console.log('Saved received message to localStorage with sequence:', messageData.sequenceNumber);

                // Check if this is a message from someone not in contacts
                const isNewContact = !contacts.find(contact =>
                    contact.user?.receiverId === data.senderId ||
                    contact.user?.receiverId === data.user?.id
                );

                // If it's from a new contact, refresh the contacts list
                if (isNewContact && window.refreshContacts) {
                    setTimeout(() => {
                        window.refreshContacts();
                    }, 500); // Small delay to ensure backend processing is complete
                }

                // Check if this message is for the currently active conversation
                const isCurrentConversation = messages?.conversationId === data.conversationId;

                if (isCurrentConversation) {
                    // If we're viewing this conversation, mark the new message as seen immediately
                    // Reset unread count to 0 and update last seen message
                    setUnreadCounts(prev => ({
                        ...prev,
                        [data.conversationId]: 0
                    }));

                    // Update last seen message to this new message
                    setLastSeenMessages(prev => ({
                        ...prev,
                        [data.conversationId]: data.messageId
                    }));

                    console.log(`Marked new message as seen for active conversation ${data.conversationId}`);
                } else {
                    // Only increment unread count if this message is NOT for the currently active conversation
                    setUnreadCounts(prev => ({
                        ...prev,
                        [data.conversationId]: (prev[data.conversationId] || 0) + 1
                    }));
                    console.log(`Incremented unread count for conversation ${data.conversationId}`);
                }

                setMessages(prev => {
                    // Check if this message is for the current active conversation
                    if (prev.conversationId && data.conversationId === prev.conversationId) {
                        console.log('Updating messages state for real-time message:', data);
                        // Check if message already exists to avoid duplicates
                        // Use messageId if available, otherwise fall back to content and sender matching
                        const messageExists = prev.messages?.some(msg => {
                            // If both have messageId, compare by messageId
                            if (msg.messageId && data.messageId) {
                                return msg.messageId === data.messageId;
                            }
                            // Check if this is an optimistic message that should be replaced
                            if (msg.isOptimistic && msg.message === data.message && msg.user?.id === data.senderId) {
                                return true; // Let the optimistic update logic handle this
                            }
                            // Otherwise, check by content, sender, and recent timestamp
                            return msg.message === data.message &&
                                msg.user?.id === data.senderId &&
                                Math.abs(new Date(msg.timestamp) - new Date()) < 5000; // Within 5 seconds
                        });

                        if (!messageExists) {
                            // If this is a message from ourselves and we already have an optimistic message,
                            // replace the optimistic message instead of adding a new one
                            const optimisticIndex = prev.messages?.findIndex(msg =>
                                msg.isOptimistic &&
                                msg.message === data.message &&
                                msg.user?.id === data.senderId
                            );

                            if (optimisticIndex !== -1) {
                                // Replace optimistic message with real one
                                const updatedMessages = [...(prev.messages || [])];
                                updatedMessages[optimisticIndex] = {
                                    user: { id: data.senderId, ...data.user },
                                    message: data.message,
                                    timestamp: new Date(),
                                    messageId: data.messageId,
                                    isOptimistic: false
                                };
                                return {
                                    ...prev,
                                    messages: updatedMessages
                                };
                            } else {
                                // Add new message normally
                                return {
                                    ...prev,
                                    messages: [...(prev.messages || []), {
                                        user: { id: data.senderId, ...data.user },
                                        message: data.message,
                                        timestamp: new Date(),
                                        messageId: data.messageId
                                    }]
                                };
                            }
                        }
                    }
                    return prev;
                });
            });

            // Listen for new group creation
            socket.on('groupCreated', (data) => {
                console.log('Group created:', data);
                // Add the new group to the groups list
                setGroups(prev => [...prev, data.group]);
                // Add the new conversation to the conversations list
                setConversations(prev => [...prev, data.conversation]);
                // Show notification
                alert(data.message);
            });

            // Listen for group member additions
            socket.on('addedToGroup', (data) => {
                console.log('Added to group:', data);
                // Add the new group to the groups list
                setGroups(prev => [...prev, data.group]);

                // Find and add the conversation for this group to the conversations list
                const groupConversation = {
                    conversationId: data.group.conversationId || data.conversationId, // Handle both cases
                    isGroup: true,
                    group: {
                        id: data.group._id,
                        name: data.group.name,
                        profilePicture: data.group.profilePicture,
                        memberCount: data.group.members.length
                    }
                };
                setConversations(prev => [...prev, groupConversation]);

                // Show notification
                alert(data.message);
            });

            // Listen for other members being added to groups you're in
            socket.on('groupMemberAdded', (data) => {
                console.log('Group member added:', data);
                // Update the group in the groups list
                setGroups(prev => prev.map(g => g._id === data.groupId ? data.group : g));

                // Update selected group if it's currently selected
                if (selectedGroup?._id === data.groupId) {
                    setSelectedGroup(data.group);
                }

                // Update messages state if currently viewing this group
                if (messages?.isGroup && messages?.groupId === data.groupId) {
                    setMessages(prev => ({
                        ...prev,
                        groupMembers: data.group.members
                    }));
                }
            });

            // Listen for being removed from group
            socket.on('removedFromGroup', (data) => {
                console.log('Removed from group:', data);
                // Remove group from groups list
                setGroups(prev => prev.filter(g => g._id !== data.groupId));

                // Clear selected group if it's the one we were removed from
                if (selectedGroup?._id === data.groupId) {
                    setSelectedGroup(null);
                }

                // Clear messages if currently viewing this group
                if (messages?.isGroup && messages?.groupId === data.groupId) {
                    setMessages({});
                }

                // Show notification
                alert(data.message);
            });

            // Listen for other members being removed from groups you're in
            socket.on('groupMemberRemoved', (data) => {
                console.log('Group member removed:', data);
                // Update the group in the groups list
                setGroups(prev => prev.map(g => g._id === data.groupId ? data.group : g));

                // Update selected group if it's currently selected
                if (selectedGroup?._id === data.groupId) {
                    setSelectedGroup(data.group);
                }

                // Update messages state if currently viewing this group
                if (messages?.isGroup && messages?.groupId === data.groupId) {
                    setMessages(prev => ({
                        ...prev,
                        groupMembers: data.group.members
                    }));
                }
            });

            // Listen for real-time conversation list updates
            socket.on('conversationsListUpdated', (data) => {
                console.log('Conversations list updated:', data);
                console.log('Updated conversations count:', data.conversations?.length);

                // Update the conversations list with the new sorted order
                if (data.conversations && Array.isArray(data.conversations)) {
                    setConversations(data.conversations);
                    console.log('Conversation list updated in real-time due to:', data.action);
                } else {
                    console.warn('Invalid conversations data received:', data);
                }
            });

            // Listen for new conversation creation (e.g., when a contact is added and a message is sent)
            socket.on('conversationCreated', (data) => {
                console.log('New conversation created:', data);
                // Optionally, fetch updated conversations from server or update state
                // For now, trigger a refresh of the conversations list
                if (window.refreshConversations) {
                    setTimeout(() => {
                        window.refreshConversations();
                    }, 500);
                }
            });

            // Listen for new contact message (when a message is received from a new contact)
            socket.on('newContactMessage', (data) => {
                console.log('New contact message received:', data);
                // Optionally, refresh contacts and conversations
                if (window.refreshContacts) {
                    setTimeout(() => {
                        window.refreshContacts();
                    }, 500);
                }
                if (window.refreshConversations) {
                    setTimeout(() => {
                        window.refreshConversations();
                    }, 500);
                }
            });

            // Listen for conversation updates (e.g., new message in a conversation)
            socket.on('conversationUpdated', (data) => {
                console.log('Conversation updated:', data);
                // Optionally, update the specific conversation in state
                // For now, trigger a refresh of the conversations list
                if (window.refreshConversations) {
                    setTimeout(() => {
                        window.refreshConversations();
                    }, 500);
                }
            });

            // Cleanup function to remove event listeners
            return () => {
                socket.off('connect');
                socket.off('disconnect');
                socket.off('getUsers');
                socket.off('getMessage');
                socket.off('groupCreated');
                socket.off('addedToGroup');
                socket.off('groupMemberAdded');
                socket.off('removedFromGroup');
                socket.off('groupMemberRemoved');
                socket.off('conversationsListUpdated');
            };
        }
    }, [socket, user?.id]);

    useEffect(() => {
        messageRef?.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages?.messages]);

    // Auto-mark messages as read when viewing a conversation
    useEffect(() => {
        if (messages?.conversationId && messages?.messages?.length > 0) {
            const lastMessage = messages.messages[messages.messages.length - 1];

            // Reset unread count to 0 for the active conversation
            setUnreadCounts(prev => ({
                ...prev,
                [messages.conversationId]: 0
            }));

            // Update last seen message to the latest message
            setLastSeenMessages(prev => ({
                ...prev,
                [messages.conversationId]: lastMessage.messageId
            }));

            console.log(`Auto-marked conversation ${messages.conversationId} as read`);
        }
    }, [messages?.conversationId, messages?.messages?.length]);

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
        let loggedInUser = null;
        try {
            const value = localStorage.getItem('user:detail');
            if (value) loggedInUser = JSON.parse(value);
        } catch (e) {
            loggedInUser = null;
        }
        const fetchConversations = async () => {
            const res = await fetch(`${config.API_URL}/api/conversations/${loggedInUser?.id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const resData = await res.json();
            setConversations(resData);

            // Calculate initial unread counts for all conversations only once
            if (resData && resData.length > 0 && Object.keys(unreadCounts).length === 0) {
                calculateInitialUnreadCounts(resData);
            }
        }

        if (loggedInUser?.id) {
            fetchConversations();
        }
    }, [user?.id]); // Changed dependency to user?.id instead of empty array

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

        // Create a function that can be called from anywhere
        window.refreshContacts = fetchContacts;

        if (user?.id) {
            fetchContacts();
        }

        // Cleanup
        return () => {
            delete window.refreshContacts;
        };
    }, [user?.id]);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await fetch(`${config.API_URL}/api/groups/${user?.id}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                const resData = await res.json();
                setGroups(resData);
            } catch (error) {
                console.error('Error fetching groups:', error);
            }
        };

        if (user?.id) {
            fetchGroups();
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

    // Helper function to find conversation ID for a contact
    const findConversationForContact = (contactUser) => {
        // Look for existing conversation with this contact
        const existingConversation = conversations.find(conv => {
            if (conv.isGroup) return false;
            return conv.user?.receiverId === contactUser.receiverId;
        });

        if (existingConversation) {
            console.log(`Found existing conversation for contact ${contactUser.fullName}:`, existingConversation.conversationId);
            return existingConversation.conversationId;
        }

        console.log(`No existing conversation found for contact ${contactUser.fullName}, will create new`);
        return 'new';
    };

    const fetchMessages = async (conversationId, receiver) => {
        try {
            let actualConversationId = conversationId;

            // If conversationId is 'new', try to find existing conversation or create one
            if (conversationId === 'new' && receiver?.receiverId) {
                // First check if there's an existing conversation in our conversations list
                const existingConversation = conversations.find(conv => {
                    if (conv.isGroup) return false;
                    return conv.user?.receiverId === receiver.receiverId;
                });

                if (existingConversation) {
                    actualConversationId = existingConversation.conversationId;
                    console.log(`Found existing conversation for ${receiver.fullName}: ${actualConversationId}`);
                } else {
                    // Try to create or find conversation on server
                    try {
                        const response = await fetch(`${config.API_URL}/api/conversations`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                senderId: user?.id,
                                receiverId: receiver.receiverId
                            })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            actualConversationId = data.conversationId;
                            console.log(`Created/found conversation on server: ${actualConversationId}`);
                        } else {
                            console.error('Failed to create/find conversation on server');
                            // Keep as 'new' and let the message send create it
                            actualConversationId = 'new';
                        }
                    } catch (error) {
                        console.error('Error creating/finding conversation:', error);
                        actualConversationId = 'new';
                    }
                }
            }

            // Load messages from localStorage + server (merged)
            const mergedMessages = await MessageStorage.loadFromServer(actualConversationId, config.API_URL, user?.id);

            // Set messages state
            setMessages({
                messages: mergedMessages,
                receiver,
                conversationId: actualConversationId,
                isGroup: false
            });

            // Reset unread count for this conversation
            setUnreadCounts(prev => ({
                ...prev,
                [actualConversationId]: 0
            }));

            // Store the last message ID as the last seen message in localStorage
            if (mergedMessages && mergedMessages.length > 0) {
                const lastMessage = mergedMessages[mergedMessages.length - 1];
                const lastMessageId = lastMessage.messageId;

                // Update localStorage
                localStorage.setItem(`lastSeen_${actualConversationId}_${user?.id}`, lastMessageId);

                // Update state
                setLastSeenMessages(prev => ({
                    ...prev,
                    [actualConversationId]: lastMessageId
                }));

                console.log(`Marked conversation ${actualConversationId} as read up to message ${lastMessageId}`);
            }

        } catch (error) {
            console.error('Error fetching messages:', error);
            // Fallback to empty state
            setMessages({ messages: [], receiver, conversationId, isGroup: false });
        }
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

    // Group Members Handler Functions
    const handleMemberRemoved = (updatedGroup) => {
        // Update the groups list
        setGroups(prev => prev.map(g => g._id === updatedGroup._id ? updatedGroup : g));

        // Update selected group if it's the current one
        if (selectedGroup?._id === updatedGroup._id) {
            setSelectedGroup(updatedGroup);
        }

        // Update messages state if currently viewing this group
        if (messages?.isGroup && messages?.groupId === updatedGroup._id) {
            setMessages(prev => ({
                ...prev,
                groupMembers: updatedGroup.members
            }));
        }
    };

    const handleLeaveGroup = (groupId) => {
        // Remove group from groups list
        setGroups(prev => prev.filter(g => g._id !== groupId));

        // Clear selected group if it's the one we left
        if (selectedGroup?._id === groupId) {
            setSelectedGroup(null);
        }

        // Clear messages if currently viewing this group
        if (messages?.isGroup && messages?.groupId === groupId) {
            setMessages({});
        }
    };

    const sendMessage = async (e) => {
        // Prevent form submission and multiple rapid calls
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        // Prevent multiple rapid sends
        if (isSendingMessage || !message.trim()) return;

        setIsSendingMessage(true);

        const messageToSend = message.trim();
        const conversationId = messages?.conversationId;

        // Clear input immediately to prevent double sends
        setMessage('');

        try {
            // Generate a unique message ID
            const messageId = `msg_${Date.now()}_${Math.random()}`;

            const newMessage = {
                messageId,
                senderId: user?.id,
                message: messageToSend,
                timestamp: new Date().toISOString(),
                user: { id: user?.id, fullName: user?.fullName, phoneNumber: user?.phoneNumber }
            };

            // Save to localStorage immediately
            const savedMessage = MessageStorage.addMessage(conversationId, newMessage);

            if (savedMessage) {
                // Update local UI state
                setMessages(prev => ({
                    ...prev,
                    messages: [...(prev.messages || []), {
                        messageId: savedMessage.messageId,
                        user: newMessage.user,
                        message: newMessage.message,
                        timestamp: new Date(newMessage.timestamp),
                        isOptimistic: true, // Mark as optimistic so it can be replaced when server confirms
                        isLocal: true
                    }]
                }));

                // Update unread counts - keep at 0 for sender
                setUnreadCounts(prev => ({
                    ...prev,
                    [conversationId]: 0
                }));

                // Update last seen message in localStorage
                localStorage.setItem(`lastSeen_${conversationId}_${user?.id}`, messageId);
                setLastSeenMessages(prev => ({
                    ...prev,
                    [conversationId]: messageId
                }));

                // Send via socket for real-time delivery to other users
                if (socket) {
                    const isGroupMessage = messages?.isGroup || false;

                    const socketData = {
                        messageId,
                        senderId: user?.id,
                        message: messageToSend,
                        conversationId,
                        receiverId: messages?.receiver?.receiverId,
                        isGroup: isGroupMessage,
                        timestamp: newMessage.timestamp,
                        user: {
                            id: user?.id,
                            fullName: user?.fullName,
                            phoneNumber: user?.phoneNumber
                        }
                    };

                    // Send via socket using 'sendMessage' for both regular and group messages
                    // The server will handle the routing based on isGroup flag
                    socket.emit('sendMessage', socketData);

                    console.log('Message sent via socket and stored in localStorage:', socketData);
                }

                // Update sync status
                setSyncStatus(syncService.getSyncStatus());

            } else {
                console.error('Failed to save message to localStorage');
                alert('Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            // Reset sending flag after a short delay to prevent rapid clicks
            setTimeout(() => setIsSendingMessage(false), 300);
        }
    }

    const fetchGroupMessages = async (conversationId, group) => {
        try {
            const res = await fetch(`${config.API_URL}/api/message/${conversationId}?senderId=${user?.id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const resData = await res.json();
            setMessages({
                messages: resData.mssgData,
                receiver: null,
                group: group,
                conversationId: conversationId, // Use the passed conversationId instead of resData.conversationId
                isGroup: true,
                groupId: group._id,
                groupName: group.name,
                groupMembers: group.members
            });
            setSelectedGroup(group);

            // Reset unread count for this group conversation
            setUnreadCounts(prev => ({
                ...prev,
                [conversationId]: 0
            }));

            // Store the last message ID as the last seen message
            if (resData.mssgData && resData.mssgData.length > 0) {
                const lastMessage = resData.mssgData[resData.mssgData.length - 1];
                setLastSeenMessages(prev => ({
                    ...prev,
                    [conversationId]: lastMessage.messageId
                }));
            }

            // Mark messages as read for this group conversation
            if (conversationId && conversationId !== 'new') {
                try {
                    await fetch(`${config.API_URL}/api/conversations/${conversationId}/mark-read`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userId: user?.id,
                            isGroup: true
                        })
                    });
                    console.log(`Marked group conversation ${conversationId} as read`);
                } catch (error) {
                    console.error('Error marking group messages as read:', error);
                }
            }
        } catch (error) {
            console.error('Error fetching group messages:', error);
        }
    };

    const sendGroupMessage = async () => {
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
            // Save to database and handle real-time delivery via API
            const res = await fetch(`${config.API_URL}/api/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId: messages?.conversationId,
                    senderId: user?.id,
                    message: messageToSend,
                    isGroup: true
                })
            });

            if (res.ok) {
                const responseData = await res.json();

                // Mark the sent group message as read for the sender
                // Keep unread count at 0 for yourself when you send a message
                setUnreadCounts(prev => ({
                    ...prev,
                    [messages?.conversationId]: 0
                }));

                // Update last seen message to the message you just sent
                if (responseData.messageId) {
                    setLastSeenMessages(prev => ({
                        ...prev,
                        [messages?.conversationId]: responseData.messageId
                    }));

                    // Mark as read in MongoDB for the sender
                    try {
                        await fetch(`${config.API_URL}/api/conversations/${messages?.conversationId}/mark-read`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                userId: user?.id,
                                isGroup: true,
                                lastSeenMessageId: responseData.messageId
                            })
                        });
                        console.log(`Marked sent group message as read for sender in conversation ${messages?.conversationId}`);
                    } catch (error) {
                        console.error('Error marking sent group message as read:', error);
                    }
                }
            } else {
                console.error('Failed to save group message to database');
            }
        } catch (error) {
            console.error('Error sending group message:', error);
        }
    };

    return (
        <div className="h-screen flex bg-white">
            {/* Sidebar - Conversations */}
            <div className="w-80 bg-neutral-50 border-r border-neutral-200 flex flex-col">
                {/* User Profile Header */}
                <div className="p-6 border-b border-neutral-200">
                    <div className="flex items-start space-x-4">
                        <div className="relative cursor-pointer" onClick={() => setShowProfileModal(true)}>
                            <img
                                src={user?.picture || Avatar}
                                className="w-14 h-14 rounded-full object-cover border-2 border-primary-200 hover:border-primary-300 transition-colors"
                                alt="User"
                            />
                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-accent rounded-full border-2 border-white"></div>
                            {/* Edit icon overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200">
                                <svg className="w-5 h-5 text-white opacity-0 hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-neutral-900 truncate">{user?.fullName}</h3>
                                <button
                                    onClick={() => setShowProfileModal(true)}
                                    className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                                    title="Edit Profile"
                                >
                                    <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-sm text-neutral-500">Online</p>
                            {user?.bio && (
                                <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{user.bio}</p>
                            )}
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
                                        <p className="text-xs text-neutral-500">{user?.phoneNumber}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowProfileModal(true);
                                            setShowDropdown(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center space-x-2 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Edit Profile</span>
                                    </button>
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

                {/* Tabs for Chats and Groups */}
                <div className="px-4 pt-2 pb-0 border-b border-neutral-200">
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setActiveTab('chats')}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'chats'
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                                }`}
                        >
                            Chats
                        </button>
                        <button
                            onClick={() => setActiveTab('groups')}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'groups'
                                ? 'bg-primary-100 text-primary-700'
                                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                                }`}
                        >
                            Groups
                        </button>
                    </div>
                </div>

                {/* Content based on active tab */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                        {activeTab === 'chats' ? (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">Messages</h4>
                                    <button
                                        onClick={() => setShowAddContact(true)}
                                        className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                                        title="Add New Contact"
                                    >
                                        <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </button>
                                </div>
                                {conversations.length > 0 ? (
                                    <div className="space-y-1">
                                        {contacts.map((contact) => {
                                            const conversation = conversations.find(
                                                conv => !conv.isGroup && conv.user?.receiverId === contact.user?.receiverId
                                            );
                                            if (!conversation) return null;
                                            const { conversationId, user: conversationUser } = conversation;
                                            const isActive = messages?.receiver?.receiverId === conversationUser?.receiverId;
                                            // Debug log for mapping
                                            console.log('[ContactList] activeUsers:', activeUsers);
                                            console.log('[ContactList] Checking contact receiverId:', conversationUser?.receiverId);
                                            const isOnline = activeUsers.find(x => x.userId === conversationUser?.receiverId);
                                            console.log(`[ContactList] Contact ${conversationUser?.receiverId} online:`, !!isOnline);
                                            return (
                                                <div
                                                    key={conversationId}
                                                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-neutral-100'}`}
                                                    onClick={() => fetchMessages(conversationId, conversationUser)}
                                                >
                                                    <div className="relative">
                                                        <img src={contact.user?.picture || conversationUser?.picture || Avatar} className="w-12 h-12 rounded-full object-cover" alt="User" />
                                                        {isOnline && (
                                                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-white"></div>
                                                        )}
                                                        {/* Unread count badge for regular conversations */}
                                                        {unreadCounts[conversationId] > 0 && (
                                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                                                {unreadCounts[conversationId] > 99 ? '99+' : unreadCounts[conversationId]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-3 flex-1 min-w-0">
                                                        <h3 className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-neutral-900'}`}>{contact.user?.fullName}</h3>
                                                        <p className={`text-xs truncate ${isActive ? 'text-primary-600' : 'text-neutral-500'}`}>{conversation.lastMessage ? conversation.lastMessage.message : (isOnline ? 'Online' : 'Offline')}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Render group conversations below contacts */}
                                        {conversations.filter(conv => conv.isGroup).map((conversation) => {
                                            const { conversationId, group } = conversation;
                                            const isActive = messages?.isGroup && messages?.groupId === group.id;
                                            return (
                                                <div
                                                    key={conversationId}
                                                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-neutral-100'}`}
                                                    onClick={() => {
                                                        const groupConversation = conversations.find(conv => conv.isGroup && conv.group && conv.group.id === group.id);
                                                        if (groupConversation) {
                                                            fetchGroupMessages(conversationId, group);
                                                        }
                                                    }}
                                                >
                                                    <div className="relative">
                                                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                                                            {group.profilePicture ? (
                                                                <img src={group.profilePicture} className="w-12 h-12 rounded-full object-cover" alt="Group" />
                                                            ) : (
                                                                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        {/* Unread count badge for groups */}
                                                        {unreadCounts[conversationId] > 0 && (
                                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                                                                {unreadCounts[conversationId] > 99 ? '99+' : unreadCounts[conversationId]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-3 flex-1 min-w-0">
                                                        <h3 className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-neutral-900'}`}>{group.name}</h3>
                                                        <p className={`text-xs truncate ${isActive ? 'text-primary-600' : 'text-neutral-500'}`}>{conversation.lastMessage ? conversation.lastMessage.message : 'No messages yet'} • {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-neutral-500 mb-4">No conversations yet</p>
                                        <button
                                            onClick={() => setShowAddContact(true)}
                                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                        >
                                            Add contacts to start chatting
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">Groups</h4>
                                    <button
                                        onClick={() => setShowGroupCreator(true)}
                                        className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
                                        title="Create Group"
                                    >
                                        <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </button>
                                </div>
                                {groups.length > 0 ? (
                                    <div className="space-y-1">
                                        {groups.map((group) => {
                                            const isActive = messages?.isGroup && messages?.groupId === group._id;

                                            return (
                                                <div
                                                    key={group._id}
                                                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-colors ${isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-neutral-100'
                                                        }`}
                                                    onClick={() => {
                                                        // Find the conversation that corresponds to this group
                                                        const groupConversation = conversations.find(conv =>
                                                            conv.isGroup && conv.group && conv.group.id === group._id
                                                        );
                                                        if (groupConversation) {
                                                            fetchGroupMessages(groupConversation.conversationId, group);
                                                        } else {
                                                            console.error('No conversation found for group:', group._id);
                                                        }
                                                    }}
                                                >
                                                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                        </svg>
                                                    </div>
                                                    <div className="ml-3 flex-1 min-w-0">
                                                        <h3 className={`text-sm font-medium truncate ${isActive ? 'text-primary-700' : 'text-neutral-900'}`}>
                                                            {group.name}
                                                        </h3>
                                                        <p className={`text-xs truncate ${isActive ? 'text-primary-600' : 'text-neutral-500'}`}>
                                                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                    {group.createdBy?._id === user?.id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedGroup(group);
                                                                setShowGroupManager(true);
                                                            }}
                                                            className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors ml-2"
                                                            title="Manage Group"
                                                        >
                                                            <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-sm text-neutral-500 mb-4">No groups yet</p>
                                        <button
                                            onClick={() => setShowGroupCreator(true)}
                                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                        >
                                            Create your first group
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {(messages?.receiver?.fullName || messages?.isGroup) ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-6 border-b border-neutral-200 bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    {messages?.isGroup ? (
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-neutral-900">{messages?.groupName}</h3>
                                                <p className="text-sm text-neutral-500">
                                                    {messages?.groupMembers?.length} member{messages?.groupMembers?.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-4">
                                            <div
                                                className="relative cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => {
                                                    // Get the most current contact data
                                                    const currentContact = contacts.find(c => c.user?.receiverId === messages?.receiver?.receiverId);
                                                    setSelectedContactProfile(currentContact?.user || messages?.receiver);
                                                    setShowContactProfile(true);
                                                }}
                                                title="View contact profile"
                                            >
                                                <img
                                                    src={(() => {
                                                        // Get the most current profile picture from contacts list
                                                        const currentContact = contacts.find(c => c.user?.receiverId === messages?.receiver?.receiverId);
                                                        return currentContact?.user?.picture || messages?.receiver?.picture || Avatar;
                                                    })()}
                                                    className="w-10 h-10 rounded-full object-cover border-2 border-transparent hover:border-primary-300 transition-colors"
                                                    alt="User"
                                                />
                                                {activeUsers.find(x => x.userId === messages?.receiver?.receiverId) && (
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-accent rounded-full border-2 border-white"></div>
                                                )}
                                            </div>
                                            <div
                                                className="cursor-pointer hover:bg-neutral-50 rounded-lg p-2 -m-2 transition-colors"
                                                onClick={() => {
                                                    // Get the most current contact data
                                                    const currentContact = contacts.find(c => c.user?.receiverId === messages?.receiver?.receiverId);
                                                    setSelectedContactProfile(currentContact?.user || messages?.receiver);
                                                    setShowContactProfile(true);
                                                }}
                                                title="View contact profile"
                                            >
                                                <h3 className="text-lg font-semibold text-neutral-900 hover:text-primary-600 transition-colors">
                                                    {(() => {
                                                        // Get the most current full name from contacts list
                                                        const currentContact = contacts.find(c => c.user?.receiverId === messages?.receiver?.receiverId);
                                                        return currentContact?.user?.fullName || messages?.receiver?.fullName;
                                                    })()}
                                                </h3>
                                                <p className="text-sm text-neutral-500">
                                                    {activeUsers.find(x => x.userId === messages?.receiver?.receiverId) ? 'Online' : 'Offline'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center space-x-2">
                                    {messages?.isGroup ? (
                                        // Group actions
                                        <>
                                            {selectedGroup?.createdBy?._id === user?.id && (
                                                <button
                                                    onClick={() => setShowGroupManager(true)}
                                                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                                                    title="Manage Group"
                                                >
                                                    <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setShowGroupMembers(true);
                                                }}
                                                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                                                title="View Members"
                                            >
                                                <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            </button>
                                        </>
                                    ) : (
                                        // Individual chat actions
                                        <>
                                            <button
                                                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                                                onClick={() => {
                                                    // Get the most current contact data
                                                    const currentContact = contacts.find(c => c.user?.receiverId === messages?.receiver?.receiverId);
                                                    setSelectedContactProfile(currentContact?.user || messages?.receiver);
                                                    setShowContactProfile(true);
                                                }}
                                                title="View Profile"
                                            >
                                                <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </button>
                                            <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                                                <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                    {(messages.conversationId || messages?.isGroup) && (
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
                                                <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? '' : 'flex flex-col'}`}>
                                                    {/* Show sender name for group messages (except own messages) */}
                                                    {messages?.isGroup && !isOwnMessage && (
                                                        <span className="text-xs text-neutral-500 mb-1 ml-3">
                                                            {msgUser.fullName || 'Unknown User'}
                                                        </span>
                                                    )}
                                                    <div className={`px-4 py-3 rounded-2xl ${isOwnMessage
                                                        ? 'bg-primary-500 text-white rounded-br-sm'
                                                        : 'bg-white text-neutral-900 rounded-bl-sm shadow-soft'
                                                        }`}>
                                                        <p className="text-sm leading-relaxed">{message}</p>
                                                    </div>
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
                                        <p className="text-sm text-neutral-500">
                                            {messages?.isGroup
                                                ? `Start chatting in ${messages?.groupName}`
                                                : `Start a conversation with ${messages?.receiver?.fullName}`
                                            }
                                        </p>
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
                                            if (e.key === 'Enter' && !isSendingMessage) {
                                                e.preventDefault();
                                                sendMessage();
                                            }
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={sendMessage}
                                    disabled={!message.trim() || isSendingMessage}
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
                    <div className="p-4">
                        {contacts.length > 0 ? (
                            <div className="space-y-1">
                                {contacts.map((contact) => {
                                    console.log('[ContactList] activeUsers:', activeUsers);
                                    console.log(`[ContactList] Checking contact receiverId: ${contact.user?.receiverId}`);
                                    activeUsers.forEach(u => console.log(`[ContactList] activeUser: userId=${u.userId}, socketId=${u.socketId}`));
                                    const isOnline = activeUsers.find(x => x.userId === contact.user?.receiverId);
                                    console.log(`[ContactList] Contact ${contact.user?.receiverId} online:`, !!isOnline);

                                    return (
                                        <div
                                            key={contact.contactId}
                                            className="group flex items-center p-3 rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors relative"
                                        >
                                            <div
                                                onClick={() => {
                                                    const conversationId = findConversationForContact(contact.user);
                                                    fetchMessages(conversationId, contact.user);
                                                }}
                                                className="flex items-center flex-1"
                                            >
                                                <div
                                                    className="relative cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedContactProfile(contact.user);
                                                        setShowContactProfile(true);
                                                    }}
                                                    title="View profile"
                                                >
                                                    <img
                                                        src={contact.user?.picture || Avatar}
                                                        className="w-12 h-12 rounded-full object-cover border-2 border-transparent hover:border-primary-300 transition-colors"
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
                                                        {contact.user?.phoneNumber}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Contact Actions */}
                                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedContactProfile(contact.user);
                                                        setShowContactProfile(true);
                                                    }}
                                                    className="p-1 hover:bg-primary-100 rounded-full transition-all"
                                                    title="View Profile"
                                                >
                                                    <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </button>
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

            {/* Profile Modal */}
            {showProfileModal && (
                <ProfileModal
                    user={user}
                    onClose={() => setShowProfileModal(false)}
                    onUpdateProfile={handleProfileUpdate}
                />
            )}

            {/* Contact Profile Modal */}
            {showContactProfile && (
                <ContactProfileModal
                    contact={selectedContactProfile}
                    activeUsers={activeUsers}
                    onClose={() => {
                        setShowContactProfile(false);
                        setSelectedContactProfile(null);
                    }}
                />
            )}

            {/* Add Contact Modal */}
            {showAddContact && (
                <AddContactModal
                    user={user}
                    contacts={contacts}
                    onClose={() => setShowAddContact(false)}
                    onContactAdded={(newContact) => {
                        setContacts([...contacts, newContact]);
                        setShowAddContact(false);
                    }}
                />
            )}

            {/* Group Creator Modal */}
            {showGroupCreator && (
                <GroupCreator
                    user={user}
                    contacts={contacts}
                    onClose={() => setShowGroupCreator(false)}
                    onCreateGroup={(newGroup) => {
                        setGroups([...groups, newGroup]);
                        setShowGroupCreator(false);
                    }}
                />
            )}

            {/* Group Manager Modal */}
            {showGroupManager && selectedGroup && (
                <GroupManager
                    user={user}
                    group={selectedGroup}
                    contacts={contacts}
                    onClose={() => {
                        setShowGroupManager(false);
                        setSelectedGroup(null);
                    }}
                    onUpdateGroup={(updatedGroup) => {
                        setGroups(groups.map(g => g._id === updatedGroup._id ? updatedGroup : g));
                        setSelectedGroup(updatedGroup);
                    }}
                />
            )}

            {/* Group Members Modal */}
            {showGroupMembers && selectedGroup && (
                <GroupMembersModal
                    group={selectedGroup}
                    user={user}
                    contacts={contacts}
                    onClose={() => {
                        setShowGroupMembers(false);
                    }}
                    onMemberRemoved={handleMemberRemoved}
                    onLeaveGroup={handleLeaveGroup}
                />
            )}
        </div>
    )
}
export default Dashboard