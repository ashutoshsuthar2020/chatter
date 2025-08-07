// localStorage-based message management system

const MESSAGE_STORAGE_KEY = 'chatter_messages';
const SYNC_QUEUE_KEY = 'chatter_sync_queue';
const LAST_SYNC_KEY = 'chatter_last_sync';

// Message Storage Structure:
// {
//   conversationId1: [
//     { messageId, senderId, message, timestamp, synced: boolean },
//     ...
//   ],
//   conversationId2: [...],
//   ...
// }

// Sync Queue Structure:
// [
//   { action: 'create', conversationId, message: {...} },
//   { action: 'update', conversationId, messageId, updates: {...} },
//   { action: 'delete', conversationId, messageId },
//   ...
// ]

export class MessageStorage {
    // Get all messages for a conversation from localStorage with proper ordering
    static getConversationMessages(conversationId) {
        try {
            const allMessages = JSON.parse(localStorage.getItem(MESSAGE_STORAGE_KEY) || '{}');
            const messages = allMessages[conversationId] || [];

            // Ensure proper ordering by sequence number, then timestamp
            return messages.sort((a, b) => {
                // If both messages have sequence numbers, use those
                if (a.sequenceNumber && b.sequenceNumber && a.sequenceNumber !== b.sequenceNumber) {
                    return a.sequenceNumber - b.sequenceNumber;
                }
                // Fallback to timestamp ordering
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
        } catch (error) {
            console.error('Error reading messages from localStorage:', error);
            return [];
        }
    }

    // Add a new message to localStorage
    static addMessage(conversationId, messageData) {
        try {
            const allMessages = JSON.parse(localStorage.getItem(MESSAGE_STORAGE_KEY) || '{}');

            if (!allMessages[conversationId]) {
                allMessages[conversationId] = [];
            }

            const newMessage = {
                messageId: messageData.messageId || `local_${Date.now()}_${Math.random()}`,
                senderId: messageData.senderId,
                message: messageData.message,
                timestamp: messageData.timestamp || new Date().toISOString(),
                sequenceNumber: messageData.sequenceNumber || 0, // Add sequence number support
                synced: false, // Mark as not synced to MongoDB yet
                isLocal: true // Mark as stored locally
            };

            // Check for duplicate messageId to prevent multiple entries
            const existingMessage = allMessages[conversationId].find(msg => msg.messageId === newMessage.messageId);
            if (existingMessage) {
                console.log('Message with this ID already exists, skipping duplicate:', newMessage.messageId);
                return existingMessage;
            }

            allMessages[conversationId].push(newMessage);

            // Sort messages by sequence number first, then by timestamp for proper ordering
            allMessages[conversationId].sort((a, b) => {
                // If both messages have sequence numbers, use those
                if (a.sequenceNumber && b.sequenceNumber && a.sequenceNumber !== b.sequenceNumber) {
                    return a.sequenceNumber - b.sequenceNumber;
                }
                // Fallback to timestamp ordering
                return new Date(a.timestamp) - new Date(b.timestamp);
            });

            localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(allMessages));

            // Add to sync queue for later MongoDB update
            this.addToSyncQueue('create', conversationId, newMessage);

            return newMessage;
        } catch (error) {
            console.error('Error adding message to localStorage:', error);
            return null;
        }
    }

    // Update a message in localStorage
    static updateMessage(conversationId, messageId, updates) {
        try {
            const allMessages = JSON.parse(localStorage.getItem(MESSAGE_STORAGE_KEY) || '{}');

            if (allMessages[conversationId]) {
                const messageIndex = allMessages[conversationId].findIndex(msg => msg.messageId === messageId);
                if (messageIndex !== -1) {
                    allMessages[conversationId][messageIndex] = {
                        ...allMessages[conversationId][messageIndex],
                        ...updates
                    };
                    localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(allMessages));

                    // Add to sync queue if not already synced
                    if (!allMessages[conversationId][messageIndex].synced) {
                        this.addToSyncQueue('update', conversationId, messageId, updates);
                    }

                    return allMessages[conversationId][messageIndex];
                }
            }
            return null;
        } catch (error) {
            console.error('Error updating message in localStorage:', error);
            return null;
        }
    }

    // Delete a message from localStorage
    static deleteMessage(conversationId, messageId) {
        try {
            const allMessages = JSON.parse(localStorage.getItem(MESSAGE_STORAGE_KEY) || '{}');

            if (allMessages[conversationId]) {
                const messageIndex = allMessages[conversationId].findIndex(msg => msg.messageId === messageId);
                if (messageIndex !== -1) {
                    const deletedMessage = allMessages[conversationId][messageIndex];
                    allMessages[conversationId].splice(messageIndex, 1);
                    localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(allMessages));

                    // Add to sync queue if message was already synced
                    if (deletedMessage.synced) {
                        this.addToSyncQueue('delete', conversationId, messageId);
                    }

                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error deleting message from localStorage:', error);
            return false;
        }
    }

    // Add operation to sync queue
    static addToSyncQueue(action, conversationId, messageOrId, updates = null) {
        try {
            const syncQueue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');

            const queueItem = {
                id: `${action}_${Date.now()}_${Math.random()}`,
                action,
                conversationId,
                timestamp: new Date().toISOString()
            };

            if (action === 'create') {
                queueItem.message = messageOrId; // messageOrId is the full message object
            } else if (action === 'update') {
                queueItem.messageId = messageOrId; // messageOrId is messageId
                queueItem.updates = updates;
            } else if (action === 'delete') {
                queueItem.messageId = messageOrId; // messageOrId is messageId
            }

            syncQueue.push(queueItem);
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
        } catch (error) {
            console.error('Error adding to sync queue:', error);
        }
    }

    // Get sync queue
    static getSyncQueue() {
        try {
            return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
        } catch (error) {
            console.error('Error reading sync queue:', error);
            return [];
        }
    }

    // Clear sync queue item
    static removeSyncQueueItem(itemId) {
        try {
            const syncQueue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
            const filteredQueue = syncQueue.filter(item => item.id !== itemId);
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
        } catch (error) {
            console.error('Error removing sync queue item:', error);
        }
    }

    // Mark message as synced
    static markMessageAsSynced(conversationId, localMessageId, serverMessageId = null) {
        try {
            const allMessages = JSON.parse(localStorage.getItem(MESSAGE_STORAGE_KEY) || '{}');

            if (allMessages[conversationId]) {
                const messageIndex = allMessages[conversationId].findIndex(msg => msg.messageId === localMessageId);
                if (messageIndex !== -1) {
                    allMessages[conversationId][messageIndex].synced = true;
                    if (serverMessageId) {
                        allMessages[conversationId][messageIndex].serverMessageId = serverMessageId;
                    }
                    localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(allMessages));
                }
            }
        } catch (error) {
            console.error('Error marking message as synced:', error);
        }
    }

    // Get unsynced messages count
    static getUnsyncedCount() {
        try {
            const allMessages = JSON.parse(localStorage.getItem(MESSAGE_STORAGE_KEY) || '{}');
            let count = 0;

            Object.values(allMessages).forEach(conversationMessages => {
                count += conversationMessages.filter(msg => !msg.synced).length;
            });

            return count;
        } catch (error) {
            console.error('Error counting unsynced messages:', error);
            return 0;
        }
    }

    // Get last sync timestamp
    static getLastSyncTime() {
        return localStorage.getItem(LAST_SYNC_KEY);
    }

    // Set last sync timestamp
    static setLastSyncTime(timestamp = new Date().toISOString()) {
        localStorage.setItem(LAST_SYNC_KEY, timestamp);
    }

    // Clear all local message data (for logout/reset)
    static clearAll() {
        localStorage.removeItem(MESSAGE_STORAGE_KEY);
        localStorage.removeItem(SYNC_QUEUE_KEY);
        localStorage.removeItem(LAST_SYNC_KEY);
    }

    // Load messages from server and merge with local storage
    static async loadFromServer(conversationId, apiUrl, userId) {
        try {
            const res = await fetch(`${apiUrl}/api/message/${conversationId}?senderId=${userId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (res.ok) {
                const resData = await res.json();
                const serverMessages = resData.mssgData || [];

                // Get local messages
                const localMessages = this.getConversationMessages(conversationId);

                // Merge server and local messages, removing duplicates
                const mergedMessages = [...serverMessages];

                localMessages.forEach(localMsg => {
                    // Only add local messages that don't exist on server
                    const existsOnServer = serverMessages.find(serverMsg =>
                        serverMsg.messageId === localMsg.messageId ||
                        serverMsg.messageId === localMsg.serverMessageId ||
                        (serverMsg.message === localMsg.message &&
                            serverMsg.user?.id === localMsg.senderId &&
                            Math.abs(new Date(serverMsg.timestamp) - new Date(localMsg.timestamp)) < 5000)
                    );

                    if (!existsOnServer) {
                        mergedMessages.push({
                            messageId: localMsg.messageId,
                            user: { id: localMsg.senderId },
                            message: localMsg.message,
                            timestamp: localMsg.timestamp,
                            isLocal: true
                        });
                    }
                });

                // Sort by timestamp
                mergedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                return mergedMessages;
            }

            // If server fails, return local messages only
            return this.getConversationMessages(conversationId).map(msg => ({
                messageId: msg.messageId,
                user: { id: msg.senderId },
                message: msg.message,
                timestamp: msg.timestamp,
                isLocal: true
            }));
        } catch (error) {
            console.error('Error loading messages from server:', error);
            // Return local messages as fallback
            return this.getConversationMessages(conversationId).map(msg => ({
                messageId: msg.messageId,
                user: { id: msg.senderId },
                message: msg.message,
                timestamp: msg.timestamp,
                isLocal: true
            }));
        }
    }
}

export default MessageStorage;
