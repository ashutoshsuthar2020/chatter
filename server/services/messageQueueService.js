const natsService = require('./natsService');
const Messages = require('../models/Messages');
const Conversations = require('../models/Conversations');
const GroupConversations = require('../models/GroupConversations');
const Groups = require('../models/Groups');

class MessageQueueService {
    constructor() {
        this.processingQueues = new Set(); // Track which queues are being processed
    }

    // Add message to queue with ordering support
    async queueMessage(messageData) {
        // Use NATS for message ordering and broadcasting
        const { conversationId, senderId, receiverIds, isGroup } = messageData;
        const sequenceNumber = Date.now(); // Use timestamp for ordering
        const queuedMessage = {
            ...messageData,
            sequenceNumber,
            queuedAt: new Date().toISOString(),
        };
        // Broadcast message to all pods via NATS
        await natsService.publish('message_queue', queuedMessage);
        return {
            sequenceNumber,
            queuedMessage
        };
    }

    // Process queued messages when user comes online
    async processUserQueue(userId) {
        // NATS-based: Assume messages are delivered via NATS, so no local queue
        return [];
    }

    // Save queued messages to MongoDB (for long-term offline users)
    async persistQueuedMessages(userId, queuedMessages) {
        // Accept queuedMessages as argument (from NATS or other source)
        if (!queuedMessages || queuedMessages.length === 0) {
            return 0;
        }
        // Group messages by conversation for batch processing
        const messagesByConversation = {};
        queuedMessages.forEach(msg => {
            if (!messagesByConversation[msg.conversationId]) {
                messagesByConversation[msg.conversationId] = [];
            }
            messagesByConversation[msg.conversationId].push(msg);
        });
        let savedCount = 0;
        // Save to MongoDB
        for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
            for (const messageData of messages) {
                try {
                    // Check if message already exists (prevent duplicates)
                    const existingMessage = await Messages.findOne({
                        conversationId: messageData.conversationId,
                        senderId: messageData.senderId,
                        message: messageData.message,
                        sequenceNumber: messageData.sequenceNumber
                    });
                    if (!existingMessage) {
                        const newMessage = new Messages({
                            conversationId: messageData.conversationId,
                            senderId: messageData.senderId,
                            message: messageData.message,
                            sequenceNumber: messageData.sequenceNumber,
                            createdAt: new Date(messageData.timestamp || messageData.queuedAt)
                        });
                        await newMessage.save();
                        savedCount++;
                        // Update conversation last message
                        if (messageData.isGroup) {
                            await GroupConversations.findByIdAndUpdate(conversationId, {
                                'lastMessage.message': messageData.message,
                                'lastMessage.sender': messageData.senderId,
                                'lastMessage.timestamp': newMessage.createdAt,
                                'lastMessage.sequenceNumber': messageData.sequenceNumber
                            });
                        } else {
                            await Conversations.findByIdAndUpdate(conversationId, {
                                'lastMessage.message': messageData.message,
                                'lastMessage.sender': messageData.senderId,
                                'lastMessage.timestamp': newMessage.createdAt,
                                'lastMessage.sequenceNumber': messageData.sequenceNumber
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error saving individual queued message:', error);
                }
            }
        }
        return savedCount;
    }

    // Clean up old queues (run periodically)
    async cleanupOldQueues() {
        return;
    }
}

module.exports = new MessageQueueService();
