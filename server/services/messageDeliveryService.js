
const natsService = require('./natsService');
const messageQueueService = require('./messageQueueService');
const Messages = require('../models/Messages');
const Conversations = require('../models/Conversations');
const GroupConversations = require('../models/GroupConversations');
const Groups = require('../models/Groups');
const Contacts = require('../models/Contacts');
const Users = require('../models/Users');
const logger = require('../logger');

class MessageDeliveryService {
    constructor(io) {
        this.io = io;
        this.localUsers = new Map(); // Local socket connections on this server
        // Subscribe to NATS for active users and messages
        natsService.subscribe('active_users.update', this.handleActiveUsersUpdate.bind(this));
        logger.info('[MessageDeliveryService] Subscribed to NATS subject: active_users.update');
        natsService.subscribe('message.send', this.handleCrossServerMessage.bind(this));
        logger.info('[MessageDeliveryService] Subscribed to NATS subject: message.send');
    }

    // Helper function to automatically add contacts when receiving messages
    async autoAddContact(userId, contactUserId) {
        try {
            const logger = require('../logger');
            logger.info('Attempting to auto-add contact: userId=%s, contactUserId=%s', userId, contactUserId);

            // Check if contact already exists
            const existingContact = await Contacts.findOne({
                userId: userId,
                contactUserId: contactUserId
            });

            if (existingContact) {
                logger.info('Contact already exists between %s and %s', userId, contactUserId);
                return null; // Contact already exists
            }

            // Get contact user data
            const contactUser = await Users.findById(contactUserId);
            if (!contactUser) {
                logger.warn('Contact user not found: %s', contactUserId);
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
    setLocalUser(userId, socketData, activeUsers, contacts) {
        this.localUsers.set(userId, socketData);
        // Publish active users list to NATS
        natsService.publish('active_users.update', {
            activeUsers,
            contacts
        });
    }

    // Remove local user connection
    removeLocalUser(userId, activeUsers, contacts) {
        this.localUsers.delete(userId);
        // Publish active users list to NATS
        natsService.publish('active_users.update', {
            activeUsers,
            contacts
        });
    }

    // Get user location (local or remote server)
    async getUserLocation(userId) {
        // Only check local users; NATS does not store sessions
        if (this.localUsers.has(userId)) {
            return {
                isLocal: true,
                socketData: this.localUsers.get(userId),
                serverId: 'local'
            };
        }
        return null; // User is offline or on another pod
    }

    // Send message with ordering and delivery guarantees
    async sendMessageWithOrdering(messageData) {
        const { conversationId, senderId, message, isGroup, receiverId, groupMembers } = messageData;
        const sequenceNumber = Date.now(); // Use timestamp for ordering
        // Save to MongoDB first for persistence
        const newMessage = new Messages({
            conversationId,
            senderId,
            message,
            sequenceNumber
        });
        await newMessage.save();
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
        let recipientIds = [];
        if (isGroup && groupMembers) {
            recipientIds = groupMembers.filter(id => id !== senderId);
            for (const memberId of groupMembers) {
                const memberIdString = memberId.toString();
                if (memberIdString !== senderId) {
                    await this.autoAddContact(memberIdString, senderId);
                    await this.autoAddContact(senderId, memberIdString);
                }
            }
            await GroupConversations.findByIdAndUpdate(conversationId, {
                'lastMessage.message': message,
                'lastMessage.sender': senderId,
                'lastMessage.timestamp': newMessage.createdAt,
                'lastMessage.sequenceNumber': sequenceNumber
            });
        } else if (receiverId) {
            recipientIds = [receiverId];
            await this.autoAddContact(receiverId, senderId);
            await this.autoAddContact(senderId, receiverId);
            await Conversations.findByIdAndUpdate(conversationId, {
                'lastMessage.message': message,
                'lastMessage.sender': senderId,
                'lastMessage.timestamp': newMessage.createdAt,
                'lastMessage.sequenceNumber': sequenceNumber
            });
        }
        recipientIds.push(senderId);
        const deliveryResults = await this.deliverToRecipients(orderedMessageData, recipientIds);
        await this.updateConversationLists(recipientIds, conversationId, isGroup);
        return {
            success: true,
            messageData: orderedMessageData,
            deliveryResults,
            sequenceNumber
        };
    }

    // Deliver message to recipients (all go through NATS)
    async deliverToRecipients(messageData, recipientIds) {
        const deliveryResults = [];
        for (const recipientId of recipientIds) {
            try {
                // Always publish to NATS for consistency
                await natsService.publish('message.send', {
                    userId: recipientId,
                    messageData
                });
                deliveryResults.push({ userId: recipientId, status: 'delivered_nats' });
            } catch (error) {
                deliveryResults.push({ userId: recipientId, status: 'error', error: error.message });
            }
        }
        return deliveryResults;
    }
    // Handle NATS active users update
    handleActiveUsersUpdate(data) {
        // Emit active users list to all relevant contacts
        if (data && data.activeUsers && data.contacts) {
            data.contacts.forEach(contactId => {
                const userSession = this.localUsers.get(contactId);
                if (userSession) {
                    this.io.to(userSession.socketId).emit('activeUsers', data.activeUsers);
                }
            });
        }
    }

    // Handle NATS message delivery
    handleCrossServerMessage(data) {
        logger.info(`[NATS] Received message.send for userId=${data?.userId}, messageId=${data?.messageData?.messageId}, conversationId=${data?.messageData?.conversationId}`);
        if (data && data.userId && data.messageData) {
            const userSession = this.localUsers.get(data.userId);
            if (userSession) {
                logger.info(`[NATS] Found local user for userId=${data.userId}, socketId=${userSession.socketId}. Emitting getMessage.`);
                this.deliverToLocalUser(data.userId, data.messageData, userSession);
            } else {
                logger.warn(`[NATS] No local user found for userId=${data.userId}. Message will not be delivered in real time.`);
            }
        } else {
            logger.warn(`[NATS] Invalid data received in message.send: ${JSON.stringify(data)}`);
        }
    }

    // Deliver message to local user
    deliverToLocalUser(userId, messageData, socketData) {
        if (socketData && socketData.socketId) {
            logger.info(`[MessageDelivery] Emitting getMessage to userId=${userId}, socketId=${socketData.socketId}, conversationId=${messageData.conversationId}, messageId=${messageData.messageId}`);
            this.io.to(socketData.socketId).emit('getMessage', messageData);
            logger.info(`[MessageDelivery] Delivered message to local user ${userId} via socket ${socketData.socketId}`);
        }
    }

    // Update conversation lists for all recipients
    async updateConversationLists(recipientIds, conversationId, isGroup) {
        for (const recipientId of recipientIds) {
            try {
                const userLocation = await this.getUserLocation(recipientId);
                if (userLocation && userLocation.isLocal) {
                    const updatedConversations = await this.getUpdatedConversations(recipientId);
                    this.io.to(userLocation.socketData.socketId).emit('conversationsListUpdated', {
                        conversations: updatedConversations
                    });
                } else {
                    await natsService.publish('conversation_updated', {
                        userId: recipientId,
                        conversationId,
                        action: 'messageReceived',
                        isGroup
                    });
                }
            } catch (error) {
                // Log error if needed
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

    // Handle cross-server message delivery (NATS events)
    handleCrossServerEvent(eventData) {
        const { event, data } = eventData;
        switch (event) {
            case 'deliver_message':
                const userLocation = this.localUsers.get(data.userId);
                if (userLocation) {
                    this.deliverToLocalUser(data.userId, data.messageData, userLocation);
                }
                break;
            case 'conversation_updated':
                this.sendConversationUpdate(data.userId, data.conversationId, data.action, data.isGroup);
                break;
            default:
            // Unknown event
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
