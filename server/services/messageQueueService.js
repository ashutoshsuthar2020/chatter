const redisService = require('./redisService');
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
        const { conversationId, senderId, receiverIds, isGroup } = messageData;

        // Get sequence number for ordering
        const sequenceNumber = await redisService.getNextSequenceNumber(conversationId);

        const queuedMessage = {
            ...messageData,
            sequenceNumber,
            queuedAt: new Date().toISOString(),
            serverId: redisService.serverId
        };

        // Queue for each recipient
        const queuePromises = receiverIds.map(async (receiverId) => {
            // Check if user is online
            const userSession = await redisService.getUserSession(receiverId);

            if (userSession) {
                // User is online - will be delivered immediately
                return { userId: receiverId, status: 'online', session: userSession };
            } else {
                // User is offline - add to queue
                await redisService.queueMessageForUser(receiverId, queuedMessage);
                return { userId: receiverId, status: 'queued' };
            }
        });

        const queueResults = await Promise.all(queuePromises);

        return {
            sequenceNumber,
            queueResults,
            queuedMessage
        };
    }

    // Process queued messages when user comes online
    async processUserQueue(userId) {
        const queueKey = `user_queue:${userId}`;

        // Prevent multiple queue processing for same user
        if (this.processingQueues.has(queueKey)) {
            console.log(`Queue already being processed for user ${userId}`);
            return [];
        }

        this.processingQueues.add(queueKey);

        try {
            // Get all queued messages
            const queuedMessages = await redisService.getQueuedMessages(userId);

            if (queuedMessages.length === 0) {
                return [];
            }

            console.log(`Processing ${queuedMessages.length} queued messages for user ${userId}`);

            // Sort messages by sequence number to maintain order
            queuedMessages.sort((a, b) => {
                // First sort by conversation
                if (a.conversationId !== b.conversationId) {
                    return a.conversationId.localeCompare(b.conversationId);
                }
                // Then by sequence number within conversation
                return a.sequenceNumber - b.sequenceNumber;
            });

            // Clear the queue since we're processing all messages
            await redisService.clearUserQueue(userId);

            return queuedMessages;

        } catch (error) {
            console.error(`Error processing queue for user ${userId}:`, error);
            return [];
        } finally {
            this.processingQueues.delete(queueKey);
        }
    }

    // Save queued messages to MongoDB (for long-term offline users)
    async persistQueuedMessages(userId) {
        try {
            const queuedMessages = await redisService.getQueuedMessages(userId);

            if (queuedMessages.length === 0) {
                return 0;
            }

            console.log(`Persisting ${queuedMessages.length} queued messages for offline user ${userId}`);

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

            // Clear the queue after persistence
            await redisService.clearUserQueue(userId);

            console.log(`Successfully persisted ${savedCount} messages for user ${userId}`);
            return savedCount;

        } catch (error) {
            console.error(`Error persisting queued messages for user ${userId}:`, error);
            return 0;
        }
    }

    // Clean up old queues (run periodically)
    async cleanupOldQueues() {
        try {
            if (!redisService.isConnected) return;

            console.log('Starting queue cleanup process...');

            // This is a simplified cleanup - in production you'd want more sophisticated logic
            // For now, we'll persist messages for users offline > 1 hour

            const userSessions = await redisService.redis.hgetall('user_sessions');
            const activeUsers = new Set(Object.keys(userSessions));

            // Get all user queues
            const queueKeys = await redisService.redis.keys('user_queue:*');

            for (const queueKey of queueKeys) {
                const userId = queueKey.replace('user_queue:', '');

                if (!activeUsers.has(userId)) {
                    // User is not active - check queue age
                    const queueMessages = await redisService.getQueuedMessages(userId);

                    if (queueMessages.length > 0) {
                        const oldestMessage = queueMessages[queueMessages.length - 1]; // FIFO
                        const queueAge = Date.now() - new Date(oldestMessage.queuedAt).getTime();

                        // If queue is older than 1 hour, persist to MongoDB
                        if (queueAge > 60 * 60 * 1000) {
                            await this.persistQueuedMessages(userId);
                        }
                    }
                }
            }

            console.log('Queue cleanup completed');
        } catch (error) {
            console.error('Error during queue cleanup:', error);
        }
    }
}

module.exports = new MessageQueueService();
