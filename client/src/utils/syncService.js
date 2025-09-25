// Background sync service for MongoDB updates
import MessageStorage from './messageStorage';
import config from '../config';
import logger from '../logger';

export class SyncService {
    constructor() {
        this.syncInterval = null;
        this.isOnline = navigator.onLine;
        this.isSyncing = false;

        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            logger.info('Connection restored, resuming sync...');
            this.performSync();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            logger.warn('Connection lost, sync paused...');
        });
    }

    // Start periodic sync with interval from environment
    startPeriodicSync(intervalMinutes = 5) {
        this.stopPeriodicSync(); // Clear any existing interval

        const intervalMs = intervalMinutes * 60 * 1000; // Convert to milliseconds
        logger.info(`Starting periodic sync every ${intervalMinutes} minutes`);

        // Perform initial sync
        this.performSync();

        // Set up periodic sync
        this.syncInterval = setInterval(() => {
            this.performSync();
        }, intervalMs);
    }

    // Stop periodic sync
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            logger.info('Periodic sync stopped');
        }
    }

    // Perform sync operation
    async performSync() {
        if (!this.isOnline || this.isSyncing) {
            logger.info('Sync skipped: offline or already syncing');
            return;
        }

        this.isSyncing = true;
        logger.info('Starting sync process...');

        try {
            const syncQueue = MessageStorage.getSyncQueue();
            const unsyncedCount = MessageStorage.getUnsyncedCount();

            logger.info(`Syncing ${syncQueue.length} operations, ${unsyncedCount} unsynced messages`);

            // Process sync queue
            for (const item of syncQueue) {
                try {
                    await this.processSyncItem(item);
                    MessageStorage.removeSyncQueueItem(item.id);
                } catch (error) {
                    logger.error('Error processing sync item:', item, error);
                    // Don't remove failed items, they'll be retried next sync
                }
            }

            // Update last sync time
            MessageStorage.setLastSyncTime();

            logger.info('Sync completed successfully');

            // Emit sync completed event for UI updates
            window.dispatchEvent(new CustomEvent('syncCompleted', {
                detail: {
                    timestamp: new Date(),
                    processedItems: syncQueue.length
                }
            }));

        } catch (error) {
            logger.error('Sync process failed:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // Process individual sync queue item
    async processSyncItem(item) {
        const { action, conversationId, message, messageId, updates } = item;

        switch (action) {
            case 'create':
                return await this.syncCreateMessage(conversationId, message);

            case 'update':
                return await this.syncUpdateMessage(conversationId, messageId, updates);

            case 'delete':
                return await this.syncDeleteMessage(conversationId, messageId);

            default:
                throw new Error(`Unknown sync action: ${action}`);
        }
    }

    // Sync create message to MongoDB
    async syncCreateMessage(conversationId, message) {
        try {
            const response = await fetch(`${config.API_URL}/api/message/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId,
                    senderId: message.senderId,
                    message: message.message,
                    timestamp: message.timestamp,
                    sequenceNumber: message.sequenceNumber, // Include sequence number in sync
                    localMessageId: message.messageId
                })
            });

            if (response.ok) {
                const result = await response.json();
                // Mark message as synced in localStorage
                MessageStorage.markMessageAsSynced(
                    conversationId,
                    message.messageId,
                    result.messageId
                );
                logger.info(`Synced message ${message.messageId} to server as ${result.messageId}`);
                return result;
            } else {
                throw new Error(`Failed to sync message: ${response.status}`);
            }
        } catch (error) {
            logger.error('Error syncing create message:', error);
            throw error;
        }
    }

    // Sync update message to MongoDB
    async syncUpdateMessage(conversationId, messageId, updates) {
        try {
            const response = await fetch(`${config.API_URL}/api/message/${messageId}/sync`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId,
                    updates
                })
            });

            if (response.ok) {
                logger.info(`Synced message update ${messageId}`);
                return await response.json();
            } else {
                throw new Error(`Failed to sync message update: ${response.status}`);
            }
        } catch (error) {
            logger.error('Error syncing update message:', error);
            throw error;
        }
    }

    // Sync delete message to MongoDB
    async syncDeleteMessage(conversationId, messageId) {
        try {
            const response = await fetch(`${config.API_URL}/api/message/${messageId}/sync`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId
                })
            });

            if (response.ok) {
                logger.info(`Synced message deletion ${messageId}`);
                return await response.json();
            } else {
                throw new Error(`Failed to sync message deletion: ${response.status}`);
            }
        } catch (error) {
            logger.error('Error syncing delete message:', error);
            throw error;
        }
    }

    // Force immediate sync
    async forcSync() {
        logger.info('Force sync requested...');
        await this.performSync();
    }

    // Get sync status
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            lastSync: MessageStorage.getLastSyncTime(),
            unsyncedCount: MessageStorage.getUnsyncedCount(),
            pendingOperations: MessageStorage.getSyncQueue().length
        };
    }
}

// Create singleton instance
const syncService = new SyncService();

export default syncService;
