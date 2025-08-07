const redisService = require('./redisService');
const messageQueueService = require('./messageQueueService');
const Messages = require('../models/Messages');
const Conversations = require('../models/Conversations');
const GroupConversations = require('../models/GroupConversations');
const Groups = require('../models/Groups');
const Contacts = require('../models/Contacts');
const Users = require('../models/Users');

class MessageDeliveryService {
    constructor(io) {
        this.io = io;
        this.localUsers = new Map(); // Local socket connections on this server
    }

    // Helper function to automatically add contacts when receiving messages
    async autoAddContact(userId, contactUserId) {
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
    }

    // Get updated conversations for a user
    async getUpdatedConversations(userId) {
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

            // Extract just the data portion for final result
            return allConversations.map(conv => conv.data);
        } catch (error) {
            console.error('Error fetching updated conversations:', error);
            return [];
        }
    }

    // Set local user connection
    setLocalUser(userId, socketData) {
        this.localUsers.set(userId, socketData);
        // Also update Redis for cross-server coordination
        redisService.setUserSession(userId, {
            ...socketData,
            serverId: redisService.serverId
        });
    }

    // Remove local user connection
    removeLocalUser(userId) {
        this.localUsers.delete(userId);
        redisService.removeUserSession(userId);
    }

    // Get user location (local or remote server)
    async getUserLocation(userId) {
        // Check local first
        if (this.localUsers.has(userId)) {
            return {
                isLocal: true,
                socketData: this.localUsers.get(userId),
                serverId: redisService.serverId
            };
        }

        // Check Redis for remote servers
        const session = await redisService.getUserSession(userId);
        if (session) {
            return {
                isLocal: false,
                socketData: session,
                serverId: session.serverId
            };
        }

        return null; // User is offline
    }

    // Send message with ordering and delivery guarantees
    async sendMessageWithOrdering(messageData) {
        const { conversationId, senderId, message, isGroup, receiverId, groupMembers } = messageData;

        console.log(`Processing ordered message for conversation ${conversationId}`);

        // Step 1: Acquire lock for conversation to ensure ordering
        const lockResult = await redisService.acquireMessageLock(conversationId, 10000); // 10 second timeout

        if (!lockResult.success) {
            throw new Error('Could not acquire message lock - another message is being processed');
        }

        try {
            // Step 2: Get sequence number for this message
            const sequenceNumber = await redisService.getNextSequenceNumber(conversationId);

            // Step 3: Save to MongoDB first for persistence
            const newMessage = new Messages({
                conversationId,
                senderId,
                message,
                sequenceNumber
            });

            await newMessage.save();

            // Step 4: Prepare message data with ordering info
            const orderedMessageData = {
                messageId: newMessage._id.toString(),
                conversationId,
                senderId,
                message,
                sequenceNumber,
                timestamp: newMessage.createdAt.toISOString(),
                isGroup,
                user: messageData.user
            };

            // Step 5: Determine recipients
            let recipientIds = [];
            if (isGroup && groupMembers) {
                recipientIds = groupMembers.filter(id => id !== senderId);

                // Auto-add contacts for all group members
                console.log(`Auto-adding contacts for group message from sender ${senderId}`);
                for (const memberId of groupMembers) {
                    const memberIdString = memberId.toString();
                    if (memberIdString !== senderId) {
                        await this.autoAddContact(memberIdString, senderId);
                        await this.autoAddContact(senderId, memberIdString);
                    }
                }

                // Update group conversation
                await GroupConversations.findByIdAndUpdate(conversationId, {
                    'lastMessage.message': message,
                    'lastMessage.sender': senderId,
                    'lastMessage.timestamp': newMessage.createdAt,
                    'lastMessage.sequenceNumber': sequenceNumber
                });
            } else if (receiverId) {
                recipientIds = [receiverId];

                // Auto-add contacts for both sender and receiver for regular messages
                console.log(`Auto-adding contacts for regular message: sender=${senderId}, receiver=${receiverId}`);
                await this.autoAddContact(receiverId, senderId); // Add sender to receiver's contacts
                await this.autoAddContact(senderId, receiverId); // Add receiver to sender's contacts

                // Update regular conversation
                await Conversations.findByIdAndUpdate(conversationId, {
                    'lastMessage.message': message,
                    'lastMessage.sender': senderId,
                    'lastMessage.timestamp': newMessage.createdAt,
                    'lastMessage.sequenceNumber': sequenceNumber
                });
            }

            // Step 6: Add sender to recipients for confirmation
            recipientIds.push(senderId);

            // Step 7: Deliver to online users and queue for offline users
            const deliveryResults = await this.deliverToRecipients(orderedMessageData, recipientIds);

            // Step 8: Update conversation lists for all recipients
            await this.updateConversationLists(recipientIds, conversationId, isGroup);

            console.log(`Message ${orderedMessageData.messageId} delivered with sequence ${sequenceNumber}`);

            return {
                success: true,
                messageData: orderedMessageData,
                deliveryResults,
                sequenceNumber
            };

        } finally {
            // Step 9: Always release the lock
            await redisService.releaseLock(conversationId, lockResult.lockId);
        }
    }

    // Deliver message to recipients (online immediately, offline to queue)
    async deliverToRecipients(messageData, recipientIds) {
        const deliveryResults = [];

        for (const recipientId of recipientIds) {
            try {
                const userLocation = await this.getUserLocation(recipientId);

                if (userLocation) {
                    // User is online
                    if (userLocation.isLocal) {
                        // User is on this server
                        this.deliverToLocalUser(recipientId, messageData, userLocation.socketData);
                        deliveryResults.push({ userId: recipientId, status: 'delivered_local' });
                    } else {
                        // User is on another server - broadcast via Redis
                        await redisService.broadcastMessage('deliver_message', {
                            userId: recipientId,
                            messageData,
                            targetServer: userLocation.serverId
                        });
                        deliveryResults.push({ userId: recipientId, status: 'delivered_remote' });
                    }
                } else {
                    // User is offline - add to queue
                    await redisService.queueMessageForUser(recipientId, messageData);
                    deliveryResults.push({ userId: recipientId, status: 'queued' });
                }
            } catch (error) {
                console.error(`Error delivering message to user ${recipientId}:`, error);
                deliveryResults.push({ userId: recipientId, status: 'error', error: error.message });
            }
        }

        return deliveryResults;
    }

    // Deliver message to local user
    deliverToLocalUser(userId, messageData, socketData) {
        if (socketData && socketData.socketId) {
            this.io.to(socketData.socketId).emit('getMessage', messageData);
            console.log(`Delivered message to local user ${userId} via socket ${socketData.socketId}`);
        }
    }

    // Update conversation lists for all recipients
    async updateConversationLists(recipientIds, conversationId, isGroup) {
        // Fetch and send updated conversation lists to all recipients
        for (const recipientId of recipientIds) {
            try {
                const userLocation = await this.getUserLocation(recipientId);

                if (userLocation && userLocation.isLocal) {
                    // Get updated conversations for this user
                    const updatedConversations = await this.getUpdatedConversations(recipientId);

                    // Send conversation list update to local user
                    console.log(`Emitting conversationsListUpdated to ${recipientId} with ${updatedConversations.length} conversations`);
                    this.io.to(userLocation.socketData.socketId).emit('conversationsListUpdated', {
                        conversations: updatedConversations
                    });
                } else if (userLocation && !userLocation.isLocal) {
                    // Broadcast to remote server
                    await redisService.broadcastMessage('conversation_updated', {
                        userId: recipientId,
                        conversationId,
                        action: 'messageReceived',
                        isGroup
                    });
                }
            } catch (error) {
                console.error(`Error updating conversation list for user ${recipientId}:`, error);
            }
        }
    }

    // Process queued messages when user comes online
    async processUserQueueOnConnect(userId, socketData) {
        try {
            const queuedMessages = await messageQueueService.processUserQueue(userId);

            if (queuedMessages.length > 0) {
                console.log(`Delivering ${queuedMessages.length} queued messages to user ${userId}`);

                // Sort by sequence number to maintain order
                queuedMessages.sort((a, b) => {
                    if (a.conversationId !== b.conversationId) {
                        return a.conversationId.localeCompare(b.conversationId);
                    }
                    return a.sequenceNumber - b.sequenceNumber;
                });

                // Deliver messages with small delays to maintain order
                for (let i = 0; i < queuedMessages.length; i++) {
                    const messageData = queuedMessages[i];

                    setTimeout(() => {
                        this.deliverToLocalUser(userId, messageData, socketData);
                    }, i * 100); // 100ms delay between messages
                }
            }
        } catch (error) {
            console.error(`Error processing queued messages for user ${userId}:`, error);
        }
    }

    // Handle cross-server message delivery
    handleCrossServerEvent(eventData) {
        const { event, data } = eventData;

        switch (event) {
            case 'deliver_message':
                if (data.targetServer === redisService.serverId) {
                    const userLocation = this.localUsers.get(data.userId);
                    if (userLocation) {
                        this.deliverToLocalUser(data.userId, data.messageData, userLocation);
                    }
                }
                break;

            case 'conversation_updated':
                // Send updated conversation list to user on this server
                this.sendConversationUpdate(data.userId, data.conversationId, data.action, data.isGroup);
                break;

            default:
                console.log('Unknown cross-server event:', event);
        }
    }

    // Send conversation update to a specific user
    async sendConversationUpdate(userId, conversationId, action, isGroup) {
        try {
            const userSession = this.localUsers.get(userId);
            if (userSession) {
                // Get updated conversations for this user
                const updatedConversations = await this.getUpdatedConversations(userId);

                console.log(`Cross-server: Emitting conversationsListUpdated to ${userId} with ${updatedConversations.length} conversations`);
                this.io.to(userSession.socketId).emit('conversationsListUpdated', {
                    conversations: updatedConversations
                });
            }
        } catch (error) {
            console.error(`Error sending conversation update to user ${userId}:`, error);
        }
    }
}

module.exports = MessageDeliveryService;
